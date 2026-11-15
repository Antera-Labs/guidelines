import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Sesion, mensajeError } from '../nucleo/api';
import { Avisos, FORMATOS } from '../nucleo/formato';
import { Riesgo } from '../ui/etapas';
import { Icono } from '../ui/icono';

type Mapa = Record<string, any>;

@Component({
  selector: 'pjl-provisiones',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Riesgo, Icono, ...FORMATOS],
  template: `
    <div class="pagina">
      <header class="cabecera">
        <div>
          <h1>Pérdida esperada de la cartera</h1>
        </div>
        <div class="acciones">
          @if (datos(); as d) {
            <label class="campo"><span class="sr-only">Período</span>
              <select class="entrada" [ngModel]="d['periodo']" (ngModelChange)="cargar($event)" name="periodo">
                @for (p of d['periodos']; track p) { <option [value]="p">{{ p }}</option> }
              </select>
            </label>
          }
          @if (sesion.puede('CARTERA', 'RIESGO')) {
            <button class="btn btn-primario" type="button" (click)="calcular()" [disabled]="calculando()">
              @if (calculando()) { <span class="giro"></span> } @else { <pjl-icono nombre="balanza" /> } Calcular el mes actual
            </button>
          }
        </div>
      </header>
      <p class="suave intro">Pérdida esperada = PD × LGD × EAD. La PD sale de la categoría por días de mora (A 2 %, B 8 %, C 25 %, D 60 %, E 100 %), la LGD de la garantía y la EAD del saldo de capital más el interés vencido.</p>

      @if (error()) { <div class="aviso-error" role="alert">{{ error() }}</div> }
      @if (datos(); as d) {
        <section class="panel">
          <div class="tabla-marco">
            <table class="tabla">
              <thead><tr><th>Categoría</th><th class="num">Créditos</th><th class="num">EAD</th><th class="num">PD promedio</th><th class="num">LGD promedio</th><th class="num">Pérdida esperada</th><th>Participación</th></tr></thead>
              <tbody>
                @for (f of d['categorias']; track f['categoria']) {
                  <tr>
                    <td><pjl-riesgo [categoria]="f['categoria']" /></td>
                    <td class="num">{{ f['creditos'] }}</td>
                    <td class="num">{{ f['ead'] | dinero }}</td>
                    <td class="num">{{ f['pdPromedio'] | pct: 1 : true }}</td>
                    <td class="num">{{ f['lgdPromedio'] | pct: 1 : true }}</td>
                    <td class="num principal">{{ f['perdidaEsperada'] | dinero }}</td>
                    <td class="barra-celda"><span class="barra" [class]="'barra riesgo-' + f['categoria']" [style.width.%]="participacion(f)"></span><span class="num muted">{{ participacion(f) | numero: 1 }} %</span></td>
                  </tr>
                } @empty { <tr><td colspan="7"><div class="vacio"><strong>Sin provisiones para este período</strong><span>Ejecuta el cálculo del mes.</span></div></td></tr> }
              </tbody>
              @if (d['categorias'].length) {
                <tfoot><tr><th>Total</th><th class="num">{{ d['total']['creditos'] }}</th><th class="num">{{ d['total']['ead'] | dinero }}</th><th></th><th></th><th class="num">{{ d['total']['perdidaEsperada'] | dinero }}</th><th class="num">{{ cobertura() | pct: 2 }} de la EAD</th></tr></tfoot>
              }
            </table>
          </div>
        </section>
      }
    </div>
  `,
  styles: `
    .intro { max-width: 90ch; }
    tfoot th { font-size: var(--t-14); color: var(--tinta-900); text-transform: none; letter-spacing: 0; border-top: 1px solid var(--linea); border-bottom: 0; background: var(--superficie-2); }
    tfoot th.num { text-align: right; }
    .barra-celda { min-width: 200px; display: flex; align-items: center; gap: 10px; }
    .barra { display: block; height: 10px; border-radius: 0 var(--r-pill) var(--r-pill) 0; min-width: 2px; max-width: 140px; }
    .barra.riesgo-A { background: var(--riesgo-a); } .barra.riesgo-B { background: var(--riesgo-b); } .barra.riesgo-C { background: var(--ambar-600); }
    .barra.riesgo-D { background: var(--riesgo-d); } .barra.riesgo-E { background: var(--riesgo-e); }
  `,
})
export class Provisiones {
  private readonly api = inject(Api);
  private readonly avisos = inject(Avisos);
  protected readonly sesion = inject(Sesion);
  protected readonly datos = signal<Mapa | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly calculando = signal(false);
  protected readonly cobertura = computed(() => {
    const t = this.datos()?.['total'];
    return t && t['ead'] ? (t['perdidaEsperada'] / t['ead']) * 100 : 0;
  });

  constructor() { this.cargar(); }

  protected async cargar(periodo?: string) {
    try { this.datos.set(await this.api.get<Mapa>('/provisiones', { periodo })); this.error.set(null); } catch (e) { this.error.set(mensajeError(e)); }
  }

  protected participacion(f: Mapa): number {
    const t = this.datos()?.['total']?.['perdidaEsperada'];
    return t ? (f['perdidaEsperada'] / t) * 100 : 0;
  }

  protected async calcular() {
    this.calculando.set(true);
    try { this.datos.set(await this.api.post<Mapa>('/provisiones/calculo', {})); this.avisos.mostrar('Provisiones recalculadas con la cartera de hoy.'); }
    catch (e) { this.avisos.mostrar(mensajeError(e), 'error'); } finally { this.calculando.set(false); }
  }
}
