import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CircleCheck } from 'lucide-react';
import { api, mensaje, type Credito as TCredito, type Cuenta, type Inicio } from '../api';
import { ErrorCaja, Esqueleto, Hoja, useAviso } from '../componentes/Base';
import { dinero, fecha, fechaHora, pct, ultimos4 } from '../formato';

interface Cuota { idCuota: number; numero: number; fechaVencimiento: string; capital: number; interes: number; valorCuota: number; estado: string; pendiente: number; diasAtraso: number; }
interface Pago { idPago: number; fechaPago: string; monto: number; canal: string; referencia: string; }
type Detalle = TCredito & { tabla: Cuota[]; pagos: Pago[]; totalAdeudado: number };

export function PagarCuota({ credito, cuenta, abierta, alCerrar, alPagar }: { credito: TCredito; cuenta: Cuenta; abierta: boolean; alCerrar: () => void; alPagar: () => void }) {
  const aviso = useAviso();
  const detalle = useQuery({ queryKey: ['credito', credito.idCredito], queryFn: () => api<Detalle>(`/movil/creditos/${credito.idCredito}`), enabled: abierta });
  const cuota = detalle.data?.tabla.find((q) => q.estado !== 'PAGADA');
  const vencidas = detalle.data?.tabla.filter((q) => q.estado === 'VENCIDA') ?? [];
  const sugerido = vencidas.length ? vencidas.reduce((a, q) => a + q.pendiente, 0) : cuota?.pendiente ?? credito.cuotaMensual;
  const [listo, setListo] = useState<{ referencia: string; monto: number } | null>(null);
  const pago = useMutation({
    mutationFn: () => api<{ referencia: string; monto: number }>(`/movil/creditos/${credito.idCredito}/pagos`, { cuerpo: { monto: Math.round(sugerido * 100) / 100 } }),
    onSuccess: (r) => { setListo(r); alPagar(); aviso('Pago registrado. Gracias por pagar a tiempo.'); },
  });
  const insuficiente = cuenta.saldo < sugerido;

  return (
    <Hoja abierta={abierta} titulo={listo ? 'Pago realizado' : 'Pagar cuota'} alCerrar={alCerrar}>
      {listo ? (
        <div className="pago-listo">
          <CircleCheck size={48} aria-hidden />
          <p className="cifra-grande">{dinero(listo.monto)}</p>
          <p className="suave">Debitado de tu ahorro a la vista {ultimos4(cuenta.numero)}. Comprobante {listo.referencia}.</p>
          <button type="button" className="btn btn-primario btn-bloque" onClick={alCerrar}>Listo</button>
        </div>
      ) : detalle.isPending ? <Esqueleto alto={56} n={3} /> : (
        <div className="pila">
          <dl className="resumen-pago">
            <div><dt>Crédito</dt><dd>{credito.producto} · {credito.numeroOperacion}</dd></div>
            <div><dt>{vencidas.length > 1 ? `${vencidas.length} cuotas vencidas` : `Cuota ${cuota?.numero ?? ''}`}</dt><dd>{vencidas.length ? 'Incluye interés de mora' : `Vence el ${fecha(cuota?.fechaVencimiento)}`}</dd></div>
            <div><dt>Se debita de</dt><dd>Ahorro a la vista {ultimos4(cuenta.numero)} · saldo {dinero(cuenta.saldo)}</dd></div>
          </dl>
          <p className="monto-pagar"><span>Total a pagar</span><strong>{dinero(sugerido)}</strong></p>
          {insuficiente && <p className="texto-alerta">Tu saldo no alcanza. Deposita en tu cuenta o paga en ventanilla.</p>}
          {pago.isError && <ErrorCaja texto={mensaje(pago.error)} />}
          <button type="button" className="btn btn-primario btn-bloque btn-grande" disabled={pago.isPending || insuficiente} onClick={() => pago.mutate()}>
            {pago.isPending ? 'Procesando pago…' : `Pagar ${dinero(sugerido)}`}
          </button>
        </div>
      )}
    </Hoja>
  );
}

