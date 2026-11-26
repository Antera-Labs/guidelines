import { HttpClient, HttpErrorResponse, HttpInterceptorFn, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal, computed } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, firstValueFrom, throwError } from 'rxjs';

/** Cliente de core-api. Rutas relativas: en desarrollo el proxy y en producción nginx envían /api al backend. */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1';

  get<T>(
    ruta: string,
    params?: Record<string, string | number | boolean | null | undefined>,
  ): Promise<T> {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(params ?? {}))
      if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
    return firstValueFrom(this.http.get<T>(this.base + ruta, { params: p }));
  }

  post<T>(ruta: string, cuerpo: unknown = {}): Promise<T> {
    return firstValueFrom(this.http.post<T>(this.base + ruta, cuerpo));
  }

  put<T>(ruta: string, cuerpo: unknown): Promise<T> {
    return firstValueFrom(this.http.put<T>(this.base + ruta, cuerpo));
  }

  subir<T>(ruta: string, datos: FormData): Promise<T> {
    return firstValueFrom(this.http.post<T>(this.base + ruta, datos));
  }

  /** Descarga un archivo autenticado y lo guarda con el nombre indicado. */
  async descargar(ruta: string, nombre: string): Promise<void> {
    let archivo: Blob;
    try {
      archivo = await firstValueFrom(this.http.get(this.base + ruta, { responseType: 'blob' }));
    } catch (e) {
      // Con responseType blob, el problem+json del backend llega como Blob: se lee para mostrar su detalle.
      if (e instanceof HttpErrorResponse && e.error instanceof Blob) {
        let cuerpo: unknown = null;
        try {
          cuerpo = JSON.parse(await e.error.text());
        } catch {
          /* sin detalle */
        }
        throw new HttpErrorResponse({
          error: cuerpo,
          status: e.status,
          statusText: e.statusText,
          url: e.url ?? undefined,
        });
      }
      throw e;
    }
    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}

/** Mensaje legible a partir de un error HTTP (application/problem+json del backend). */
export function mensajeError(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) return 'No hay conexión con el servidor. Revisa tu red e intenta de nuevo.';
    const detalle =
      e.error && typeof e.error === 'object' && 'detail' in e.error ? String(e.error.detail) : null;
    return detalle ?? `El servidor respondió ${e.status}.`;
  }
  return 'Ocurrió un error inesperado.';
}

export type Rol =
  'ASESOR' | 'ANALISTA' | 'RIESGO' | 'COMITE' | 'OPERACIONES' | 'CARTERA' | 'COBRANZA' | 'ADMIN';
export interface Usuario {
  usuario: string;
  nombre: string;
  rol: Rol;
  agencia: string;
}

const CLAVE = 'pjl.web.sesion';

@Injectable({ providedIn: 'root' })
export class Sesion {
  private readonly estado = signal<{ token: string; usuario: Usuario; expira: number } | null>(
    leer(),
  );
  readonly usuario = computed(() => this.estado()?.usuario ?? null);
  readonly token = computed(() => {
    const s = this.estado();
    return s && s.expira > Date.now() ? s.token : null;
  });

  iniciar(token: string, usuario: Usuario, expiraEnSeg: number): void {
    const s = { token, usuario, expira: Date.now() + expiraEnSeg * 1000 };
    this.estado.set(s);
    try {
      sessionStorage.setItem(CLAVE, JSON.stringify(s));
    } catch {
      /* almacenamiento no disponible */
    }
  }

  cerrar(): void {
    this.estado.set(null);
    try {
      sessionStorage.removeItem(CLAVE);
    } catch {
      /* sin almacenamiento */
    }
  }

  puede(...roles: Rol[]): boolean {
    const r = this.usuario()?.rol;
    return !!r && (r === 'ADMIN' || roles.includes(r));
  }
}

function leer() {
  try {
    const s = JSON.parse(sessionStorage.getItem(CLAVE) ?? 'null');
    return s && s.expira > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export const interceptorAutenticacion: HttpInterceptorFn = (req, next) => {
  const sesion = inject(Sesion);
  const router = inject(Router);
  const token = sesion.token();
  const conToken =
    token && req.url.startsWith('/api/')
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;
  return next(conToken).pipe(
    catchError((e: HttpErrorResponse) => {
      if (e.status === 401 && !req.url.endsWith('/auth/login')) {
        sesion.cerrar();
        router.navigate(['/ingreso'], { queryParams: { vencida: 1 } });
      }
      return throwError(() => e);
    }),
  );
};

export const requiereSesion: CanActivateFn = () => {
  const sesion = inject(Sesion);
  return sesion.token() ? true : inject(Router).createUrlTree(['/ingreso']);
};

export const ETAPAS = [
  { id: 1, nombre: 'Solicitud y captación', corto: 'Captación' },
  { id: 2, nombre: 'Recolección de datos', corto: 'Datos' },
  { id: 3, nombre: 'Evaluación y score', corto: 'Score' },
  { id: 4, nombre: 'Decisión crediticia', corto: 'Decisión' },
  { id: 5, nombre: 'Formalización y desembolso', corto: 'Desembolso' },
  { id: 6, nombre: 'Seguimiento y cobranza', corto: 'Cobranza' },
] as const;

export const ROL_NOMBRE: Record<Rol, string> = {
  ASESOR: 'Asesora de negocios',
  ANALISTA: 'Analista de crédito',
  RIESGO: 'Analista de riesgo',
  COMITE: 'Comité de crédito',
  OPERACIONES: 'Oficial de operaciones',
  CARTERA: 'Analista de cartera',
  COBRANZA: 'Gestor de cobranza',
  ADMIN: 'Administración',
};
