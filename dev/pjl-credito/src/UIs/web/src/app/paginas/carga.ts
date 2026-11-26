import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, ROL_NOMBRE, Sesion } from '../nucleo/api';
import { Borradores } from '../nucleo/borradores';
import { Icono } from '../ui/icono';

/** Duración mínima de la pantalla, para que la marca no parpadee si todo carga de inmediato. */
const MINIMO_MS = 1400;

/**
 * Pantalla de carga al ingresar: verifica la sesión con core-api y precarga el panel.
 * Al terminar, ofrece ir al panel o cambiar de usuario.
 */
@Component({
  selector: 'pjl-carga',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icono],
  template: `
    <main class="carga" [attr.aria-busy]="!listo()">
      <div class="centro">
        <img class="logo" src="logo-pjl-512.png" alt="" width="512" height="512" />
        <h1>
          <span class="bienvenidos">Bienvenidos a</span>
          <span class="nombre">Lorente<span>Score</span></span>
        </h1>
        <p class="cooperativa">Cooperativa de Ahorro y Crédito Padre Julián Lorente</p>
        <p class="saludo">Hola, <strong>{{ sesion.usuario()?.nombre }}</strong>.</p>
        <p class="puesto">{{ rol() }} · {{ sesion.usuario()?.agencia }}</p>

        <div class="zona">
          @if (!listo()) {
            <div class="progreso" role="progressbar" aria-label="Cargando LorenteScore" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="avance()">
              <span class="barra" [style.transform]="'scaleX(' + avance() / 100 + ')'"></span>
            </div>
            <p class="estado">{{ paso() }}</p>
          } @else {
            @if (aviso()) { <p class="aviso" role="status">{{ aviso() }}</p> }
            <div class="acciones">
              <a id="ir-panel" class="btn btn-ambar btn-grande" routerLink="/panel">Ir al panel <pjl-icono nombre="flecha-derecha" [tam]="18" /></a>
              <button type="button" class="btn btn-claro btn-grande" (click)="cambiarUsuario()">Cambiar de usuario</button>
            </div>
          }
        </div>
        <p class="sr-only" aria-live="polite">{{ listo() ? 'Listo. Elige ir al panel o cambiar de usuario.' : paso() }}</p>
      </div>
    </main>
  `,
  styles: `
    :host { display: block; }
    .carga { min-height: 100dvh; display: grid; background: linear-gradient(180deg, var(--azul-700) 0%, var(--azul-900) 100%); color: #fff; }
    .centro { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 48px 20px 56px; }
    .logo { width: clamp(132px, 24dvh, 220px); height: auto; aspect-ratio: 1; border-radius: 50%; box-shadow: 0 26px 60px -24px rgba(5, 22, 38, 0.7); }
    h1 { margin-top: clamp(18px, 2.6dvh, 30px); display: flex; flex-direction: column; align-items: center; gap: 6px; color: #fff; }
    .bienvenidos { font-size: clamp(1.5rem, 1.2vw + 1rem, 2.25rem); font-weight: 600; letter-spacing: -0.02em; line-height: 1.1; color: var(--azul-100); }
    .nombre { font-size: clamp(3rem, 4.5vw + 1.5rem, 5.75rem); font-weight: 800; letter-spacing: -0.04em; line-height: 1; }
    .nombre span { color: var(--ambar-500); }
    .cooperativa { margin-top: 14px; font-size: clamp(1.0625rem, 0.5vw + 0.9rem, 1.3125rem); font-weight: 700; color: var(--azul-100); text-wrap: balance; }
    .saludo { margin-top: 28px; font-size: clamp(1.375rem, 1vw + 1rem, 1.75rem); font-weight: 600; letter-spacing: -0.02em; text-wrap: balance; }
    .saludo strong { font-weight: 800; }
    .puesto { margin-top: 6px; font-size: var(--t-14); font-weight: 600; color: var(--azul-200); }
    /* Misma altura con la barra o con los botones: nada salta al terminar. */
    .zona { margin-top: 28px; min-height: 76px; width: min(420px, 100%); display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 12px; }
    .progreso { width: 100%; height: 8px; border-radius: var(--r-pill); background: rgba(255, 255, 255, 0.16); overflow: hidden; }
    .barra { display: block; height: 100%; border-radius: inherit; background: var(--ambar-500); transform-origin: left center; transition: transform 420ms var(--ease-out); }
    .estado { font-size: var(--t-14); font-weight: 600; color: var(--azul-100); }
    .aviso { font-size: var(--t-13); font-weight: 600; color: var(--ambar-300); }
    .acciones { justify-content: center; gap: 12px; animation: aparecer 260ms var(--ease-out) both; }
    .acciones .btn { min-width: 190px; }
    .acciones pjl-icono { transition: translate var(--dur-ui) var(--ease-out); }
    .btn:focus-visible { box-shadow: 0 0 0 2px var(--azul-900), 0 0 0 4px var(--ambar-300); }
    @media (hover: hover) and (pointer: fine) { .btn-ambar:hover pjl-icono { translate: 3px 0; } }
    @keyframes aparecer { from { opacity: 0; transform: translateY(6px); } }
    @media (max-width: 640px) {
      .logo { width: 112px; }
      .acciones { flex-direction: column; align-items: stretch; width: 100%; }
    }
    @media (prefers-reduced-motion: reduce) { .barra { transition: none; } .acciones { animation: none; } }
  `,
})
export class Carga {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly borradores = inject(Borradores);
  private readonly injector = inject(Injector);
  protected readonly sesion = inject(Sesion);

  protected readonly avance = signal(0);
  protected readonly paso = signal('Preparando…');
  protected readonly listo = signal(false);
  protected readonly aviso = signal<string | null>(null);
  protected readonly rol = computed(() => { const r = this.sesion.usuario()?.rol; return r ? ROL_NOMBRE[r] : ''; });

  constructor() { this.cargar(); }

  private async cargar(): Promise<void> {
    const inicio = performance.now();
    const pasos: [string, () => Promise<unknown>][] = [
      ['Verificando tu sesión…', () => this.api.get('/auth/yo')],
      ['Cargando el Value Stream…', () => Promise.all([import('./panel'), this.api.get('/panel')])],
      ['Preparando tu espacio de trabajo…', () => import('./bandeja')],
    ];
    for (const [i, [texto, accion]] of pasos.entries()) {
      this.paso.set(texto);
      try {
        await accion();
      } catch (e) {
        // Sesión vencida: el interceptor ya lleva al ingreso.
        if (e instanceof HttpErrorResponse && e.status === 401) return;
        this.aviso.set('Parte de la información no cargó. Puedes seguir; se intentará de nuevo en el panel.');
      }
      this.avance.set(Math.round(((i + 1) / pasos.length) * 100));
    }
    const resto = MINIMO_MS - (performance.now() - inicio);
    if (resto > 0) await new Promise((r) => setTimeout(r, resto));
    this.listo.set(true);
    afterNextRender(() => document.getElementById('ir-panel')?.focus(), { injector: this.injector });
  }

  protected cambiarUsuario(): void {
    this.borradores.limpiar();
    this.sesion.cerrar();
    this.router.navigate(['/ingreso']);
  }
}