export function Credito() {
  const { id } = useParams();
  const cliente = useQueryClient();
  const consulta = useQuery({ queryKey: ['credito', Number(id)], queryFn: () => api<Detalle>(`/movil/creditos/${id}`) });
  const inicio = useQuery({ queryKey: ['inicio'], queryFn: () => api<Inicio>('/movil/inicio') });
  const [pagar, setPagar] = useState(false);
  const c = consulta.data;
  const ahorro = inicio.data?.cuentas.find((x) => x.tipo === 'AHORRO_VISTA');

  return (
    <div className="pagina">
      <Link to="/" className="volver"><ArrowLeft size={18} aria-hidden /> Inicio</Link>
      {consulta.isPending && <Esqueleto alto={120} n={3} />}
      {consulta.isError && <ErrorCaja texto={mensaje(consulta.error)} reintentar={() => consulta.refetch()} />}
      {c && (
        <>
          <header className="cab-credito">
            <span className="muted">{c.numeroOperacion} · desembolsado el {fecha(c.fechaDesembolso)}</span>
            <h1>{c.producto}</h1>
            <div className="saldos">
              <div><span>Saldo de capital</span><strong>{dinero(c.saldoCapital)}</strong></div>
              <div><span>Cuota mensual</span><strong>{dinero(c.cuotaMensual)}</strong></div>
              <div><span>Tasa</span><strong>{pct(c.tasaNominal)}</strong></div>
            </div>
            <span className="progreso grande" aria-label={`${c.cuotasPagadas} de ${c.plazoMeses} cuotas pagadas`}><i style={{ width: `${(c.cuotasPagadas / c.plazoMeses) * 100}%` }} /></span>
            <span className="muted">{c.cuotasPagadas} de {c.plazoMeses} cuotas pagadas</span>
            {c.estado !== 'CANCELADO' && ahorro && <button type="button" className="btn btn-primario btn-bloque-movil" onClick={() => setPagar(true)}>Pagar cuota</button>}
            {c.estado === 'CANCELADO' && <p className="nota-ok"><CircleCheck size={18} aria-hidden /> Crédito cancelado. ¡Gracias!</p>}
          </header>

          <section aria-labelledby="t-tabla">
            <h2 id="t-tabla" className="titulo-seccion">Tabla de amortización</h2>
            <ol className="tabla-cuotas tarjeta">
              {c.tabla.map((q) => (
                <li key={q.idCuota} className={q.estado.toLowerCase()}>
                  <span className="q-num">{q.numero}</span>
                  <span className="q-fecha">{fecha(q.fechaVencimiento)}<small>Capital {dinero(q.capital)} · interés {dinero(q.interes)}</small></span>
                  <span className="q-valor">{dinero(q.valorCuota)}<small>{q.estado === 'PAGADA' ? 'Pagada' : q.estado === 'VENCIDA' ? `Vencida ${q.diasAtraso} d` : q.estado === 'PARCIAL' ? 'Parcial' : 'Pendiente'}</small></span>
                </li>
              ))}
            </ol>
          </section>

          {c.pagos.length > 0 && (
            <section aria-labelledby="t-pagos">
              <h2 id="t-pagos" className="titulo-seccion">Pagos realizados</h2>
              <ul className="lista tarjeta">
                {c.pagos.slice(0, 12).map((p) => (
                  <li key={p.idPago}><span className="lista-texto"><strong>{dinero(p.monto)}</strong><span className="muted">{fechaHora(p.fechaPago)} · {p.canal === 'MOVIL' ? 'App' : p.canal === 'VENTANILLA' ? 'Ventanilla' : 'Débito automático'}</span></span><span className="muted">{p.referencia}</span></li>
                ))}
              </ul>
            </section>
          )}
          {ahorro && (
            <PagarCuota credito={c} cuenta={ahorro} abierta={pagar} alCerrar={() => setPagar(false)}
              alPagar={() => { cliente.invalidateQueries({ queryKey: ['credito', c.idCredito] }); cliente.invalidateQueries({ queryKey: ['inicio'] }); }} />
          )}
        </>
      )}
    </div>
  );
}
