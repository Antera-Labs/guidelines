import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, Sesion, mensajeError } from '../nucleo/api';
import { KpiEtapa } from '../ui/etapas';
import { Icono } from '../ui/icono';
import { FilaSolicitud, TablaSolicitudes } from '../ui/tabla-solicitudes';
import { OpcionVista, Vistas } from '../ui/vistas';

interface Indicadores {
  solicitudesActivas: number; solicitudes30d: number; enComite: number; tasaAprobacionPct: number; diasColocacionPromedio: number;
  dictamenAutomaticoPct: number; carteraTotal: number; creditosActivos: number; carteraRiesgoPct: number; provisionMes: number; alertasAbiertas: number;
}
interface Alerta { idAlerta: number; idCredito: number; tipo: string; severidad: 'ALTA' | 'MEDIA' | 'BAJA'; descripcion: string; fecha: string; numeroOperacion: string; socio: string; }
const VISTAS: OpcionVista[] = [
  { id: 'etapas', texto: 'Por etapa' },
  { id: 'espera', texto: 'En espera' },
  { id: 'alertas', texto: 'Alertas' },
];
const MAX_ESPERA = 6;

interface DatosPanel { indicadores: Indicadores; etapas: KpiEtapa[]; alertas: Alerta[]; recientes: FilaSolicitud[]; }

/**
 * Panel: solicitudes de crédito.
 * Arriba, cuántas solicitudes hay en cada etapa; debajo, las solicitudes en espera y las alertas de cartera.
 */
