import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, mensajeError } from '../nucleo/api';
import { FORMATOS } from '../nucleo/formato';
import { Icono } from '../ui/icono';
import { OpcionVista, Vistas } from '../ui/vistas';

type Mapa = Record<string, any>;
const SIMULADOR = '__simulador';

@Component({
  selector: 'pjl-tarifario',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Icono, Vistas, ...FORMATOS],
  template: `
    <div class="pagina fija">
      <header class="cabecera">
        <div>
          <h1>Tarifario de crédito</h1>
          <p class="contexto">Información publicada en la nube privada</p>
        </div>
      </header>
      @if (meta(); as m) {
        <p class="nota">
          <pjl-icono nombre="info" [tam]="16" /> {{ m['fuente'] }} · versión {{ m['version'] }}.
          {{ m['nota'] }}
        </p>
      }
      @if (error()) {
        <div class="aviso-error" role="alert">{{ error() }}</div>
      }

      <!-- Un segmento a la vez. PC: botones de segmento sobre la tabla; pantallas pequeñas: los mismos más «Simulador», fijos arriba -->
      <div class="chips solo-grande" role="group" aria-label="Segmento del tarifario">
        @for (g of grupos(); track g[0]) {
          <button
            type="button"
            class="chip"
            [attr.aria-pressed]="grupoActual()?.[0] === g[0]"
            (click)="grupoSel.set(g[0])"
          >
            {{ g[0] }}
          </button>
        }
      </div>
      <pjl-vistas
        [opciones]="vistasChicas()"
        [vista]="vistaChica()"
        (vistaChange)="verVista($event)"
        etiqueta="Elegir segmento o simulador"
      />

      <div class="rejilla-2">
        @if (grupoActual(); as g) {
          <section class="panel grupo" [class.fuera-de-vista]="enSimulador()">
            <div class="panel-cab">
              <h2>{{ g[0] }}</h2>
              @if (g[1][0]['rangoVentas']) {
                <span class="muted rango">{{ g[1][0]['rangoVentas'] }}</span>
              }
            </div>
            <div class="desplazable" tabindex="-1">
              <div class="tabla-marco">
                <table class="tabla">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Producto</th>
                      <th class="num">Monto</th>
                      <th class="num">Plazo</th>
                      <th class="num">TN</th>
                      <th class="num">TN con aportación</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (p of g[1]; track p['id']) {
                      <tr
                        class="fila-link"
                        tabindex="0"
                        (click)="elegir(p)"
                        (keydown.enter)="elegir(p)"
                        [class.sel]="sim.idProducto === p['id']"
                      >
                        <td class="num">{{ p['codigo'] }}</td>
                        <td>
                          <span class="principal">{{ p['nombre'] }}</span><span
                            class="secundario"
                            >{{ p['descripcion'] }}</span
                          >
                        </td>
                        <td class="num">
                          {{ p['montoMinimo'] | dinero: true }} a
                          {{ p['montoMaximo'] | dinero: true }}
                        </td>
                        <td class="num">{{ p['plazoMaximoMeses'] }} m</td>
                        <td class="num principal">{{ p['tasaReferencial'] | pct: 2 }}</td>
                        <td class="num">
                          {{ p['tasaConAportacion'] ? (p['tasaConAportacion'] | pct: 2) : '—' }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        }

        <aside
          class="panel simulador"
          [class.fuera-de-vista]="!enSimulador()"
          aria-labelledby="sim-t"
        >
          <div class="panel-cab">
            <h2 id="sim-t"><pjl-icono nombre="calculadora" [tam]="18" /> Simulador</h2>
          </div>
          <form class="panel-cuerpo pila" (ngSubmit)="simular()">
            <div class="campo">
              <label for="sp">Producto</label>
              <select id="sp" class="entrada" name="sp" [(ngModel)]="sim.idProducto">
                @for (p of productos(); track p['id']) {
                  <option [ngValue]="p['id']">{{ p['codigo'] }} · {{ p['nombre'] }}</option>
                }
              </select>
            </div>
            <div class="campo">
              <label for="sm">Monto</label>
              <div class="entrada-prefijo">
                <span>$</span
                ><input
                  id="sm"
                  class="entrada num"
                  type="number"
                  name="sm"
                  [(ngModel)]="sim.monto"
                />
              </div>
            </div>
            <div class="campo">
              <label for="sz">Plazo (meses)</label
              ><input
                id="sz"
                class="entrada num"
                type="number"
                name="sz"
                [(ngModel)]="sim.plazoMeses"
              />
            </div>
            <button class="btn btn-primario" type="submit" [disabled]="simulando()">
              @if (simulando()) {
                <span class="giro"></span>
              }
              Calcular cuota
            </button>
            @if (errorSim()) {
              <p class="error" role="alert">{{ errorSim() }}</p>
            }
            @if (resultado(); as r) {
              <dl class="res" aria-live="polite">
                <div class="cuota">
                  <dt>Cuota mensual</dt>
                  <dd class="num">{{ r['cuota'] | dinero }}</dd>
                </div>
                <div>
                  <dt>Tasa nominal</dt>
                  <dd class="num">{{ r['tasaNominal'] | pct: 2 }}</dd>
                </div>
                <div>
                  <dt>Tasa efectiva anual</dt>
                  <dd class="num">{{ r['tasaEfectiva'] | pct: 2 }}</dd>
                </div>
                <div>
                  <dt>Total de intereses</dt>
                  <dd class="num">{{ r['totalIntereses'] | dinero }}</dd>
                </div>
                <div>
                  <dt>Total a pagar</dt>
                  <dd class="num">{{ r['totalPagar'] | dinero }}</dd>
                </div>
              </dl>
              <p class="muted nota-sim">{{ r['nota'] }}</p>
            }
          </form>
        </aside>
      </div>
    </div>
  `,
  styles: `
    .nota {
      display: flex;
      gap: 8px;
      align-items: center;
      font-size: var(--t-13);
      color: var(--aviso-700);
      background: var(--aviso-100);
      padding: 10px 14px;
      border-radius: var(--r-10);
    }
    .rango {
      font-size: var(--t-12);
      text-align: right;
    }
    tr.sel td {
      background: var(--ambar-100);
    }
    .grupo td.num {
      white-space: nowrap;
    }
    /* Panel angosto (laptop con el simulador al lado, tablet, teléfono): filas de una línea para que quepan sin desplazar */
    .grupo {
      container-type: inline-size;
    }
    .grupo th {
      white-space: normal;
    }
    @container (max-width: 760px) {
      .grupo .secundario {
        display: none;
      }
    }
    @container (max-width: 700px) {
      /* Solo entre columnas: la primera y la última siguen alineadas con el título del panel */
      .grupo th:not(:first-child),
      .grupo td:not(:first-child) {
        padding-left: 8px;
      }
      .grupo th:not(:last-child),
      .grupo td:not(:last-child) {
        padding-right: 8px;
      }
    }
    @media (max-height: 820px) {
      .grupo .secundario {
        display: none;
      }
    }
    /* PC y tablet: nada se desplaza salvo, si hiciera falta, el interior de cada panel */
    @media (min-width: 761px) {
      .rejilla-2 {
        flex: 0 1 auto;
        min-height: 0;
        grid-template-rows: minmax(0, 1fr);
      }
      .grupo,
      .simulador {
        max-height: 100%;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .simulador .panel-cuerpo {
        min-height: 0;
        overflow: auto;
      }
    }
    .simulador h2 {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .pila {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .error {
      color: var(--peligro-700);
      font-weight: 600;
      font-size: var(--t-13);
    }
    .res {
      margin: 0;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      padding: 14px;
      border-radius: var(--r-12);
      background: var(--azul-50);
    }
    .res .cuota {
      grid-column: 1 / -1;
    }
    .res dt {
      font-size: var(--t-12);
      color: var(--tinta-500);
      font-weight: 600;
    }
    .res dd {
      margin: 0;
      font-weight: 800;
    }
    .res .cuota dd {
      font-size: var(--t-30);
      color: var(--azul-900);
      letter-spacing: -0.02em;
    }
    .nota-sim {
      font-size: var(--t-12);
    }
  `,
})
export class Tarifario {
  private readonly api = inject(Api);
  protected readonly productos = signal<Mapa[]>([]);
  protected readonly meta = signal<Mapa | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly resultado = signal<Mapa | null>(null);
  protected readonly errorSim = signal<string | null>(null);
  protected readonly simulando = signal(false);
  protected sim = { idProducto: 7, monto: 5000, plazoMeses: 24 };
  protected readonly grupos = computed(() => {
    const m = new Map<string, Mapa[]>();
    for (const p of this.productos()) {
      const k = p['segmento'] === 'CONSUMO' ? 'Consumo' : `Microcrédito · ${p['subsegmento']}`;
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    return [...m.entries()];
  });

  /** Segmento a la vista (el primero si no se ha elegido). */
  protected readonly grupoSel = signal<string | null>(null);
  protected readonly grupoActual = computed(
    () => this.grupos().find((g) => g[0] === this.grupoSel()) ?? this.grupos()[0] ?? null,
  );
  /** Pantallas pequeñas: un segmento o el simulador. */
  protected readonly enSimulador = signal(false);
  protected readonly vistaChica = computed(() =>
    this.enSimulador() ? SIMULADOR : (this.grupoActual()?.[0] ?? ''),
  );
  protected readonly vistasChicas = computed<OpcionVista[]>(() => [
    ...this.grupos().map((g) => ({ id: g[0], texto: g[0] })),
    { id: SIMULADOR, texto: 'Simulador' },
  ]);

  constructor() {
    this.api
      .get<Mapa>('/info/productos')
      .then((r) => {
        this.productos.set(r['productos']);
        this.meta.set(r['meta']);
        this.simular();
      })
      .catch((e) => this.error.set(mensajeError(e)));
  }

  protected verVista(v: string): void {
    if (v === SIMULADOR) {
      this.enSimulador.set(true);
      return;
    }
    this.grupoSel.set(v);
    this.enSimulador.set(false);
  }

  /** Elegir un producto lo lleva al simulador (en pantallas pequeñas, cambia a esa sección). */
  protected elegir(p: Mapa) {
    this.enSimulador.set(true);
    this.sim = {
      idProducto: p['id'],
      monto: Math.min(Math.max(this.sim.monto, p['montoMinimo']), p['montoMaximo']),
      plazoMeses: Math.min(this.sim.plazoMeses, p['plazoMaximoMeses']),
    };
    this.simular();
  }

  protected async simular() {
    this.simulando.set(true);
    this.errorSim.set(null);
    try {
      this.resultado.set(await this.api.post<Mapa>('/info/simulacion', this.sim));
    } catch (e) {
      this.resultado.set(null);
      this.errorSim.set(mensajeError(e));
    } finally {
      this.simulando.set(false);
    }
  }
}
