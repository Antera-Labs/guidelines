import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Camera, CircleCheck, FileUp, ScanFace, Send } from 'lucide-react';
import { api, mensaje, type SolicitudResumen } from '../api';
import { ArcoEtapas } from '../componentes/ArcoEtapas';
import { ErrorCaja, Esqueleto, Hoja, useAviso } from '../componentes/Base';
import { dinero, fechaHora, pct } from '../formato';

interface Evento { idHistorial: number; idEtapa: number; idSubetapa: string; evento: string; detalle: string | null; fecha: string; }
interface Condicion { montoAprobado: number; plazoMeses: number; tasaNominal: number; tasaEfectiva: number; cuotaMensual: number; detalleGarantia: string; aceptadaSocio: boolean; contratoFirmado: boolean; }
type Detalle = SolicitudResumen & { condicion: Condicion | null; documentos: { tipo: string; nombreArchivo: string }[]; kyc: { resultado: string } | null; lineaTiempo: Evento[] };

const DOCS = [
  { tipo: 'CEDULA', texto: 'Foto de tu cédula (ambos lados)' },
  { tipo: 'PLANILLA_SERVICIO', texto: 'Planilla de luz o agua' },
  { tipo: 'RUC_RISE', texto: 'RUC o RISE, o tu rol de pagos' },
];

