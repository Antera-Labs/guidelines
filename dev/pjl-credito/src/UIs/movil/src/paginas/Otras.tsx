import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, LogOut, ShieldCheck, ShieldOff } from 'lucide-react';
import { api, leerSesion, mensaje, type Inicio, type Producto, type Simulacion } from '../api';
import { ErrorCaja, Esqueleto, Hoja, salir, useAviso } from '../componentes/Base';
import { dinero, fechaLarga, pct } from '../formato';

export function Simulador() {
  const productos = useQuery({
    queryKey: ['productos'],
    queryFn: () => api<{ productos: Producto[]; meta: { nota: string } }>('/info/productos'),
  });
  const [id, setId] = useState(7);
  const [monto, setMonto] = useState(5000);
  const [plazo, setPlazo] = useState(24);
  const [sim, setSim] = useState<Simulacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const p = productos.data?.productos.find((x) => x.id === id);
  const conSesion = !!leerSesion();

  useEffect(() => {
    if (!p) return;
    const t = setTimeout(() => {
      api<Simulacion>('/info/simulacion', { cuerpo: { idProducto: id, monto, plazoMeses: plazo } })
        .then((r) => {
          setSim(r);
          setError(null);
        })
        .catch((e) => {
          setSim(null);
          setError(mensaje(e));
        });
    }, 200);
    return () => clearTimeout(t);
  }, [p, id, monto, plazo]);

  return (
    <div className="pagina">
      {!conSesion && (
        <Link to="/ingreso" className="volver">
          <ArrowLeft size={18} aria-hidden /> Ingresar
        </Link>
      )}
      <h1>Simula tu crédito</h1>
      <p className="suave">Con el tarifario vigente publicado por la cooperativa.</p>
      {productos.isPending ? (
        <Esqueleto />
      ) : productos.isError ? (
        <ErrorCaja texto={mensaje(productos.error)} />
      ) : (
        <div className="simulador-rejilla">
          <div className="tarjeta pila">
            <label className="campo">
              <span>Producto</span>
              <select
                className="entrada"
                value={id}
                onChange={(e) => {
                  const n = productos.data!.productos.find((x) => x.id === Number(e.target.value))!;
                  setId(n.id);
                  setMonto(Math.min(Math.max(monto, n.montoMinimo), n.montoMaximo));
                  setPlazo(Math.min(plazo, n.plazoMaximoMeses));
                }}
              >
                <optgroup label="Microcrédito">
                  {productos
                    .data!.productos.filter((x) => x.segmento === 'MICROCREDITO')
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre} · {x.subsegmento}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Consumo">
                  {productos
                    .data!.productos.filter((x) => x.segmento === 'CONSUMO')
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre}
                      </option>
                    ))}
                </optgroup>
              </select>
            </label>
            <label className="campo">
              <span>Monto</span>
              <span className="prefijo grande">
                <span aria-hidden>$</span>
                <input
                  className="entrada cifra"
                  type="number"
                  inputMode="decimal"
                  value={monto}
                  step={50}
                  onChange={(e) => setMonto(Number(e.target.value))}
                />
              </span>
              {p && (
                <input
                  type="range"
                  min={p.montoMinimo}
                  max={Math.min(p.montoMaximo, 50000)}
                  step={50}
                  value={Math.min(monto, 50000)}
                  onChange={(e) => setMonto(Number(e.target.value))}
                  aria-label="Ajustar monto"
                />
              )}
            </label>
            <label className="campo">
              <span>Plazo: {plazo} meses</span>
              {p && (
                <input
                  type="range"
                  min={1}
                  max={p.plazoMaximoMeses}
                  value={plazo}
                  onChange={(e) => setPlazo(Number(e.target.value))}
                  aria-label="Plazo en meses"
                />
              )}
            </label>
            {p && (
              <p className="muted">
                {p.descripcion} De {dinero(p.montoMinimo)} a {dinero(p.montoMaximo)}.
              </p>
            )}
          </div>
          <div className="pila">
            {error && <ErrorCaja texto={error} />}
            {sim && (
              <dl className="tarjeta resultado-sim" aria-live="polite">
                <div className="principal">
                  <dt>Cuota mensual</dt>
                  <dd>{dinero(sim.cuota)}</dd>
                </div>
                <div>
                  <dt>Tasa nominal</dt>
                  <dd>{pct(sim.tasaNominal)}</dd>
                </div>
                <div>
                  <dt>Tasa efectiva anual</dt>
                  <dd>{pct(sim.tasaEfectiva)}</dd>
                </div>
                <div>
                  <dt>Total de intereses</dt>
                  <dd>{dinero(sim.totalIntereses)}</dd>
                </div>
                <div>
                  <dt>Total a pagar</dt>
                  <dd>{dinero(sim.totalPagar)}</dd>
                </div>
              </dl>
            )}
            {p && (
              <section className="tarjeta pila">
                <h2 className="titulo-seccion">Qué necesitas</h2>
                <ul className="requisitos">
                  {p.requisitos.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </section>
            )}
            <p className="muted">{productos.data!.meta.nota}</p>
            <Link
              to={conSesion ? '/solicitar' : '/ingreso'}
              className="btn btn-primario btn-bloque btn-grande"
            >
              {conSesion ? 'Solicitar este crédito' : 'Ingresa para solicitarlo'}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

interface Consentimiento {
  idConsentimiento: number;
  canal: string;
  fechaOtorgamiento: string;
  vigenteHasta: string;
  revocado: boolean;
  fechaRevocacion: string | null;
}
interface Agencia {
  codigo: string;
  nombre: string;
  canton: string;
  direccion: string;
  horario: string;
}

export function Perfil() {
  const navegar = useNavigate();
  const aviso = useAviso();
  const cliente = useQueryClient();
  const inicio = useQuery({ queryKey: ['inicio'], queryFn: () => api<Inicio>('/movil/inicio') });
  const permisos = useQuery({
    queryKey: ['consentimientos'],
    queryFn: () => api<Consentimiento[]>('/movil/consentimientos'),
  });
  const agencias = useQuery({
    queryKey: ['agencias'],
    queryFn: () => api<{ agencias: Agencia[] }>('/info/agencias'),
  });
  const [revocar, setRevocar] = useState<Consentimiento | null>(null);
  const mutacion = useMutation({
    mutationFn: (c: Consentimiento) =>
      api<Consentimiento[]>(`/movil/consentimientos/${c.idConsentimiento}/revocacion`, {
        metodo: 'POST',
      }),
    onSuccess: (lista) => {
      cliente.setQueryData(['consentimientos'], lista);
      cliente.invalidateQueries({ queryKey: ['inicio'] });
      setRevocar(null);
      aviso('Autorización revocada.');
    },
  });
  const s = inicio.data?.socio;

  return (
    <div className="pagina">
      <h1>Tu perfil</h1>
      {s && (
        <section className="tarjeta pila">
          <h2 className="titulo-seccion">
            {s.nombres} {s.apellidos}
          </h2>
          <dl className="datos">
            <div>
              <dt>Socio</dt>
              <dd>{s.numeroSocio}</dd>
            </div>
            <div>
              <dt>Agencia</dt>
              <dd>{s.agencia}</dd>
            </div>
            <div>
              <dt>Celular</dt>
              <dd>{s.celular}</dd>
            </div>
            <div>
              <dt>Correo</dt>
              <dd>{s.correo}</dd>
            </div>
          </dl>
        </section>
      )}

      <section id="autorizaciones" className="pila" aria-labelledby="t-aut">
        <h2 id="t-aut" className="titulo-seccion">
          Autorizaciones de datos (LOPDP)
        </h2>
        {permisos.isPending ? (
          <Esqueleto alto={64} n={1} />
        ) : permisos.data?.length ? (
          <ul className="lista tarjeta">
            {permisos.data.map((c) => (
              <li key={c.idConsentimiento}>
                <span className={`icono-redondo ${c.revocado ? 'apagado' : ''}`}>
                  {c.revocado ? (
                    <ShieldOff size={20} aria-hidden />
                  ) : (
                    <ShieldCheck size={20} aria-hidden />
                  )}
                </span>
                <span className="lista-texto">
                  <strong>Central de riesgos y datos personales</strong>
                  <span className="muted">
                    {c.revocado
                      ? `Revocada el ${fechaLarga(c.fechaRevocacion)}`
                      : `Firmada el ${fechaLarga(c.fechaOtorgamiento)} · vigente hasta ${fechaLarga(c.vigenteHasta)}`}
                  </span>
                </span>
                {!c.revocado && (
                  <button
                    type="button"
                    className="btn btn-chico btn-peligro"
                    onClick={() => setRevocar(c)}
                  >
                    Revocar
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="tarjeta vacia-texto">No has firmado autorizaciones.</p>
        )}
      </section>

      <section className="pila" aria-labelledby="t-ag">
        <h2 id="t-ag" className="titulo-seccion">
          Agencias
        </h2>
        <ul className="lista tarjeta">
          {agencias.data?.agencias.map((a) => (
            <li key={a.codigo}>
              <span className="icono-redondo">
                <Building2 size={20} aria-hidden />
              </span>
              <span className="lista-texto">
                <strong>{a.nombre}</strong>
                <span className="muted">{a.direccion}</span>
                <span className="muted">{a.horario}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <button type="button" className="btn btn-bloque" onClick={() => salir(navegar)}>
        <LogOut size={18} aria-hidden /> Cerrar sesión
      </button>

      <Hoja abierta={!!revocar} titulo="Revocar autorización" alCerrar={() => setRevocar(null)}>
        <div className="pila">
          <p>
            Si revocas tu autorización, la cooperativa no podrá consultar la central de riesgos ni
            evaluar nuevas solicitudes hasta que firmes otra.
          </p>
          {mutacion.isError && <ErrorCaja texto={mensaje(mutacion.error)} />}
          <button
            type="button"
            className="btn btn-peligro btn-bloque btn-grande"
            disabled={mutacion.isPending}
            onClick={() => revocar && mutacion.mutate(revocar)}
          >
            {mutacion.isPending ? 'Revocando…' : 'Sí, revocar'}
          </button>
          <button type="button" className="btn btn-bloque" onClick={() => setRevocar(null)}>
            Mantener autorización
          </button>
        </div>
      </Hoja>
    </div>
  );
}
