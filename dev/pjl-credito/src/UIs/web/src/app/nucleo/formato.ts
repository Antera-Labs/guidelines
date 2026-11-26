import { Injectable, Pipe, PipeTransform, signal } from '@angular/core';

// Montos como en el tarifario de la cooperativa ($80,000.00); porcentajes con coma decimal (24,09 %).
const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const USD0 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const FECHA = new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', year: 'numeric' });
const FECHA_HORA = new Intl.DateTimeFormat('es-EC', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function dinero(v: unknown, sinCentavos = false): string {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  return Number.isFinite(n) ? (sinCentavos ? USD0 : USD).format(n) : '—';
}

export function porcentaje(v: unknown, decimales = 1, esFraccion = false): string {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v) * (esFraccion ? 100 : 1);
  return Number.isFinite(n)
    ? `${n.toLocaleString('es-EC', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })} %`
    : '—';
}

export function fecha(v: unknown, conHora = false): string {
  if (!v) return '—';
  const d = new Date(String(v).length === 10 ? `${v}T12:00:00` : String(v));
  return Number.isNaN(d.getTime()) ? '—' : (conHora ? FECHA_HORA : FECHA).format(d);
}

export function duracionHoras(h: unknown): string {
  const n = Number(h);
  if (!Number.isFinite(n)) return '—';
  if (n < 1) return 'menos de 1 h';
  if (n < 48) return `${Math.round(n)} h`;
  return `${(n / 24).toLocaleString('es-EC', { maximumFractionDigits: 1 })} días`;
}

export function enmascarar(ced: string | null | undefined): string {
  return ced && ced.length > 4 ? '•••• ' + ced.slice(-4) : (ced ?? '');
}

const ETIQUETAS: Record<string, string> = {
  MICROCREDITO: 'Microcrédito',
  UNION_LIBRE: 'Unión libre',
  PRODUCCION: 'Producción',
  TECNICO: 'Técnico',
  VEHICULO: 'Vehículo',
  NO_SATISFACTORIO: 'No satisfactorio',
  PROMESA_PAGO: 'Promesa de pago',
  ACUERDO_PAGO: 'Acuerdo de pago',
  NOTIFICACION: 'Notificación',
  GARANTE_PERSONAL: 'Garante personal',
  SOBRE_FIRMAS: 'Sobre firmas',
  AHORRO_ENCAJE: 'Encaje de ahorro',
  MOVIL: 'App móvil',
  DEBITO_AUTOMATICO: 'Débito automático',
  SUJETO_VERIFICACION: 'Sujeto a verificación',
  EMPLEADO_PUBLICO: 'Empleado público',
  QUEHACERES_DOMESTICOS: 'Quehaceres domésticos',
  CUARTO_NIVEL: 'Cuarto nivel',
  DECLARACION_SRI: 'Declaración SRI',
  ROL_PAGOS: 'Rol de pagos',
  RUC_RISE: 'RUC o RISE',
  PLANILLA_SERVICIO: 'Planilla de servicio',
  RESPALDO_GARANTIA: 'Respaldo de garantía',
  CEDULA: 'Cédula',
  CENTRAL_RIESGOS_SEPS: 'Central de riesgos SB/SEPS',
  BURO_CREDITO: 'Buró de crédito',
  DEFICIENTE: 'Deficiente',
  SIN_HISTORIAL: 'Sin historial',
  NEGOCIO_PROPIO: 'Negocio propio',
  HONORARIOS: 'Por honorarios',
  PAGO_REALIZADO: 'Pago realizado',
  NO_CONTACTADO: 'No contactado',
  HIPOTECARIA: 'Hipotecaria',
  PRENDARIA: 'Prendaria',
  CASA: 'Casa',
  LOTE: 'Lote',
  DEPARTAMENTO: 'Departamento',
  AGENCIA: 'Agencia',
};

export function etiqueta(valor: string | null | undefined): string {
  if (!valor) return '—';
  if (ETIQUETAS[valor]) return ETIQUETAS[valor];
  const s = valor.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

@Pipe({ name: 'dinero' })
export class DineroPipe implements PipeTransform {
  transform(v: unknown, sinCentavos = false) {
    return dinero(v, sinCentavos);
  }
}

@Pipe({ name: 'pct' })
export class PctPipe implements PipeTransform {
  transform(v: unknown, decimales = 1, esFraccion = false) {
    return porcentaje(v, decimales, esFraccion);
  }
}

export function numero(v: unknown, decimales = 0): string {
  const n = Number(v);
  return v === null || v === undefined || !Number.isFinite(n)
    ? '—'
    : n.toLocaleString('es-EC', {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales,
      });
}

@Pipe({ name: 'numero' })
export class NumeroPipe implements PipeTransform {
  transform(v: unknown, decimales = 0) {
    return numero(v, decimales);
  }
}

@Pipe({ name: 'fecha' })
export class FechaPipe implements PipeTransform {
  transform(v: unknown, conHora = false) {
    return fecha(v, conHora);
  }
}

@Pipe({ name: 'horas' })
export class HorasPipe implements PipeTransform {
  transform(v: unknown) {
    return duracionHoras(v);
  }
}

@Pipe({ name: 'etiqueta' })
export class EtiquetaPipe implements PipeTransform {
  transform(v: string | null | undefined) {
    return etiqueta(v);
  }
}

@Pipe({ name: 'cedula' })
export class CedulaPipe implements PipeTransform {
  transform(v: string | null | undefined) {
    return enmascarar(v);
  }
}

export const FORMATOS = [
  DineroPipe,
  PctPipe,
  NumeroPipe,
  FechaPipe,
  HorasPipe,
  EtiquetaPipe,
  CedulaPipe,
];

export interface Aviso {
  id: number;
  tipo: 'ok' | 'error' | 'info';
  texto: string;
}

/** Avisos efímeros (toasts) en una región aria-live. */
@Injectable({ providedIn: 'root' })
export class Avisos {
  readonly lista = signal<Aviso[]>([]);
  private sec = 0;

  mostrar(texto: string, tipo: Aviso['tipo'] = 'ok', ms = 4500): void {
    const id = ++this.sec;
    this.lista.update((l) => [...l.slice(-2), { id, tipo, texto }]);
    setTimeout(() => this.cerrar(id), ms);
  }

  cerrar(id: number): void {
    this.lista.update((l) => l.filter((a) => a.id !== id));
  }
}