export function Solicitud() {
  const { id } = useParams();
  const cliente = useQueryClient();
  const aviso = useAviso();
  const clave = ['solicitud', Number(id)];
  const q = useQuery({ queryKey: clave, queryFn: () => api<Detalle>(`/movil/solicitudes/${id}`) });
  const [ofertaAbierta, setOfertaAbierta] = useState(false);
  const refrescar = () => { cliente.invalidateQueries({ queryKey: clave }); cliente.invalidateQueries({ queryKey: ['inicio'] }); };

  const identidad = useMutation({ mutationFn: () => api<{ resultado: string }>(`/movil/solicitudes/${id}/identidad`, { metodo: 'POST' }),
    onSuccess: (r) => { refrescar(); aviso(r.resultado === 'APROBADO' ? 'Identidad verificada.' : 'No pudimos verificarte en línea. Acércate a tu agencia.', r.resultado === 'APROBADO' ? 'ok' : 'error'); } });
  const envio = useMutation({ mutationFn: () => api<{ resultado: { dictamen: string } }>(`/movil/solicitudes/${id}/envio`, { metodo: 'POST' }),
    onSuccess: (r) => { refrescar(); const d = r.resultado.dictamen; aviso(d === 'APROBADO' ? '¡Tu crédito fue aprobado! Revisa la oferta.' : d === 'SUJETO_VERIFICACION' ? 'Tu solicitud pasó a revisión del comité.' : 'Tu solicitud no fue aprobada esta vez.', d === 'RECHAZADO' ? 'error' : 'ok'); } });
  const aceptar = useMutation({ mutationFn: () => api(`/movil/solicitudes/${id}/aceptacion`, { metodo: 'POST' }),
    onSuccess: () => { setOfertaAbierta(false); refrescar(); aviso('Oferta aceptada. Te esperamos en la agencia para firmar.'); } });

  const s = q.data;
  return (
    <div className="pagina-solicitud">
      <section className="cielo compacto">
        <div className="cielo-cont">
          <Link to="/" className="volver claro"><ArrowLeft size={18} aria-hidden /> Inicio</Link>
          {s && (
            <div className="cab-solicitud">
              <ArcoEtapas etapa={s.idEtapa} subetapa={s.idSubetapa} estado={s.estado} claro tam={240} />
              <div>
                <span className="suave-claro">{s.numero}</span>
                <h1>{s.producto}</h1>
                <p className="suave-claro">{dinero(s.montoSolicitado)} a {s.plazoMeses} meses</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="contenido-inicio">
        {q.isPending && <Esqueleto alto={120} n={2} />}
        {q.isError && <ErrorCaja texto={mensaje(q.error)} reintentar={() => q.refetch()} />}
        {s && (
          <>
            <section className="tarjeta siguiente-paso" aria-labelledby="t-sig">
              <PasoSiguiente s={s} onIdentidad={() => identidad.mutate()} onEnviar={() => envio.mutate()} onOferta={() => setOfertaAbierta(true)}
                ocupado={identidad.isPending || envio.isPending} alSubir={refrescar} />
              {(identidad.isError || envio.isError) && <ErrorCaja texto={mensaje(identidad.error ?? envio.error)} />}
            </section>

            <section aria-labelledby="t-linea">
              <h2 id="t-linea" className="titulo-seccion">Historial de tu solicitud</h2>
              <ol className="linea tarjeta">
                {[...s.lineaTiempo].reverse().map((e) => (
                  <li key={e.idHistorial}>
                    <span className="punto" aria-hidden />
                    <div><strong>{e.evento}</strong>{e.detalle && <p className="suave">{e.detalle}</p>}<span className="muted">{fechaHora(e.fecha)}</span></div>
                  </li>
                ))}
              </ol>
            </section>

            {s.condicion && (
              <Hoja abierta={ofertaAbierta} titulo="Tu oferta de crédito" alCerrar={() => setOfertaAbierta(false)}>
                <div className="pila">
                  <p className="monto-pagar"><span>Monto aprobado</span><strong>{dinero(s.condicion.montoAprobado)}</strong></p>
                  <dl className="resumen-pago">
                    <div><dt>Plazo</dt><dd>{s.condicion.plazoMeses} meses</dd></div>
                    <div><dt>Cuota mensual</dt><dd>{dinero(s.condicion.cuotaMensual)}</dd></div>
                    <div><dt>Tasa nominal · efectiva</dt><dd>{pct(s.condicion.tasaNominal)} · {pct(s.condicion.tasaEfectiva)}</dd></div>
                    <div><dt>Garantía</dt><dd>{s.condicion.detalleGarantia}</dd></div>
                    <div><dt>Total a pagar</dt><dd>{dinero(s.condicion.cuotaMensual * s.condicion.plazoMeses)}</dd></div>
                  </dl>
                  {aceptar.isError && <ErrorCaja texto={mensaje(aceptar.error)} />}
                  <button type="button" className="btn btn-primario btn-bloque btn-grande" disabled={aceptar.isPending} onClick={() => aceptar.mutate()}>
                    {aceptar.isPending ? 'Aceptando…' : 'Acepto la oferta'}
                  </button>
                  <p className="muted centro">Después firmas el contrato y el pagaré en tu agencia y recibes el dinero en tu cuenta de ahorros.</p>
                </div>
              </Hoja>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PasoSiguiente({ s, onIdentidad, onEnviar, onOferta, ocupado, alSubir }: { s: Detalle; onIdentidad: () => void; onEnviar: () => void; onOferta: () => void; ocupado: boolean; alSubir: () => void }) {
  const sub = s.idSubetapa;
  if (s.estado === 'RECHAZADA') return <Texto t="Tu solicitud no fue aprobada" d="Tu asesor te contactará para revisar alternativas, como un monto o un plazo diferente." />;
  if (s.estado === 'DESEMBOLSADA') return <Texto t="¡Tu crédito ya está en tu cuenta!" d="Revisa tu tabla de amortización y paga tus cuotas desde Inicio." icono />;
  if (s.estado === 'EN_COMITE') return <Texto t="En revisión del comité de crédito" d="Tu caso necesita una revisión adicional. Te avisaremos apenas haya una resolución." />;
  if (s.estado === 'APROBADA') {
    if (s.condicion && !s.condicion.aceptadaSocio) {
      return (<>
        <Texto t="¡Tu crédito fue aprobado!" d={`${dinero(s.condicion.montoAprobado)} con una cuota de ${dinero(s.condicion.cuotaMensual)} durante ${s.condicion.plazoMeses} meses.`} icono />
        <button type="button" className="btn btn-primario btn-bloque btn-grande" onClick={onOferta}>Revisar y aceptar la oferta</button>
      </>);
    }
    return <Texto t={s.condicion?.contratoFirmado ? 'Listo para el desembolso' : 'Firma en tu agencia'} d={s.condicion?.contratoFirmado ? 'Operaciones acreditará el dinero en tu cuenta de ahorros.' : 'Acércate con tu cédula para firmar el contrato y el pagaré.'} icono />;
  }
  if (sub === '1.1' || sub === '1.2') {
    return (<>
      <Texto t="Verifica tu identidad" d="Comparamos tu selfie con tu foto del Registro Civil y revisamos listas de control. Toma menos de un minuto." />
      <label className="btn btn-primario btn-bloque btn-grande selfie">
        <ScanFace size={20} aria-hidden /> {ocupado ? 'Verificando…' : 'Tomar selfie y verificar'}
        <input type="file" accept="image/*" capture="user" className="sr-only" disabled={ocupado} onChange={(e) => { if (e.target.files?.length) onIdentidad(); }} />
      </label>
    </>);
  }
  if (sub === '1.3') return <Documentos s={s} onEnviar={onEnviar} ocupado={ocupado} alSubir={alSubir} />;
  return (<>
    <Texto t="Lista para evaluación" d="Consultaremos tu historial en la cooperativa y la central de riesgos con tu autorización, y te daremos una respuesta." />
    <button type="button" className="btn btn-primario btn-bloque btn-grande" disabled={ocupado} onClick={onEnviar}><Send size={18} aria-hidden /> {ocupado ? 'Evaluando…' : 'Enviar a evaluación'}</button>
  </>);
}

function Texto({ t, d, icono }: { t: string; d: string; icono?: boolean }) {
  return <div className="paso-texto">{icono && <CircleCheck size={28} aria-hidden className="ok" />}<h2 id="t-sig">{t}</h2><p className="suave">{d}</p></div>;
}

function Documentos({ s, onEnviar, ocupado, alSubir }: { s: Detalle; onEnviar: () => void; ocupado: boolean; alSubir: () => void }) {
  const aviso = useAviso();
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const tipos = s.documentos.map((d) => d.tipo);
  const tiene = (t: string) => t === 'RUC_RISE' ? tipos.some((x) => ['RUC_RISE', 'ROL_PAGOS', 'DECLARACION_SRI'].includes(x)) : tipos.includes(t);
  const completos = DOCS.every((d) => tiene(d.tipo));
  const entradas = useRef<Record<string, HTMLInputElement | null>>({});

  async function subir(tipo: string, archivo: File) {
    setSubiendo(tipo);
    const f = new FormData(); f.append('tipo', tipo); f.append('archivo', archivo);
    try { await api(`/movil/solicitudes/${s.idSolicitud}/documentos`, { formulario: f }); alSubir(); aviso('Documento guardado.'); }
    catch (e) { aviso(mensaje(e), 'error'); }
    finally { setSubiendo(null); }
  }

  return (<>
    <Texto t="Sube tus documentos" d="Toma una foto clara o sube un PDF. Se guardan en tu expediente digital, cifrados en la nube privada de la cooperativa." />
    <ul className="docs">
      {DOCS.map((d) => (
        <li key={d.tipo} className={tiene(d.tipo) ? 'ok' : ''}>
          {tiene(d.tipo) ? <CircleCheck size={22} aria-hidden /> : <FileUp size={22} aria-hidden />}
          <span>{d.texto}</span>
          {!tiene(d.tipo) && (
            <button type="button" className="btn btn-chico" disabled={!!subiendo} onClick={() => entradas.current[d.tipo]?.click()}>
              <Camera size={16} aria-hidden /> {subiendo === d.tipo ? 'Subiendo…' : 'Subir'}
            </button>
          )}
          <input ref={(el) => { entradas.current[d.tipo] = el; }} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" className="sr-only"
            tabIndex={-1} aria-hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(d.tipo, f); e.target.value = ''; }} />
        </li>
      ))}
    </ul>
    <button type="button" className="btn btn-primario btn-bloque btn-grande" disabled={!completos || ocupado} onClick={onEnviar}>
      <Send size={18} aria-hidden /> {ocupado ? 'Evaluando tu solicitud…' : 'Enviar a evaluación'}
    </button>
  </>);
}
