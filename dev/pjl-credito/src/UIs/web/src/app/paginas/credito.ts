import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, Sesion, mensajeError } from '../nucleo/api';
import { Avisos, FORMATOS } from '../nucleo/formato';
import { Riesgo } from '../ui/etapas';
import { Icono } from '../ui/icono';
import { OpcionVista, Vistas } from '../ui/vistas';

type Mapa = Record<string, any>;

@Component({
  selector: 'pjl-credito',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Riesgo, Icono, Vistas, ...FORMATOS],
  template: `
    <div class="pagina">
      <a class="volver" routerLink="/cartera"><pjl-icono nombre="arrow-left" [tam]="16" /> Cartera</a>
      @if (error()) { <div class="aviso-error" role="alert">{{ error() }}</div> }
      @else if (c(); as c) {
        <header class="exp-cab">
          <div>
            <div class="linea-id"><span class="num op">{{ c['numeroOperacion'] }}</span>
              <span class="insignia" [class]="'insignia ' + (c['estado'] === 'VIGENTE' ? 'ok' : c['estado'] === 'CANCELADO' ? 'neutro' : 'peligro')">{{ c['estado'] | etiqueta }}</span>
              <pjl-riesgo [categoria]="c['categoriaRiesgo']" />
            </div>
            <h1>{{ c['socio'] }}</h1>
            <p class="meta"><span>{{ c['producto'] }}</span><span>{{ c['monto'] | dinero }} a {{ c['plazoMeses'] }} meses · {{ c['tasaNominal'] | pct: 2 }}</span>
              <span>Desembolso {{ c['fechaDesembolso'] | fecha }}</span><a [routerLink]="['/solicitudes', c['idSolicitud']]">Ver expediente</a></p>
          </div>
          <dl class="saldos">
            <div><dt>Saldo de capital</dt><dd class="num">{{ c['saldoCapital'] | dinero }}</dd></div>
            <div><dt>Total adeudado hoy</dt><dd class="num">{{ c['totalAdeudado'] | dinero }}</dd></div>
            <div><dt>Días de mora</dt><dd class="num" [class.alto]="c['diasMora'] > 0">{{ c['diasMora'] }}</dd></div>
            <div><dt>Score de comportamiento</dt><dd class="num">{{ c['scoreComportamiento'] ?? '—' }}</dd></div>
          </dl>
        </header>

        <pjl-vistas [opciones]="vistas()" [(vista)]="vista" etiqueta="Elegir sección del crédito" />

        <div class="rejilla-2">
          <section class="panel" [class.fuera-de-vista]="vista() !== 'tabla'">
            <div class="panel-cab"><h2>Tabla de amortización</h2><span class="muted">{{ c['cuotasPagadas'] }} de {{ c['plazoMeses'] }} pagadas</span></div>
            <div class="tabla-marco alto">
              <table class="tabla">
                <thead><tr><th class="num">N.º</th><th>Vence</th><th class="num">Capital</th><th class="num">Interés</th><th class="num">Cuota</th><th class="num">Saldo</th><th>Estado</th></tr></thead>
                <tbody>
                  @for (q of c['tabla']; track q['idCuota']) {
                    <tr [class.vencida]="q['estado'] === 'VENCIDA'">
                      <td class="num">{{ q['numero'] }}</td><td>{{ q['fechaVencimiento'] | fecha }}</td>
                      <td class="num">{{ q['capital'] | dinero }}</td><td class="num">{{ q['interes'] | dinero }}</td>
                      <td class="num principal">{{ q['valorCuota'] | dinero }}</td><td class="num">{{ q['saldoCapital'] | dinero }}</td>
                      <td><span class="insignia" [class]="'insignia ' + (q['estado'] === 'PAGADA' ? 'ok' : q['estado'] === 'VENCIDA' ? 'peligro' : q['estado'] === 'PARCIAL' ? 'aviso' : 'neutro')">{{ q['estado'] | etiqueta }}@if (q['diasAtraso'] > 0) { · {{ q['diasAtraso'] }} d }</span></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>

          <div class="lateral">
            @if (puedePagar()) {
              <section class="panel" [class.fuera-de-vista]="vista() !== 'pago'">
                <div class="panel-cab"><h2>Pago en ventanilla</h2></div>
                <form class="panel-cuerpo pila" (ngSubmit)="pagar()">
                  <div class="campo">
                    <label for="monto-pago">Monto recibido</label>
                    <div class="entrada-prefijo"><span>$</span><input id="monto-pago" class="entrada num" type="number" min="0.01" step="0.01" name="monto" [(ngModel)]="montoPago" /></div>
                    <span class="ayuda">Se aplica a mora, interés y capital desde la cuota más antigua.</span>
                  </div>
                  <button class="btn btn-primario" type="submit" [disabled]="!!trabajando()">@if (trabajando() === 'pago') { <span class="giro"></span> } Registrar pago</button>
                </form>
              </section>
            }
            @if (puedeGestionar()) {
              <section class="panel" [class.fuera-de-vista]="vista() !== 'cobranza'">
                <div class="panel-cab"><h2>Gestión de cobranza</h2><span class="insignia aviso">{{ c['faseCobranza'] | etiqueta }}</span></div>
                <form class="panel-cuerpo pila" (ngSubmit)="gestionar()">
                  <div class="campo"><label for="acc">Acción</label>
                    <select id="acc" class="entrada" name="acc" [(ngModel)]="gestion.accion"><option value="LLAMADA">Llamada</option><option value="MENSAJE">Mensaje</option><option value="VISITA">Visita</option><option value="NOTIFICACION">Notificación</option><option value="ACUERDO_PAGO">Acuerdo de pago</option><option value="DEMANDA">Demanda judicial</option></select></div>
                  <div class="campo"><label for="res">Resultado</label>
                    <select id="res" class="entrada" name="res" [(ngModel)]="gestion.resultado"><option value="CONTACTADO">Contactado</option><option value="NO_CONTACTADO">No contactado</option><option value="PROMESA_PAGO">Promesa de pago</option><option value="PAGO_REALIZADO">Pago realizado</option><option value="RENUENTE">Renuente</option></select></div>
                  @if (gestion.resultado === 'PROMESA_PAGO') {
                    <div class="campo"><label for="fc">Fecha del compromiso</label><input id="fc" class="entrada" type="date" name="fc" [(ngModel)]="gestion.fechaCompromiso" /></div>
                  }
                  <div class="campo"><label for="ob">Observación</label><textarea id="ob" class="entrada" name="ob" rows="2" [(ngModel)]="gestion.observacion"></textarea></div>
                  <button class="btn" type="submit" [disabled]="!!trabajando()">@if (trabajando() === 'gestion') { <span class="giro"></span> } Registrar gestión</button>
                </form>
              </section>
            }
            @if (errorAccion()) { <p class="aviso-error" role="alert">{{ errorAccion() }}</p> }
            <section class="panel" [class.fuera-de-vista]="vista() !== 'historial'">
              <div class="panel-cab"><h2>Historial</h2></div>
              <ul class="historial">
                @for (g of c['gestiones']; track g['idGestion']) {
                  <li><strong>{{ g['accion'] | etiqueta }} · {{ g['resultado'] | etiqueta }}</strong><span>{{ g['observacion'] }}</span><span class="muted">{{ g['gestor'] }} · {{ g['fecha'] | fecha: true }}</span></li>
                }
                @for (p of c['pagos'].slice(0, 6); track p['idPago']) {
                  <li><strong>Pago {{ p['monto'] | dinero }} · {{ p['canal'] | etiqueta }}</strong><span class="muted">{{ p['referencia'] }} · {{ p['fechaPago'] | fecha: true }}</span></li>
                }
                @if (!c['gestiones'].length && !c['pagos'].length) { <li class="muted">Sin movimientos todavía.</li> }
              </ul>
            </section>
          </div>
        </div>
      } @else {
        <div class="esqueleto" style="height: 120px; border-radius: 16px"></div>
        <div class="esqueleto" style="height: 420px; border-radius: 16px"></div>
      }
    </div>
  `,
  styles: `
    .volver { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; font-size: var(--t-13); text-decoration: none; align-self: flex-start; min-height: 32px; }
    .exp-cab { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 20px; }
    .linea-id { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .op { font-weight: 800; color: var(--azul-700); }
    .meta { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 8px; color: var(--tinta-600); font-size: var(--t-13); }
    .saldos { display: grid; grid-template-columns: repeat(4, auto); gap: 4px 28px; margin: 0; }
    .saldos dt { font-size: var(--t-12); color: var(--tinta-500); font-weight: 600; }
    .saldos dd { margin: 0; font-size: var(--t-20); font-weight: 800; color: var(--azul-900); }
    .saldos dd.alto { color: var(--peligro-700); }
    @media (max-width: 700px) { .saldos { grid-template-columns: repeat(2, auto); } }
    .alto { max-height: 560px; overflow: auto; }
    tr.vencida td { background: var(--peligro-100); }
    .lateral { display: flex; flex-direction: column; gap: 20px; }
    .pila { display: flex; flex-direction: column; gap: 14px; }
    .historial { list-style: none; margin: 0; padding: 0 20px 16px; display: flex; flex-direction: column; gap: 12px; }
    .historial li { display: flex; flex-direction: column; gap: 2px; font-size: var(--t-13); padding-bottom: 12px; border-bottom: 1px solid var(--tinta-100); }
    .historial li:last-child { border-bottom: 0; }
  `,
})
export class Credito {
  private readonly api = inject(Api);
  private readonly avisos = inject(Avisos);
  protected readonly sesion = inject(Sesion);
  readonly id = input.required<string>();
  protected readonly c = signal<Mapa | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly errorAccion = signal<string | null>(null);
  protected readonly trabajando = signal<string | null>(null);
  protected readonly puedePagar = computed(() => this.c()?.['estado'] !== 'CANCELADO' && this.sesion.puede('OPERACIONES', 'CARTERA', 'COBRANZA'));
  protected readonly puedeGestionar = computed(() => this.c()?.['estado'] !== 'CANCELADO' && this.sesion.puede('COBRANZA', 'CARTERA'));
  /** Pantallas pequeñas: una sección a la vez; Pago y Cobranza solo si el rol puede usarlas. */
  protected readonly vistas = computed<OpcionVista[]>(() => [
    { id: 'tabla', texto: 'Amortización' },
    ...(this.puedePagar() ? [{ id: 'pago', texto: 'Pago' }] : []),
    ...(this.puedeGestionar() ? [{ id: 'cobranza', texto: 'Cobranza' }] : []),
    { id: 'historial', texto: 'Historial' },
  ]);
  protected readonly vista = signal('tabla');
  protected montoPago: number | null = null;
  protected gestion = { accion: 'LLAMADA', resultado: 'CONTACTADO', fechaCompromiso: '', observacion: '' };

