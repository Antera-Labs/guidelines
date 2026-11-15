import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ROL_NOMBRE, Rol, Sesion } from './nucleo/api';
import { Borradores } from './nucleo/borradores';
import { Avisos } from './nucleo/formato';
import { Icono } from './ui/icono';

interface ItemNav { ruta: string; texto: string; icono: string; roles?: Rol[]; query?: Record<string, string>; exacto?: boolean; }

const NAV: ItemNav[] = [
  { ruta: '/panel', texto: 'Panel', icono: 'panel' },
  { ruta: '/solicitudes', texto: 'Bandeja', icono: 'bandeja', exacto: true },
  { ruta: '/solicitudes/nueva', texto: 'Nueva solicitud', icono: 'nueva', roles: ['ASESOR', 'ANALISTA'] },
  { ruta: '/comite', texto: 'Comité de crédito', icono: 'comite', roles: ['COMITE', 'ANALISTA', 'RIESGO'] },
  { ruta: '/cartera', texto: 'Cartera y cobranza', icono: 'cartera' },
  { ruta: '/provisiones', texto: 'Provisiones', icono: 'balanza', roles: ['CARTERA', 'RIESGO', 'COMITE'] },
  { ruta: '/tarifario', texto: 'Tarifario', icono: 'porcentaje' },
];

/** Preferencia por navegador: el riel plegado se recuerda entre sesiones. */
const CLAVE_RIEL = 'pjl.web.riel-plegado';
function leerPlegado(): boolean {
  try { return localStorage.getItem(CLAVE_RIEL) === '1'; } catch { return false; }
}

