// Montos como en el tarifario de la cooperativa ($8,500.00); porcentajes con coma (21,80 %).
const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const FECHA = new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'long' });
const FECHA_LARGA = new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', year: 'numeric' });
const FECHA_HORA = new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const dinero = (v: number | null | undefined) => (v === null || v === undefined || Number.isNaN(Number(v)) ? '—' : USD.format(Number(v)));
export const pct = (v: number | null | undefined, d = 2) =>
  v === null || v === undefined ? '—' : `${Number(v).toLocaleString('es-EC', { minimumFractionDigits: d, maximumFractionDigits: d })} %`;

function aFecha(v: string): Date { return new Date(v.length === 10 ? `${v}T12:00:00` : v); }
export const fecha = (v: string | null | undefined) => (v ? FECHA.format(aFecha(v)) : '—');
export const fechaLarga = (v: string | null | undefined) => (v ? FECHA_LARGA.format(aFecha(v)) : '—');
export const fechaHora = (v: string | null | undefined) => (v ? FECHA_HORA.format(aFecha(v)) : '—');

export function diasHasta(v: string | null | undefined): number | null {
  if (!v) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return Math.round((aFecha(v).setHours(0, 0, 0, 0) - hoy.getTime()) / 86400000);
}

export const ultimos4 = (n: string) => `•••• ${n.slice(-4)}`;

export const ETAPAS = [
  { id: 1, nombre: 'Solicitud y captación', paraSocio: 'Recibimos tu solicitud' },
  { id: 2, nombre: 'Recolección de datos', paraSocio: 'Revisamos tu información' },
  { id: 3, nombre: 'Evaluación y score', paraSocio: 'Evaluamos tu capacidad de pago' },
  { id: 4, nombre: 'Decisión crediticia', paraSocio: 'Decidimos tu crédito' },
  { id: 5, nombre: 'Formalización y desembolso', paraSocio: 'Firmas y recibes el dinero' },
  { id: 6, nombre: 'Seguimiento y cobranza', paraSocio: 'Pagas tus cuotas' },
];
