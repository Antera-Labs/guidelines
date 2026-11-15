import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, ETAPAS, Sesion, mensajeError } from '../nucleo/api';
import { Icono } from '../ui/icono';
import { Paginador, paginar, subirLista } from '../ui/paginador';
import { FilaSolicitud, TablaSolicitudes } from '../ui/tabla-solicitudes';

const FILTROS_ESTADO = [
  { valor: 'activas', texto: 'Activas' },
  { valor: 'EN_COMITE', texto: 'En comité' },
  { valor: 'APROBADA', texto: 'Aprobadas' },
  { valor: 'DESEMBOLSADA', texto: 'Desembolsadas' },
  { valor: 'RECHAZADA', texto: 'Rechazadas' },
  { valor: 'todas', texto: 'Todas' },
];

@Component({
  selector: 'pjl-bandeja',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, TablaSolicitudes, Icono, Paginador],
  template: `
    <div class="pagina fija">
      <header class="cabecera">
        <div>
          <h1>{{ comite() ? 'Comité de crédito' : 'Bandeja de solicitudes' }}</h1>
        </div>
        @if (!comite() && sesion.puede('ASESOR', 'ANALISTA')) {
          <a class="btn btn-primario" routerLink="/solicitudes/nueva"><pjl-icono nombre="mas" /> Nueva solicitud</a>
        }
      </header>

      @if (comite()) {
        <p class="suave intro">Casos en zona gris (categoría C o D), con cuota/ingreso sobre 40 % o montos sobre $20,000.00. Abre cada expediente para revisar los factores del score y registrar la resolución con su acta.</p>
      }

      <section class="panel lista">
        <!-- Encabezado, filtros y conteo quedan quietos; solo la lista se desplaza -->
        @if (!comite()) {
          <div class="chips filtro-etapas" role="group" aria-label="Filtrar por etapa">
            <button type="button" class="chip" [attr.aria-pressed]="!etapaNum()" (click)="filtrar({ etapa: null })">Todas las etapas</button>
            @for (e of etapas; track e.id) {
              @if (e.id < 6) {
                <button type="button" class="chip" [attr.aria-pressed]="etapaNum() === e.id" (click)="filtrar({ etapa: e.id })">
                  <span class="cuenta">{{ e.id }}</span> {{ e.corto }}
                </button>
              }
            }
          </div>
        }
        <div class="filtros">
          <div class="fila-filtros">
            <label class="busqueda">
              <span class="sr-only">Buscar por socio, cédula o número</span>
              <pjl-icono nombre="buscar" [tam]="17" />
              <input class="entrada" type="search" placeholder="Buscar por socio, cédula o número" [ngModel]="q() ?? ''"
                     (ngModelChange)="buscar($event)" name="q" />
            </label>
            @if (!comite()) {
              <label class="campo estado">
                <span class="sr-only">Estado</span>
                <select class="entrada" [ngModel]="estadoSel()" (ngModelChange)="filtrar({ estado: $event })" name="estado">
                  @for (f of filtrosEstado; track f.valor) { <option [value]="f.valor">{{ f.texto }}</option> }
                </select>
              </label>
            }
          </div>
        </div>
        @if (filas(); as f) {
          @if (!error()) { <p class="conteo" aria-live="polite">{{ f.length }} {{ f.length === 1 ? 'solicitud' : 'solicitudes' }}</p> }
        }
        <div class="desplazable" id="lista-bandeja" tabindex="-1">
          @if (error()) {
            <div class="panel-cuerpo"><div class="aviso-error" role="alert"><pjl-icono nombre="alerta" /> {{ error() }}</div></div>
          } @else if (filas(); as f) {
            <pjl-tabla-solicitudes [filas]="visibles()" [titulo]="comite() ? 'Solicitudes en comité' : 'Bandeja de solicitudes'"
              [vacio]="comite() ? 'No hay casos pendientes de comité.' : 'No hay solicitudes con estos filtros.'" />
          } @else {
            <div class="panel-cuerpo carga">@for (i of [1, 2, 3, 4, 5, 6]; track i) { <div class="esqueleto" style="height: 44px"></div> }</div>
          }
        </div>
        @if (!error()) {
          <pjl-paginador [total]="total()" [pagina]="paginaNum()" (cambiar)="irA($event)" etiqueta="Páginas de la bandeja" />
        }
      </section>
    </div>
  `,
  styles: `
    :host { display: block; }
    .intro { max-width: 80ch; }
    .filtro-etapas { padding: 14px var(--relleno-panel) 12px; background: var(--superficie); border-radius: var(--r-16) var(--r-16) 0 0; border-bottom: 1px solid var(--linea); }
    .filtros { display: flex; flex-direction: column; gap: 12px; padding: 16px var(--relleno-panel) 12px; border-bottom: 1px solid var(--linea); }
    .filtro-etapas + .filtros { padding-top: 12px; }
    .fila-filtros { display: flex; gap: 10px; flex-wrap: wrap; }
    .busqueda { position: relative; flex: 1 1 280px; }
    .busqueda pjl-icono { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--tinta-500); }
    .busqueda .entrada { padding-left: 38px; }
    .estado { flex: 0 1 220px; }
    .conteo { padding: 10px var(--relleno-panel) 0; font-size: var(--t-13); color: var(--tinta-500); font-weight: 600; }
    .carga { display: grid; gap: 10px; padding-top: 16px; }
    /* Tablet y teléfono: las etapas en una sola línea que se desliza de lado */
    @media (max-width: 1099px) {
      .filtro-etapas { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
      .filtro-etapas::-webkit-scrollbar { display: none; }
      .filtro-etapas .chip { flex: none; }
    }
    /* Teléfono: la página se desplaza como siempre y las etapas quedan fijas bajo la barra superior.
       Desde 761 px, el encabezado quieto y la lista desplazable vienen de .pagina.fija (styles.css). */
    @media (max-width: 760px) {
      .filtro-etapas { position: sticky; top: 60px; z-index: 4; }
    }
  `,
})
export class Bandeja {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  protected readonly sesion = inject(Sesion);

