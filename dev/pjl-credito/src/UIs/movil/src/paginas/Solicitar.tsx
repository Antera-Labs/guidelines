import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check, ShieldCheck } from 'lucide-react';
import { api, mensaje, type Producto, type Simulacion } from '../api';
import { ErrorCaja, Esqueleto, useAviso } from '../componentes/Base';
import { dinero, pct } from '../formato';

const PASOS = ['Producto', 'Monto y plazo', 'Tus ingresos', 'Autorización'];
const CONDICIONES = [
  ['COMERCIANTE', 'Comerciante'], ['NEGOCIO_PROPIO', 'Negocio propio'], ['EMPLEADO_PRIVADO', 'Empleado privado'],
  ['EMPLEADO_PUBLICO', 'Empleado público'], ['HONORARIOS', 'Profesional independiente'], ['JUBILADO', 'Jubilado'],
] as const;
const GASTOS = [['alimentacion', 'Alimentación'], ['arriendo', 'Arriendo'], ['servicios', 'Luz, agua, teléfono'], ['transporte', 'Transporte'], ['educacion', 'Educación'], ['salud', 'Salud'], ['deudas', 'Cuotas de otras deudas'], ['otros', 'Otros gastos']] as const;

function Numero({ etiqueta, valor, alCambiar, ayuda, id }: { etiqueta: string; valor: number | ''; alCambiar: (v: number | '') => void; ayuda?: string; id: string }) {
  return (
    <label className="campo" htmlFor={id}>
      <span>{etiqueta}</span>
      <span className="prefijo"><span aria-hidden>$</span><input id={id} className="entrada cifra" inputMode="decimal" type="number" min={0} value={valor}
        onChange={(e) => alCambiar(e.target.value === '' ? '' : Number(e.target.value))} /></span>
      {ayuda && <small className="muted">{ayuda}</small>}
    </label>
  );
}

