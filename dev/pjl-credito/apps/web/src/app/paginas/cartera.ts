import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api, Sesion, mensajeError } from '../nucleo/api';
import { Avisos, FORMATOS } from '../nucleo/formato';
import { Riesgo } from '../ui/etapas';
import { Icono } from '../ui/icono';
import { Paginador, paginar, subirLista } from '../ui/paginador';
import { OpcionVista, Vistas } from '../ui/vistas';

type Mapa = Record<string, any>;

@Component({
  selector: 'pjl-cartera',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Riesgo, Icono, Paginador, Vistas, ...FORMATOS],
  template: `
    <div class="pagina fija">
      <header class="cabecera">
        <div>
          <h1>Cartera y cobranza</h1>
        </div>
        @if (sesion.puede('CARTERA', 'RIESGO')) {
          <button class="btn btn-primario" type="button" (click)="monitorear()" [disabled]="monitoreando()">
            @if (monitoreando()) { <span class="giro"></span> } @else { <pjl-icono nombre="refrescar" /> } Ejecutar monitoreo
          </button>
        }
      </header>

      <pjl-vistas [opciones]="vistas" [(vista)]="vista" etiqueta="Elegir sección de cartera" />

      @if (resumen(); as r) {
        <section class="panel resumen" [class.fuera-de-vista]="vista() !== 'resumen'" aria-label="Resumen de cartera">
          <div><span>Saldo de cartera</span><strong class="num">{{ r.saldo | dinero }}</strong></div>
          <div><span>Créditos</span><strong class="num">{{ r.creditos }}</strong></div>
          <div><span>Con mora</span><strong class="num">{{ r.enMora }}</strong></div>
          <div><span>Monto vencido</span><strong class="num">{{ r.vencido | dinero }}</strong></div>
        </section>
      }

      <!-- Resumen, filtros y búsqueda quedan quietos; solo la lista se desplaza -->
      <section class="panel lista" [class.fuera-de-vista]="vista() !== 'creditos'">
        <div class="filtros">
          <div class="chips" role="group" aria-label="Fase de cobranza">
            @for (f of fases; track f.valor) {
              <button type="button" class="chip" [attr.aria-pressed]="(fase() ?? '') === f.valor" (click)="ir({ fase: f.valor || null })">{{ f.texto }}</button>
            }
          </div>
          <div class="chips" role="group" aria-label="Categoría de riesgo">
            @for (c of ['A', 'B', 'C', 'D', 'E']; track c) {
              <button type="button" class="chip" [attr.aria-pressed]="categoria() === c" (click)="ir({ categoria: categoria() === c ? null : c })">Categoría {{ c }}</button>
            }
          </div>
          <label class="busqueda">
            <span class="sr-only">Buscar por socio, cédula u operación</span>
            <pjl-icono nombre="buscar" [tam]="17" />
            <input class="entrada" type="search" placeholder="Buscar por socio, cédula u operación" [ngModel]="q() ?? ''" (ngModelChange)="buscar($event)" name="q" />
          </label>
        </div>
        <div class="desplazable" id="lista-cartera" tabindex="-1">
        @if (error()) { <div class="panel-cuerpo"><div class="aviso-error" role="alert">{{ error() }}</div></div> }
        @else if (filas()) {
          <div class="tabla-marco">
            <table class="tabla">
              <thead><tr><th>Operación</th><th>Socio</th><th>Producto</th><th class="num">Saldo</th><th class="num k-cuota">Cuota</th><th>Próximo vencimiento</th><th class="num">Mora</th><th>Riesgo</th><th>Fase</th></tr></thead>
              <tbody>
                @for (c of visibles(); track c['idCredito']) {
                  <tr class="fila-link" tabindex="0" (click)="abrir(c)" (keydown.enter)="abrir(c)" [attr.aria-label]="'Abrir ' + c['numeroOperacion'] + ' de ' + c['socio']">
                    <td class="k-op"><span class="principal num">{{ c['numeroOperacion'] }}</span></td>
                    <td class="k-socio"><span class="principal">{{ c['socio'] }}</span><span class="secundario">{{ c['agencia'] }}</span></td>
                    <td class="k-prod">{{ c['producto'] }}<span class="secundario">{{ c['cuotasPagadas'] }} de {{ c['plazoMeses'] }} cuotas pagadas</span></td>
                    <td class="num principal k-saldo">{{ c['saldoCapital'] | dinero }}</td>
                    <td class="num k-cuota">{{ c['cuotaMensual'] | dinero }}</td>
                    <td class="k-venc">{{ c['proximoVencimiento'] | fecha }}</td>
                    <td class="num k-mora"><span [class]="c['diasMora'] > 30 ? 'mora alta' : c['diasMora'] > 0 ? 'mora' : 'mora cero'">{{ c['diasMora'] }} d</span></td>
                    <td class="k-riesgo"><pjl-riesgo [categoria]="c['categoriaRiesgo']" /></td>
                    <td class="k-fase"><span class="insignia" [class]="'insignia ' + (c['faseCobranza'] === 'JUDICIAL' ? 'peligro' : c['faseCobranza'] === 'TEMPRANA' ? 'aviso' : 'info')">{{ c['faseCobranza'] | etiqueta }}</span></td>
                  </tr>
                } @empty {
                  <tr><td colspan="9"><div class="vacio"><strong>No hay créditos con estos filtros</strong></div></td></tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="panel-cuerpo carga">@for (i of [1, 2, 3, 4, 5, 6]; track i) { <div class="esqueleto" style="height: 44px"></div> }</div>
        }
        </div>
        @if (!error()) {
          <pjl-paginador [total]="filas()?.length ?? 0" [pagina]="paginaNum()" (cambiar)="irA($event)" etiqueta="Páginas de la cartera" />
        }
      </section>
    </div>
  `,
  styles: `
    .resumen { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .resumen div { padding: 16px var(--relleno-panel); border-left: 1px solid var(--linea); display: flex; flex-direction: column; }
    .resumen div:first-child { border-left: 0; }
    .resumen span { font-size: var(--t-13); color: var(--tinta-600); font-weight: 600; }
    .resumen strong { font-size: var(--t-24); font-weight: 800; color: var(--azul-900); }
    @media (max-width: 760px) { .resumen { grid-template-columns: repeat(2, minmax(0, 1fr)); } .resumen div:nth-child(3) { border-left: 0; } .resumen div:nth-child(n + 3) { border-top: 1px solid var(--linea); } }
    .filtros { display: flex; flex-direction: column; gap: 10px; padding: 16px var(--relleno-panel); border-bottom: 1px solid var(--linea); }
    .busqueda { position: relative; max-width: 460px; }
    .busqueda pjl-icono { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--tinta-500); }
    .busqueda .entrada { padding-left: 38px; }
    .mora { font-weight: 800; color: var(--riesgo-d); }
    .mora.alta { color: var(--peligro-700); }
    .mora.cero { color: var(--tinta-500); font-weight: 600; }
    :host { display: block; }
    .carga { display: grid; gap: 10px; padding-top: 16px; }
    .tabla td { white-space: nowrap; }
    /* Socio, producto y títulos pueden ir en dos líneas, para que las 9 columnas quepan en una laptop */
    .lista { container-type: inline-size; }
    .tabla th { white-space: normal; }
    .tabla td.k-socio, .tabla td.k-prod { white-space: normal; min-width: 150px; }
    @container (max-width: 1100px) {
      .tabla th, .tabla td { padding-left: 10px; padding-right: 10px; }
    }
    @container (max-width: 940px) { .k-cuota { display: none; } }
    /* Tarjetas cuando la lista mide menos de 860 px (teléfono y tablet vertical) */
    @container (max-width: 860px) {
      thead { display: none; }
      .tabla, tbody, tr, td { display: block; }
      tr.fila-link { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: 'socio saldo' 'op mora' 'prod riesgo' 'venc fase'; gap: 6px 12px; padding: 14px var(--relleno-panel); border-bottom: 1px solid var(--tinta-100); }
      tr.fila-link > td { padding: 0; border: 0; white-space: normal; }
      .k-op { grid-area: op; } .k-socio { grid-area: socio; } .k-prod { grid-area: prod; font-size: var(--t-13); color: var(--tinta-600); }
      .k-saldo { grid-area: saldo; } .k-mora { grid-area: mora; } .k-riesgo { grid-area: riesgo; text-align: right; } .k-fase { grid-area: fase; text-align: right; }
      .k-venc { grid-area: venc; font-size: var(--t-13); color: var(--tinta-600); } .k-cuota { display: none; }
      .k-op .secundario, .k-socio .secundario { display: inline; margin-left: 6px; }
    }
  `,
})
export class Cartera {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly avisos = inject(Avisos);
  protected readonly sesion = inject(Sesion);
  readonly fase = input<string>();
  readonly categoria = input<string>();
  readonly q = input<string>();
  readonly pagina = input<string>();