  readonly etapa = input<string>();
  readonly estado = input<string>();
  readonly q = input<string>();
  readonly comite = input<boolean>(false);
  readonly pagina = input<string>();

  protected readonly etapas = ETAPAS;
  protected readonly filtrosEstado = FILTROS_ESTADO;
  protected readonly filas = signal<FilaSolicitud[] | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly etapaNum = computed(() => (this.etapa() ? Number(this.etapa()) : null));
  protected readonly estadoSel = computed(() => this.estado() ?? 'activas');
  /** 6 por página, como en el panel; la página va en la URL (?pagina=2). */
  protected readonly total = computed(() => this.filas()?.length ?? 0);
  private readonly pagina6 = computed(() => paginar(this.filas(), this.pagina()));
  protected readonly paginaNum = computed(() => this.pagina6().actual);
  protected readonly visibles = computed(() => this.pagina6().visibles);
  private temporizador?: ReturnType<typeof setTimeout>;
  private pedido = 0;

  constructor() {
    effect(() => {
      const params = {
        etapa: this.comite() ? null : this.etapaNum(),
        estado: this.comite() ? 'EN_COMITE' : (['activas', 'todas'].includes(this.estadoSel()) ? null : this.estadoSel()),
        activas: !this.comite() && this.estadoSel() === 'activas',
        q: this.q() ?? null,
      };
      this.cargar(params);
    });
  }

  private async cargar(params: Record<string, string | number | boolean | null>): Promise<void> {
    const n = ++this.pedido;
    try {
      const r = await this.api.get<FilaSolicitud[]>('/solicitudes', params);
      if (n === this.pedido) { this.filas.set(r); this.error.set(null); }
    } catch (e) {
      if (n === this.pedido) this.error.set(mensajeError(e));
    }
  }

  /** Cambiar un filtro vuelve a la primera página. */
  protected filtrar(cambio: Record<string, string | number | null>): void {
    this.router.navigate([], { queryParams: { ...cambio, pagina: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected irA(p: number): void {
    this.router.navigate([], { queryParams: { pagina: p <= 1 ? null : p }, queryParamsHandling: 'merge', replaceUrl: true });
    subirLista('lista-bandeja');
  }

  protected buscar(texto: string): void {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.filtrar({ q: texto.trim() || null }), 250);
  }
}
