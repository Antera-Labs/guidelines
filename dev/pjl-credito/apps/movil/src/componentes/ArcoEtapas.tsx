import { ETAPAS } from '../formato';

const SUBETAPAS = ['1.1', '1.2', '1.3', '2.1', '2.2', '2.3', '3.1', '3.2', '3.3', '3.4', '4.1', '4.2', '4.3', '5.1', '5.2', '6.1'];

interface Props { etapa: number; subetapa: string; estado: string; tam?: number; claro?: boolean; }

/** Punto de un arco de 180° (izquierda → derecha) con centro (100, 100). */
function punto(r: number, t: number): [number, number] {
  const a = Math.PI * (1 - t);
  return [100 + r * Math.cos(a), 100 - r * Math.sin(a)];
}

function segmento(r: number, t0: number, t1: number): string {
  const [x0, y0] = punto(r, t0);
  const [x1, y1] = punto(r, t1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/**
 * Firma visual: los arcos del escudo PJL como medidor del Value Stream.
 * Arco exterior: 6 etapas (hecha / actual / pendiente / cerrada). Arco interior ocre: avance por subetapa.
 */
export function ArcoEtapas({ etapa, subetapa, estado, tam = 220, claro = false }: Props) {
  const desembolsada = estado === 'DESEMBOLSADA';
  const cerrada = estado === 'RECHAZADA' || estado === 'ANULADA';
  const actual = desembolsada ? 6 : etapa;
  const avance = desembolsada ? 1 : Math.max(0.04, (SUBETAPAS.indexOf(subetapa) + 1) / SUBETAPAS.length);
  const hueco = 0.012;
  const nombre = ETAPAS[actual - 1]?.paraSocio ?? '';
  const etiqueta = cerrada ? `Solicitud cerrada en la etapa ${etapa} de 6` : `Etapa ${actual} de 6: ${ETAPAS[actual - 1]?.nombre}`;

  return (
    <figure className={`arco ${claro ? 'arco-claro' : ''}`} style={{ width: tam }} role="img" aria-label={etiqueta}>
      <svg viewBox="0 0 200 108" aria-hidden="true">
        {ETAPAS.map((e, i) => {
          const t0 = i / 6 + hueco;
          const t1 = (i + 1) / 6 - hueco;
          const clase = e.id < actual || (desembolsada && e.id < 6) ? 'hecha' : e.id === actual ? (cerrada ? 'cerrada' : 'actual') : 'pendiente';
          return <path key={e.id} d={segmento(84, t0, t1)} className={`seg ${clase}`} />;
        })}
        <path d={segmento(66, 0, 1)} className="pista" />
        <path d={segmento(66, 0, avance)} className={`avance ${cerrada ? 'cerrada' : ''}`} />
      </svg>
      <figcaption>
        <span className="arco-num">{cerrada ? 'Cerrada' : `Etapa ${actual} de 6`}</span>
        <strong>{cerrada ? 'No aprobada' : nombre}</strong>
      </figcaption>
    </figure>
  );
}
