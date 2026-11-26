import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, FilePlus2, Landmark, PiggyBank, ShieldCheck, Wallet } from 'lucide-react';
import { api, mensaje, type Credito, type Inicio as DatosInicio } from '../api';
import { ArcoEtapas } from '../componentes/ArcoEtapas';
import { ErrorCaja, Esqueleto } from '../componentes/Base';
import { dinero, diasHasta, fecha, ultimos4 } from '../formato';
import { PagarCuota } from './Credito';

export function Inicio() {
  const consulta = useQuery({
    queryKey: ['inicio'],
    queryFn: () => api<DatosInicio>('/movil/inicio'),
  });
  const cliente = useQueryClient();
  const [pagando, setPagando] = useState<Credito | null>(null);
  const d = consulta.data;
  const activa = d?.solicitudes[0];
  const proximo = d?.creditos
    .filter((c) => c.proximoVencimiento)
    .sort((a, b) => (a.proximoVencimiento! < b.proximoVencimiento! ? -1 : 1))[0];
  const ahorro = d?.cuentas.find((c) => c.tipo === 'AHORRO_VISTA');

  return (
    <div className="pagina-inicio">
      <section className="cielo">
        <div className="cielo-cont">
          <p className="saludo">{d ? `Hola, ${d.socio.nombres.split(' ')[0]}` : 'Hola'}</p>
          {d && (
            <p className="suave-claro">
              Socio {d.socio.numeroSocio} · Agencia {d.socio.agencia}
            </p>
          )}
          {activa ? (
            <Link to={`/solicitudes/${activa.idSolicitud}`} className="arco-tarjeta">
              <ArcoEtapas
                etapa={activa.idEtapa}
                subetapa={activa.idSubetapa}
                estado={activa.estado}
                claro
                tam={200}
              />
              <div className="arco-texto">
                <span className="suave-claro">
                  {activa.numero} · {activa.producto}
                </span>
                <strong>{dinero(activa.montoAprobado ?? activa.montoSolicitado)}</strong>
                <span className="cta-claro">
                  {activa.estado === 'APROBADA' && activa.idSubetapa === '5.1'
                    ? 'Revisa y acepta tu oferta'
                    : 'Ver en qué va'}{' '}
                  <ChevronRight size={18} aria-hidden />
                </span>
              </div>
            </Link>
          ) : d ? (
            <Link to="/solicitar" className="arco-tarjeta vacia">
              <FilePlus2 size={28} aria-hidden />
              <div className="arco-texto">
                <strong>Solicita tu crédito</strong>
                <span className="suave-claro">
                  Respuesta automática para montos de hasta $20,000.00.
                </span>
              </div>
              <ChevronRight size={20} aria-hidden />
            </Link>
          ) : null}
        </div>
        <svg className="terrazas-cielo" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden>
          <path
            d="M0 40V14Q33 6 66 14V20Q100 13 133 20V25Q166 20 200 25V29Q233 25 266 29V32Q300 29 333 32V34Q366 32 400 34V40Z"
            fill="#f5b500"
          />
        </svg>
      </section>

      <div className="contenido-inicio">
        {consulta.isPending && <Esqueleto alto={96} n={3} />}
        {consulta.isError && (
          <ErrorCaja texto={mensaje(consulta.error)} reintentar={() => consulta.refetch()} />
        )}
        {d && (
          <>
            {proximo && (
              <section className="tarjeta cuota-proxima" aria-labelledby="t-cuota">
                <div>
                  <h2 id="t-cuota">Próxima cuota</h2>
                  <p className="cifra-grande">
                    {dinero(proximo.montoVencido > 0 ? proximo.montoVencido : proximo.cuotaMensual)}
                  </p>
                  <p className={proximo.diasMora > 0 ? 'texto-alerta' : 'suave'}>
                    {proximo.diasMora > 0
                      ? `Vencida hace ${proximo.diasMora} días`
                      : textoVence(proximo.proximoVencimiento)}{' '}
                    · {proximo.numeroOperacion}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-primario"
                  onClick={() => setPagando(proximo)}
                >
                  Pagar cuota
                </button>
              </section>
            )}

            <section aria-labelledby="t-cuentas">
              <h2 id="t-cuentas" className="titulo-seccion">
                Tus cuentas
              </h2>
              <ul className="lista tarjeta">
                {d.cuentas.map((c) => (
                  <li key={c.numero}>
                    <span className="icono-redondo">
                      {c.tipo === 'AHORRO_VISTA' ? (
                        <Wallet size={20} aria-hidden />
                      ) : c.tipo === 'PLAZO_FIJO' ? (
                        <Landmark size={20} aria-hidden />
                      ) : (
                        <PiggyBank size={20} aria-hidden />
                      )}
                    </span>
                    <span className="lista-texto">
                      <strong>{c.nombre}</strong>
                      <span className="muted">{ultimos4(c.numero)}</span>
                    </span>
                    <span className="cifra">{dinero(c.saldo)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="t-creditos">
              <h2 id="t-creditos" className="titulo-seccion">
                Tus créditos
              </h2>
              {d.creditos.length ? (
                <ul className="lista tarjeta">
                  {d.creditos.map((c) => (
                    <li key={c.idCredito}>
                      <Link to={`/creditos/${c.idCredito}`} className="fila-link">
                        <span className="lista-texto">
                          <strong>{c.producto}</strong>
                          <span className="muted">
                            {c.cuotasPagadas} de {c.plazoMeses} cuotas · {c.numeroOperacion}
                          </span>
                          <span className="progreso" aria-hidden>
                            <i style={{ width: `${(c.cuotasPagadas / c.plazoMeses) * 100}%` }} />
                          </span>
                        </span>
                        <span className="cifra-col">
                          <span className="cifra">{dinero(c.saldoCapital)}</span>
                          <span className="muted">saldo</span>
                        </span>
                        <ChevronRight size={18} aria-hidden className="chev" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="tarjeta vacia-texto">Todavía no tienes créditos activos.</p>
              )}
            </section>

            <section className="tarjeta lopdp-estado" aria-labelledby="t-lopdp">
              <ShieldCheck size={22} aria-hidden />
              <div>
                <h2 id="t-lopdp">Tus datos personales</h2>
                <p className="suave">
                  {d.consentimiento
                    ? `Autorizaste la consulta a la central de riesgos hasta el ${fecha(d.consentimiento.vigenteHasta)}.`
                    : 'No tienes una autorización vigente. Se firma al solicitar un crédito.'}
                </p>
              </div>
              <Link to="/perfil#autorizaciones" className="btn btn-chico">
                Revisar
              </Link>
            </section>

            <section aria-labelledby="t-avisos">
              <h2 id="t-avisos" className="titulo-seccion">
                Avisos de la cooperativa
              </h2>
              <div className="avisos-lista">
                {d.avisos.map((a) => (
                  <article key={a.id} className="tarjeta aviso-coop">
                    <h3>{a.titulo}</h3>
                    <p className="suave">{a.texto}</p>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
      {pagando && ahorro && (
        <PagarCuota
          credito={pagando}
          cuenta={ahorro}
          abierta={!!pagando}
          alCerrar={() => setPagando(null)}
          alPagar={() => {
            cliente.invalidateQueries({ queryKey: ['inicio'] });
          }}
        />
      )}
    </div>
  );
}

function textoVence(v: string | null) {
  const n = diasHasta(v);
  if (n === null) return '';
  if (n === 0) return 'Vence hoy';
  if (n === 1) return 'Vence mañana';
  return `Vence el ${fecha(v)}`;
}