  protected readonly vistas: OpcionVista[] = [{ id: 'resumen', texto: 'Resumen' }, { id: 'creditos', texto: 'Créditos' }];
  protected readonly vista = signal('resumen');
  protected readonly fases = [{ valor: '', texto: 'Toda la cartera' }, { valor: 'PREVENTIVA', texto: 'Al día · preventiva' }, { valor: 'TEMPRANA', texto: 'Mora temprana' }, { valor: 'JUDICIAL', texto: 'Judicial' }];
  protected readonly filas = signal<Mapa[] | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly monitoreando = signal(false);
  protected readonly resumen = computed(() => {
    const f = this.filas();
    if (!f) return null;
    return { saldo: f.reduce((a, c) => a + c['saldoCapital'], 0), creditos: f.length, enMora: f.filter((c) => c['diasMora'] > 0).length, vencido: f.reduce((a, c) => a + (c['montoVencido'] ?? 0), 0) };
  });
  /** 6 por página, como el panel y la bandeja; la página va en la URL (?pagina=2). */
  private readonly pagina6 = computed(() => paginar(this.filas(), this.pagina()));
  protected readonly paginaNum = computed(() => this.pagina6().actual);
  protected readonly visibles = computed(() => this.pagina6().visibles);
  private temporizador?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => { this.cargar({ fase: this.fase() ?? null, categoria: this.categoria() ?? null, q: this.q() ?? null }); });
  }

  private async cargar(p: Record<string, string | null>) {
    try { this.filas.set(await this.api.get<Mapa[]>('/cartera', p)); this.error.set(null); } catch (e) { this.error.set(mensajeError(e)); }
  }

  /** Cambiar un filtro vuelve a la primera página. */
  protected ir(q: Record<string, string | null>) { this.router.navigate([], { queryParams: { ...q, pagina: null }, queryParamsHandling: 'merge', replaceUrl: true }); }
  protected irA(p: number) {
    this.router.navigate([], { queryParams: { pagina: p <= 1 ? null : p }, queryParamsHandling: 'merge', replaceUrl: true });
    subirLista('lista-cartera');
  }
  protected buscar(t: string) { clearTimeout(this.temporizador); this.temporizador = setTimeout(() => this.ir({ q: t.trim() || null }), 250); }
  protected abrir(c: Mapa) { this.router.navigate(['/cartera', c['idCredito']]); }

  protected async monitorear() {
    this.monitoreando.set(true);
    try {
      const i = await this.api.post<Mapa>('/cartera/monitoreo');
      await this.cargar({ fase: this.fase() ?? null, categoria: this.categoria() ?? null, q: this.q() ?? null });
      this.avisos.mostrar(`Monitoreo ejecutado: ${i['alertasAbiertas']} alertas abiertas, cartera en riesgo ${String(i['carteraRiesgoPct']).replace('.', ',')} %.`);
    } catch (e) { this.avisos.mostrar(mensajeError(e), 'error'); } finally { this.monitoreando.set(false); }
  }
}