  constructor() { effect(() => { this.cargar(this.id()); }); }

  private async cargar(id = this.id()) {
    try {
      const c = await this.api.get<Mapa>(`/cartera/${id}`);
      this.c.set(c);
      const prox = (c['tabla'] as Mapa[]).find((q) => q['estado'] !== 'PAGADA');
      this.montoPago = prox ? Math.round(prox['pendiente'] * 100) / 100 : null;
    } catch (e) { this.error.set(mensajeError(e)); }
  }

  private async hacer(nombre: string, fn: () => Promise<unknown>, ok: string) {
    this.trabajando.set(nombre); this.errorAccion.set(null);
    try { await fn(); await this.cargar(); this.avisos.mostrar(ok); } catch (e) { this.errorAccion.set(mensajeError(e)); } finally { this.trabajando.set(null); }
  }

  protected pagar() { return this.hacer('pago', () => this.api.post(`/cartera/${this.id()}/pagos`, { monto: this.montoPago }), 'Pago registrado y aplicado a la tabla de amortización.'); }
  protected gestionar() {
    return this.hacer('gestion', async () => {
      await this.api.post(`/cartera/${this.id()}/gestiones`, { ...this.gestion, fechaCompromiso: this.gestion.fechaCompromiso || null, montoCompromiso: this.c()?.['cuotaMensual'] });
      this.gestion = { accion: 'LLAMADA', resultado: 'CONTACTADO', fechaCompromiso: '', observacion: '' };
    }, 'Gestión de cobranza registrada.');
  }
}