@Component({
  selector: 'pjl-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icono],
  host: { '[class.plegado]': 'colapsado()' },
  template: `
    <a class="salto" href="#contenido">Saltar al contenido</a>
    <header class="barra">
      <button class="menu" type="button" (click)="abierto.set(!abierto())" [attr.aria-expanded]="abierto()" aria-controls="riel"
              [attr.aria-label]="abierto() ? 'Cerrar menú' : 'Abrir menú'">
        <pjl-icono [nombre]="abierto() ? 'cerrar' : 'menu'" [tam]="22" />
      </button>
      <img src="logo-pjl.png" alt="" width="32" height="32" />
      <span class="barra-titulo">Padre Julián Lorente</span>
    </header>
    <aside id="riel" class="riel" [class.abierto]="abierto()" aria-label="Navegación principal">
      <div class="marca">
        <img src="logo-pjl.png" alt="Cooperativa de Ahorro y Crédito Padre Julián Lorente" width="44" height="44" />
        <div><strong>Padre Julián Lorente</strong></div>
      </div>
      <nav>
        @for (item of items(); track item.ruta) {
          <a [routerLink]="item.ruta" routerLinkActive="activo" [routerLinkActiveOptions]="{ exact: !!item.exacto }"
             ariaCurrentWhenActive="page">
            <pjl-icono [nombre]="item.icono" [tam]="19" />
            <span>{{ item.texto }}</span>
          </a>
        }
      </nav>
      <button type="button" class="plegar" (click)="alternarRiel()" aria-controls="riel">
        <pjl-icono [nombre]="colapsado() ? 'riel-abrir' : 'riel-cerrar'" [tam]="19" />
        <span>{{ colapsado() ? 'Mostrar menú' : 'Ocultar menú' }}</span>
      </button>
      <div class="usuario">
        <span class="avatar" aria-hidden="true">{{ iniciales() }}</span>
        <div class="quien">
          <strong>{{ sesion.usuario()?.nombre }}</strong>
          <span>{{ rolNombre() }} · {{ sesion.usuario()?.agencia }}</span>
        </div>
        <button type="button" class="salir" (click)="salir()" aria-label="Cerrar sesión" title="Cerrar sesión">
          <pjl-icono nombre="salir" [tam]="18" />
        </button>
      </div>
    </aside>
    @if (abierto()) { <div class="velo" (click)="abierto.set(false)" aria-hidden="true"></div> }
    <main id="contenido" tabindex="-1"><router-outlet /></main>

    <section class="avisos" aria-live="polite" aria-label="Avisos">
      @for (a of avisos.lista(); track a.id) {
        <div class="aviso" [class]="'aviso ' + a.tipo" role="status">
          <pjl-icono [nombre]="a.tipo === 'error' ? 'alerta' : a.tipo === 'ok' ? 'ok' : 'info'" [tam]="18" />
          <span>{{ a.texto }}</span>
          <button type="button" (click)="avisos.cerrar(a.id)" aria-label="Cerrar aviso"><pjl-icono nombre="cerrar" [tam]="16" /></button>
        </div>
      }
    </section>
  `,
  styles: `
    :host { display: grid; grid-template-columns: 252px minmax(0, 1fr); min-height: 100dvh; }
    .barra { display: none; }
    .riel {
      position: sticky; top: 0; z-index: 20; height: 100dvh; display: flex; flex-direction: column; gap: 20px; padding: 20px 14px 16px;
      background: var(--azul-900); color: var(--azul-100); overflow: hidden auto;
    }
    .marca { display: flex; align-items: center; gap: 12px; padding: 4px 8px 8px; }
    .marca img { border-radius: 50%; flex: none; }
    .marca div { min-width: 0; white-space: nowrap; }
    .marca strong { display: block; color: #fff; font-size: var(--t-15); line-height: 1.15; }
    nav { display: flex; flex-direction: column; gap: 2px; }
    nav a, .plegar {
      display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 0 12px; border-radius: var(--r-10);
      color: var(--azul-100); text-decoration: none; font-weight: 600; font-size: var(--t-14); position: relative; white-space: nowrap;
      transition: background-color var(--dur-ui) ease, color var(--dur-ui) ease;
    }
    nav a.activo { background: var(--azul-700); color: #fff; }
    nav a.activo::before { content: ''; position: absolute; left: -14px; top: 10px; bottom: 10px; width: 4px; border-radius: 0 4px 4px 0; background: var(--ambar-500); }
    nav a:focus-visible, .plegar:focus-visible { box-shadow: 0 0 0 2px var(--ambar-300); }
    @media (hover: hover) and (pointer: fine) { nav a:not(.activo):hover, .plegar:hover { background: rgba(255, 255, 255, 0.07); color: #fff; } }
    .plegar { margin-top: auto; width: 100%; border: 0; background: transparent; color: var(--azul-200); cursor: pointer; text-align: left; }
    .usuario { display: flex; align-items: center; gap: 10px; padding: 12px 8px 4px; border-top: 1px solid rgba(255, 255, 255, 0.12); }
    .avatar { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: var(--ambar-500); color: var(--tinta-900); font-weight: 800; font-size: var(--t-13); flex: none; }
    .quien { min-width: 0; flex: 1; }
    .quien strong { display: block; color: #fff; font-size: var(--t-13); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .quien span { display: block; font-size: var(--t-12); color: var(--azul-300); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .salir { width: 40px; height: 40px; border-radius: var(--r-10); border: 0; background: transparent; color: var(--azul-200); cursor: pointer; display: grid; place-items: center; transition: background-color var(--dur-ui) ease, transform var(--dur-press) var(--ease-out); }
    .salir:active { transform: scale(0.94); }
    @media (hover: hover) and (pointer: fine) { .salir:hover { background: rgba(255, 255, 255, 0.08); color: #fff; } }
    main { min-width: 0; outline: none; }

    .avisos { position: fixed; right: 16px; bottom: 16px; z-index: 60; display: flex; flex-direction: column; gap: 8px; width: min(400px, calc(100vw - 32px)); }
    .aviso {
      display: flex; gap: 10px; align-items: flex-start; padding: 12px 12px 12px 14px; border-radius: var(--r-12);
      background: var(--tinta-900); color: #fff; box-shadow: var(--sombra-3); font-weight: 600; font-size: var(--t-14);
      transition: opacity 400ms ease, transform 400ms ease;
      @starting-style { opacity: 0; transform: translateY(12px); }
    }
    .aviso.ok pjl-icono { color: #7ee0a5; }
    .aviso.error { background: var(--peligro-700); }
    .aviso span { flex: 1; padding-top: 1px; }
    .aviso button { border: 0; background: transparent; color: inherit; opacity: .8; width: 28px; height: 28px; display: grid; place-items: center; cursor: pointer; border-radius: var(--r-6); }

    /* Riel plegado (PC): solo íconos; la etiqueta aparece como globo al pasar el cursor o enfocar. */
    @media (min-width: 1100px) {
      :host { transition: grid-template-columns 240ms var(--ease-out); }
      :host(.plegado) { grid-template-columns: 76px minmax(0, 1fr); }
      :host(.plegado) .riel { overflow: visible; }
      :host(.plegado) .marca { justify-content: center; padding: 4px 0 8px; }
      :host(.plegado) .marca img { width: 40px; height: 40px; }
      :host(.plegado) .marca div { display: none; }
      :host(.plegado) nav a, :host(.plegado) .plegar { justify-content: center; padding: 0; }
      :host(.plegado) nav a > span, :host(.plegado) .plegar > span {
        position: absolute; left: calc(100% + 16px); top: 50%; translate: -4px -50%; z-index: 1;
        padding: 6px 10px; border-radius: var(--r-6); background: var(--tinta-900); color: #fff;
        font-size: var(--t-13); box-shadow: var(--sombra-2); pointer-events: none;
        opacity: 0; transition: opacity 120ms ease, translate 160ms var(--ease-out);
      }
      :host(.plegado) nav a:focus-visible > span, :host(.plegado) .plegar:focus-visible > span { opacity: 1; translate: 0 -50%; }
      @media (hover: hover) and (pointer: fine) {
        :host(.plegado) nav a:hover > span, :host(.plegado) .plegar:hover > span { opacity: 1; translate: 0 -50%; }
      }
      :host(.plegado) .usuario { flex-direction: column; gap: 6px; padding: 12px 0 0; }
      :host(.plegado) .quien { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    }

    @media (max-width: 1099px) {
      .plegar { display: none; }
      :host { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto 1fr; }
      .barra {
        display: flex; align-items: center; gap: 10px; position: sticky; top: 0; z-index: 30; height: 60px; padding: 0 12px;
        padding-top: env(safe-area-inset-top); background: var(--azul-900); color: #fff;
      }
      .barra img { border-radius: 50%; }
      .barra-titulo { font-weight: 700; font-size: var(--t-15); }
      .menu { width: 44px; height: 44px; border: 0; border-radius: var(--r-10); background: transparent; color: #fff; display: grid; place-items: center; cursor: pointer; }
      .riel {
        position: fixed; z-index: 40; top: 0; left: 0; width: min(300px, 86vw); height: 100dvh;
        transform: translateX(-100%); transition: transform 320ms var(--ease-drawer); box-shadow: var(--sombra-3); visibility: hidden;
      }
      .riel.abierto { transform: translateX(0); visibility: visible; }
      .velo { position: fixed; inset: 0; z-index: 35; background: rgba(10, 42, 71, 0.45); animation: velo 200ms ease both; }
      @keyframes velo { from { opacity: 0; } }
    }
  `,
})
export class Shell {
  protected readonly sesion = inject(Sesion);
  protected readonly avisos = inject(Avisos);
  private readonly router = inject(Router);
  private readonly borradores = inject(Borradores);
  protected readonly abierto = signal(false);
  protected readonly colapsado = signal(leerPlegado());

  protected readonly items = computed(() => NAV.filter((i) => !i.roles || this.sesion.puede(...i.roles)));
  protected readonly rolNombre = computed(() => { const r = this.sesion.usuario()?.rol; return r ? ROL_NOMBRE[r] : ''; });
  protected readonly iniciales = computed(() =>
    (this.sesion.usuario()?.nombre ?? '').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase());

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => this.abierto.set(false));
  }

  protected alternarRiel(): void {
    const plegado = !this.colapsado();
    this.colapsado.set(plegado);
    try { localStorage.setItem(CLAVE_RIEL, plegado ? '1' : '0'); } catch { /* almacenamiento no disponible */ }
  }

  protected salir(): void {
    this.borradores.limpiar();
    this.sesion.cerrar();
    this.router.navigate(['/ingreso']);
  }
}