@Component({
  selector: 'pjl-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icono, TablaSolicitudes, Vistas],
  template: `
    <div class="pagina">
      <header class="cabecera">
        <div>
          <h1>Solicitudes de crédito</h1>
          <p class="contexto">{{ sesion.usuario()?.agencia }} · {{ hoy }}</p>
        </div>
        <div class="acciones">
          <button class="btn" type="button" (click)="cargar()" [disabled]="cargando()"><pjl-icono nombre="refrescar" [tam]="17" /> Actualizar</button>
          @if (sesion.puede('ASESOR', 'ANALISTA')) {
            <a class="btn btn-primario" routerLink="/solicitudes/nueva"><pjl-icono nombre="mas" /> Nueva solicitud</a>
          }
        </div>
      </header>

      @if (error()) { <div class="aviso-error" role="alert"><pjl-icono nombre="alerta" /> {{ error() }}</div> }

      @if (datos(); as d) {
        <pjl-vistas [opciones]="vistas" [(vista)]="vista" etiqueta="Elegir sección del panel" />

        <section class="panel estadisticas" [class.fuera-de-vista]="vista() !== 'etapas'" aria-labelledby="titulo-etapas">
          <div class="panel-cab"><h2 id="titulo-etapas">Solicitudes por etapa</h2></div>
          <ul class="etapas" aria-label="Solicitudes por etapa del Value Stream">
            @for (e of d.etapas; track e.idEtapa) {
              <li>
                <a [routerLink]="e.idEtapa === 6 ? '/cartera' : '/solicitudes'" [queryParams]="e.idEtapa === 6 ? null : { etapa: e.idEtapa }"
                   [attr.aria-label]="'Etapa ' + e.idEtapa + ', ' + e.nombre + ': ' + e.enCurso + (e.idEtapa === 6 ? ' créditos activos' : ' solicitudes en curso')">
                  <span class="et-num">Etapa {{ e.idEtapa }}</span>
                  <span class="et-nombre">{{ e.nombre }}</span>
                  <strong class="et-conteo">{{ e.enCurso }}</strong>
                </a>
              </li>
            }
          </ul>
        </section>

        <div class="cuerpo-marco"><div class="cuerpo">
          <section class="panel" [class.fuera-de-vista]="vista() !== 'espera'">
            <div class="panel-cab">
              <h2>Solicitudes en espera</h2>
              <a class="btn btn-fantasma btn-chico" routerLink="/solicitudes">Ver bandeja <pjl-icono nombre="chevron-right" [tam]="16" /></a>
            </div>
            <pjl-tabla-solicitudes [filas]="espera()" titulo="Solicitudes en espera" vacio="No hay solicitudes en espera" pista="Las nuevas aparecerán aquí." />
          </section>
          <section class="panel" [class.fuera-de-vista]="vista() !== 'alertas'">
            <div class="panel-cab">
              <h2>Alertas de cartera</h2>
              <span class="insignia" [class]="d.indicadores.alertasAbiertas ? 'insignia aviso' : 'insignia ok'">{{ d.indicadores.alertasAbiertas }} abiertas</span>
            </div>
            <ul class="alertas">
              @for (a of d.alertas; track a.idAlerta) {
                <li>
                  <a [routerLink]="['/cartera', a.idCredito]">
                    <span class="sev" [class]="'sev ' + a.severidad" [attr.aria-label]="'Severidad ' + a.severidad.toLowerCase()"></span>
                    <span class="texto"><strong>{{ a.socio }}</strong><span>{{ a.descripcion }}</span></span>
                    <span class="op num">{{ a.numeroOperacion }}</span>
                  </a>
                </li>
              } @empty {
                <li class="vacio"><strong>Sin alertas abiertas</strong><span>El monitoreo de cartera no encontró deterioro.</span></li>
              }
            </ul>
          </section>
        </div></div>
      } @else if (!error()) {
        <div class="esqueleto" style="height: 180px; border-radius: 16px"></div>
        <div class="esqueleto" style="height: 360px; border-radius: 16px"></div>
      }
    </div>
  `,
  styles: `
    /* Solicitudes por etapa: las 6 etapas en la rejilla de 6 columnas; el detalle está a un clic */
    .estadisticas .panel-cab { padding-bottom: 6px; }
    .etapas { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); border-top: 1px solid var(--linea); }
    .etapas li { min-width: 0; border-left: 1px solid var(--linea); }
    .etapas li:first-child { border-left: 0; }
    .etapas a {
      height: 100%; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 14px var(--relleno-panel) 16px;
      color: inherit; text-decoration: none; transition: background-color var(--dur-ui) ease;
    }
    .etapas li:first-child a { border-bottom-left-radius: var(--r-16); }
    .etapas li:last-child a { border-bottom-right-radius: var(--r-16); }
    .etapas a:focus-visible { box-shadow: inset 0 0 0 2px var(--azul-500); border-radius: 0; }
    @media (hover: hover) and (pointer: fine) { .etapas a:hover { background: var(--azul-50); } }
    .et-num { font-size: var(--t-12); font-weight: 600; color: var(--tinta-500); }
    .et-nombre { font-size: var(--t-13); font-weight: 700; color: var(--tinta-900); line-height: 1.3; min-height: 2.6em; }
    .et-conteo { margin-top: 6px; font-size: var(--t-30); font-weight: 800; letter-spacing: -0.03em; line-height: 1; color: var(--azul-900); font-variant-numeric: tabular-nums; }

    @media (max-width: 1100px) {
      .etapas { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .etapas li:nth-child(4) { border-left: 0; }
      .etapas li:nth-child(n + 4) { border-top: 1px solid var(--linea); }
      .etapas li a { border-radius: 0 !important; }
    }
    @media (max-width: 600px) {
      .etapas { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .etapas li { border-left: 0 !important; border-top: 1px solid var(--linea); }
      .etapas li:nth-child(even) { border-left: 1px solid var(--linea) !important; }
      .etapas li:nth-child(-n + 2) { border-top: 0; }
    }

    /* Tabla y alertas lado a lado solo si la tabla cabe entera (según el ancho real del contenido, con o sin menú). */
    .cuerpo-marco { container-type: inline-size; }
    .cuerpo { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: var(--separacion); align-items: start; }
    @container (max-width: 1180px) { .cuerpo { grid-template-columns: minmax(0, 1fr); } }

    /* Alertas de cartera */
    .alertas { list-style: none; margin: 0; padding: 0 calc(var(--relleno-panel) - 12px) 10px; }
    .alertas a {
      display: flex; align-items: flex-start; gap: 12px; padding: 12px; border-radius: var(--r-10); text-decoration: none; color: inherit;
      transition: background-color var(--dur-ui) ease;
    }
    @media (hover: hover) and (pointer: fine) { .alertas a:hover { background: var(--azul-50); } }
    .sev { width: 10px; height: 10px; border-radius: 50%; margin-top: 5px; flex: none; }
    .sev.ALTA { background: var(--peligro-500); box-shadow: 0 0 0 3px var(--peligro-100); }
    .sev.MEDIA { background: var(--ambar-600); box-shadow: 0 0 0 3px var(--ambar-100); }
    .sev.BAJA { background: var(--azul-500); box-shadow: 0 0 0 3px var(--azul-100); }
    .texto { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .texto strong { font-size: var(--t-14); }
    .texto span { font-size: var(--t-13); color: var(--tinta-600); }
    .op { font-size: var(--t-12); color: var(--tinta-500); white-space: nowrap; }
  `,
})
export class Panel {
  private readonly api = inject(Api);
  protected readonly sesion = inject(Sesion);
  protected readonly datos = signal<DatosPanel | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly cargando = signal(false);
  protected readonly vistas = VISTAS;
  protected readonly vista = signal('etapas');
  protected readonly espera = computed(() => (this.datos()?.recientes ?? []).slice(0, MAX_ESPERA));
  protected readonly hoy = new Intl.DateTimeFormat('es-EC', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  constructor() { this.cargar(); }


  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.datos.set(await this.api.get<DatosPanel>('/panel'));
      this.error.set(null);
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }
}