export function Solicitar() {
  const navegar = useNavigate();
  const aviso = useAviso();
  const productos = useQuery({ queryKey: ['productos'], queryFn: () => api<{ productos: Producto[] }>('/info/productos') });
  const [paso, setPaso] = useState(0);
  const [segmento, setSegmento] = useState<'MICROCREDITO' | 'CONSUMO'>('MICROCREDITO');
  const [idProducto, setIdProducto] = useState<number | null>(null);
  const [monto, setMonto] = useState(3000);
  const [plazo, setPlazo] = useState(12);
  const [destino, setDestino] = useState('');
  const [condicion, setCondicion] = useState('COMERCIANTE');
  const [empresa, setEmpresa] = useState('');
  const [meses, setMeses] = useState<number | ''>('');
  const [ingreso, setIngreso] = useState<number | ''>('');
  const [ingresoConyuge, setIngresoConyuge] = useState<number | ''>('');
  const [ahorros, setAhorros] = useState<number | ''>('');
  const [gastos, setGastos] = useState<Record<string, number | ''>>({});
  const [acepta, setAcepta] = useState(false);
  const [esPep, setEsPep] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const producto = productos.data?.productos.find((p) => p.id === idProducto) ?? null;
  const [sim, setSim] = useState<Simulacion | null>(null);
  useEffect(() => {
    if (!producto) return;
    const t = setTimeout(() => {
      api<Simulacion>('/info/simulacion', { cuerpo: { idProducto: producto.id, monto, plazoMeses: plazo } }).then(setSim).catch(() => setSim(null));
    }, 250);
    return () => clearTimeout(t);
  }, [producto, monto, plazo]);

  const totalGastos = useMemo(() => Object.values(gastos).reduce<number>((a, v) => a + (Number(v) || 0), 0), [gastos]);
  const totalIngresos = (Number(ingreso) || 0) + (Number(ingresoConyuge) || 0);
  const disponible = totalIngresos - totalGastos;

  const crear = useMutation({
    mutationFn: () => api<{ idSolicitud: number; numero: string }>('/movil/solicitudes', {
      cuerpo: {
        idProducto, monto, plazoMeses: plazo, destino, esPep,
        actividad: { condicion, empresa: empresa || null, tiempoTrabajoMeses: meses || null, sector: condicion === 'COMERCIANTE' ? 'COMERCIO' : null },
        ingresos: { principal: Number(ingreso) || 0, conyuge: Number(ingresoConyuge) || 0 },
        egresos: Object.fromEntries(Object.entries(gastos).map(([k, v]) => [k, Number(v) || 0])),
        ahorros: Number(ahorros) || 0,
        autorizacion: { acepta: true, actividadEconomica: CONDICIONES.find((c) => c[0] === condicion)?.[1] },
      },
    }),
    onSuccess: (r) => { aviso(`Solicitud ${r.numero} creada. Ahora verifica tu identidad.`); navegar(`/solicitudes/${r.idSolicitud}`, { replace: true }); },
  });

  function siguiente(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (paso === 0 && !producto) return setError('Elige el tipo de crédito.');
    if (paso === 1) {
      if (!producto || monto < producto.montoMinimo || monto > producto.montoMaximo) return setError(`El monto va de ${dinero(producto?.montoMinimo)} a ${dinero(producto?.montoMaximo)}.`);
      if (plazo < 1 || plazo > (producto?.plazoMaximoMeses ?? 0)) return setError(`El plazo máximo es ${producto?.plazoMaximoMeses} meses.`);
      if (destino.trim().length < 5) return setError('Cuéntanos para qué usarás el dinero.');
    }
    if (paso === 2) {
      if (!ingreso || Number(ingreso) <= 0) return setError('Ingresa tu ingreso mensual.');
      if (!meses) return setError('¿Cuántos meses llevas en esta actividad?');
    }
    if (paso === 3) {
      if (!acepta) return setError('Para evaluar tu crédito necesitamos tu autorización.');
      crear.mutate();
      return;
    }
    setPaso(paso + 1);
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="pagina">
      <header className="cab-flujo">
        {paso > 0 ? <button type="button" className="volver" onClick={() => setPaso(paso - 1)}><ArrowLeft size={18} aria-hidden /> Atrás</button> : <span />}
        <h1>Solicitar crédito</h1>
        <ol className="pasos-flujo" aria-label="Pasos">
          {PASOS.map((p, i) => (
            <li key={p} className={i < paso ? 'hecho' : i === paso ? 'actual' : ''} aria-current={i === paso ? 'step' : undefined}>
              <span>{i < paso ? <Check size={14} strokeWidth={3} aria-hidden /> : i + 1}</span>{p}
            </li>
          ))}
        </ol>
      </header>

      <form onSubmit={siguiente} noValidate className="pila">
        {paso === 0 && (
          productos.isPending ? <Esqueleto alto={84} n={4} /> : productos.isError ? <ErrorCaja texto={mensaje(productos.error)} /> : (
            <fieldset className="opciones-producto">
              <legend className="titulo-seccion">¿Qué tipo de crédito necesitas?</legend>
              <div className="chips-op" role="group" aria-label="Segmento">
                {([['MICROCREDITO', 'Para mi negocio'], ['CONSUMO', 'Para mí o mi hogar']] as const).map(([v, t]) => (
                  <label key={v} className="chip-op"><input type="radio" name="segmento" checked={segmento === v} onChange={() => setSegmento(v)} /><span>{t}</span></label>
                ))}
              </div>
              {productos.data!.productos.filter((p) => p.segmento === segmento).map((p) => (
                <label key={p.id} className={`producto ${idProducto === p.id ? 'sel' : ''}`}>
                  <input type="radio" name="producto" value={p.id} checked={idProducto === p.id} onChange={() => { setIdProducto(p.id); setPlazo(Math.min(plazo, p.plazoMaximoMeses)); setMonto(Math.min(Math.max(monto, p.montoMinimo), p.montoMaximo)); }} />
                  <span className="p-texto"><strong>{p.nombre}</strong><span className="muted">{p.segmento === 'CONSUMO' ? 'Consumo' : p.subsegmento} · hasta {dinero(p.montoMaximo)} a {p.plazoMaximoMeses} meses</span></span>
                  <span className="p-tasa">{pct(p.tasaReferencial)}</span>
                </label>
              ))}
            </fieldset>
          )
        )}

        {paso === 1 && producto && (
          <>
            <div className="tarjeta pila">
              <label className="campo"><span>Monto</span>
                <span className="prefijo grande"><span aria-hidden>$</span><input className="entrada cifra" type="number" inputMode="decimal" min={producto.montoMinimo} max={producto.montoMaximo} step={50} value={monto} onChange={(e) => setMonto(Number(e.target.value))} /></span>
                <input type="range" min={producto.montoMinimo} max={Math.min(producto.montoMaximo, 50000)} step={50} value={Math.min(monto, 50000)} onChange={(e) => setMonto(Number(e.target.value))} aria-label="Ajustar monto" />
              </label>
              <label className="campo"><span>Plazo: {plazo} meses</span>
                <input type="range" min={1} max={producto.plazoMaximoMeses} value={plazo} onChange={(e) => setPlazo(Number(e.target.value))} aria-label="Plazo en meses" />
              </label>
              <label className="campo"><span>¿Para qué usarás el dinero?</span>
                <input className="entrada" value={destino} maxLength={250} onChange={(e) => setDestino(e.target.value)} placeholder="Ej.: comprar mercadería para mi tienda" /></label>
            </div>
            {sim && (
              <dl className="tarjeta resultado-sim" aria-live="polite">
                <div className="principal"><dt>Cuota mensual referencial</dt><dd>{dinero(sim.cuota)}</dd></div>
                <div><dt>Tasa nominal</dt><dd>{pct(sim.tasaNominal)}</dd></div>
                <div><dt>Tasa efectiva</dt><dd>{pct(sim.tasaEfectiva)}</dd></div>
                <div><dt>Intereses</dt><dd>{dinero(sim.totalIntereses)}</dd></div>
                <div><dt>Total a pagar</dt><dd>{dinero(sim.totalPagar)}</dd></div>
              </dl>
            )}
          </>
        )}

        {paso === 2 && (
          <>
            <fieldset className="tarjeta pila">
              <legend className="titulo-seccion">Tu actividad</legend>
              <div className="chips-op" role="radiogroup" aria-label="Actividad">
                {CONDICIONES.map(([v, t]) => (
                  <label key={v} className="chip-op"><input type="radio" name="condicion" checked={condicion === v} onChange={() => setCondicion(v)} /><span>{t}</span></label>
                ))}
              </div>
              <label className="campo"><span>Nombre del negocio o empresa</span><input className="entrada" value={empresa} onChange={(e) => setEmpresa(e.target.value)} /></label>
              <label className="campo"><span>Meses en esta actividad</span><input className="entrada cifra" type="number" inputMode="numeric" min={0} value={meses} onChange={(e) => setMeses(e.target.value === '' ? '' : Number(e.target.value))} /></label>
            </fieldset>
            <fieldset className="tarjeta pila">
              <legend className="titulo-seccion">Ingresos al mes</legend>
              <Numero id="ing" etiqueta={condicion === 'COMERCIANTE' || condicion === 'NEGOCIO_PROPIO' ? 'Ganancia o ventas de tu negocio' : 'Sueldo o pensión'} valor={ingreso} alCambiar={setIngreso} />
              <Numero id="ingc" etiqueta="Ingreso de tu cónyuge (si aplica)" valor={ingresoConyuge} alCambiar={setIngresoConyuge} />
              <Numero id="aho" etiqueta="Ahorros en bancos o cooperativas" valor={ahorros} alCambiar={setAhorros} />
            </fieldset>
            <fieldset className="tarjeta gastos">
              <legend className="titulo-seccion">Gastos al mes</legend>
              {GASTOS.map(([k, t]) => <Numero key={k} id={`g-${k}`} etiqueta={t} valor={gastos[k] ?? ''} alCambiar={(v) => setGastos({ ...gastos, [k]: v })} />)}
            </fieldset>
            <p className={`tarjeta disponible ${disponible < 0 ? 'neg' : ''}`} aria-live="polite">
              <span>Te queda al mes</span><strong>{dinero(disponible)}</strong>
              {sim && <small>Cuota estimada {dinero(sim.cuota)}{totalIngresos > 0 ? ` · ${Math.round((sim.cuota / totalIngresos) * 100)} % de tus ingresos` : ''}</small>}
            </p>
          </>
        )}

        {paso === 3 && (
          <section className="tarjeta pila autorizacion">
            <h2><ShieldCheck size={20} aria-hidden /> Autorización de consulta y uso de datos personales</h2>
            <p>Autorizo de manera expresa a la Cooperativa de Ahorro y Crédito «Padre Julián Lorente Ltda.» para que realice las consultas que creyere convenientes y necesarias en la central de riesgo en cualquier tiempo.</p>
            <p>En cumplimiento de la Ley Orgánica de Protección de Datos Personales, autorizo el tratamiento de mis datos personales, inclusive datos sensibles como biométricos, de salud, crediticios y transaccionales.</p>
            <p className="muted">Puedes revisar o revocar esta autorización cuando quieras desde tu perfil. Vigencia: 24 meses.</p>
            <label className="check"><input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} /> <span>Leí y autorizo. Firmo con mi sesión de PJL Móvil.</span></label>
            <label className="check"><input type="checkbox" checked={esPep} onChange={(e) => setEsPep(e.target.checked)} /> <span>Soy persona expuesta políticamente (PEP).</span></label>
            <div className="resumen-final">
              <span>{producto?.nombre}</span><strong>{dinero(monto)} a {plazo} meses</strong>{sim && <span>Cuota referencial {dinero(sim.cuota)}</span>}
            </div>
          </section>
        )}

        {error && <p className="error" role="alert">{error}</p>}
        {crear.isError && <ErrorCaja texto={mensaje(crear.error)} />}
        <div className="pie-flujo">
          <button className="btn btn-primario btn-bloque btn-grande" type="submit" disabled={crear.isPending}>
            {paso === 3 ? (crear.isPending ? 'Enviando…' : 'Firmar y enviar solicitud') : 'Continuar'}
          </button>
        </div>
      </form>
    </div>
  );
}
