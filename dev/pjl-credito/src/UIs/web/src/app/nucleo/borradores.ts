import { Injectable, inject, signal } from '@angular/core';
import { Sesion } from './api';

/** Una solicitud a medio llenar: el modelo del formulario y el paso en que quedó. */
export interface Borrador {
  id: string;
  actualizado: number;
  paso: number;
  visitado: number;
  m: Record<string, any>;
  socio: Record<string, any> | null;
}

const MAXIMO = 12;

/**
 * Borradores de «Nueva solicitud» del usuario actual.
 * Se guardan en sessionStorage: sobreviven a recargas y a una sesión vencida en la misma pestaña,
 * y se borran al cerrar la pestaña o la sesión, porque contienen datos personales del socio (LOPDP).
 */
@Injectable({ providedIn: 'root' })
export class Borradores {
  private readonly sesion = inject(Sesion);
  readonly lista = signal<Borrador[]>([]);

  private clave(): string {
    return `pjl.web.borradores.${this.sesion.usuario()?.usuario ?? 'anonimo'}`;
  }

  cargar(): Borrador[] {
    let l: Borrador[] = [];
    try {
      l = JSON.parse(sessionStorage.getItem(this.clave()) ?? '[]');
    } catch {
      l = [];
    }
    if (!Array.isArray(l)) l = [];
    this.lista.set(l);
    return l;
  }

  obtener(id: string): Borrador | null {
    return this.cargar().find((b) => b.id === id) ?? null;
  }

  guardar(b: Borrador): void {
    const l = [b, ...this.cargar().filter((x) => x.id !== b.id)]
      .sort((a, c) => c.actualizado - a.actualizado)
      .slice(0, MAXIMO);
    this.escribir(l);
  }

  quitar(id: string): void {
    this.escribir(this.cargar().filter((b) => b.id !== id));
  }

  /** Al cerrar sesión: no dejar datos de socios en el navegador. */
  limpiar(): void {
    try {
      sessionStorage.removeItem(this.clave());
    } catch {
      /* sin almacenamiento */
    }
    this.lista.set([]);
  }

  private escribir(l: Borrador[]): void {
    this.lista.set(l);
    try {
      sessionStorage.setItem(this.clave(), JSON.stringify(l));
    } catch {
      /* sin almacenamiento: quedan solo en memoria */
    }
  }
}

export function nuevoIdBorrador(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** «hace 3 min», «hace 2 h», o la fecha si es de otro día. */
export function haceCuanto(ts: number): string {
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(ts).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' });
}
