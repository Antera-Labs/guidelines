import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, mensajeError } from '../nucleo/api';
import { Icono } from '../ui/icono';
import { MarcoAcceso } from '../ui/marco-acceso';

type Estado = 'verificando' | 'invalido' | 'formulario' | 'listo';

/**
 * Pasos 2 y 3 de la recuperación: abrir el enlace del correo y crear la nueva clave.
 * El token llega en el fragmento (#token=…), que el navegador no envía al servidor ni a los registros,
 * y se borra de la barra de direcciones apenas se lee.
 */
@Component({
  selector: 'pjl-restablecer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icono, MarcoAcceso],
  template: `
    <pjl-marco-acceso>
      @switch (estado()) {
        @case ('verificando') {
          <p class="suave cargando" role="status"><span class="giro" aria-hidden="true"></span> Comprobando el enlace…</p>
        }
        @case ('invalido') {
          <span class="sello alerta" aria-hidden="true"><pjl-icono nombre="alerta" [tam]="28" /></span>
          <h1>El enlace ya no sirve</h1>
          <p class="suave">Venció o ya se usó. Cada enlace dura {{ minutos }} minutos y sirve una sola vez.</p>
          <a class="btn btn-primario btn-grande" routerLink="/recuperar">Pedir un enlace nuevo</a>
          <a class="volver" routerLink="/ingreso"><pjl-icono nombre="arrow-left" [tam]="16" /> Volver a ingresar</a>
        }
        @case ('formulario') {
          <h1>Crea tu nueva clave</h1>
          <p class="suave">Hola, {{ nombre() }}. Elige una clave que no uses en otros sitios.</p>
          <form (ngSubmit)="guardar()" class="campos" novalidate>
            <div class="campo">
              <label for="clave">Nueva clave</label>
              <div class="con-ojo">
                <input id="clave" name="clave" class="entrada" [type]="ver() ? 'text' : 'password'" autocomplete="new-password"
                       [(ngModel)]="clave" (ngModelChange)="tocar()" aria-describedby="reglas" [attr.aria-invalid]="!!error()" />
                <button type="button" class="ojo" (click)="ver.set(!ver())" [attr.aria-pressed]="ver()" [attr.aria-label]="ver() ? 'Ocultar clave' : 'Mostrar clave'">
                  <pjl-icono [nombre]="ver() ? 'ocultar' : 'ver'" [tam]="18" />
                </button>
              </div>
            </div>
            <div class="campo">
              <label for="repetir">Repite la clave</label>
              <input id="repetir" name="repetir" class="entrada" [type]="ver() ? 'text' : 'password'" autocomplete="new-password"
                     [(ngModel)]="repetir" (ngModelChange)="tocar()" [attr.aria-invalid]="!!error()" />
            </div>
            <ul id="reglas" class="reglas" aria-label="Requisitos de la clave">
              @for (r of reglas(); track r.texto) {
                <li [class.ok]="r.ok">
                  <pjl-icono [nombre]="r.ok ? 'ok' : 'info'" [tam]="16" />
                  {{ r.texto }}<span class="sr-only">{{ r.ok ? ': cumplido' : ': pendiente' }}</span>
                </li>
              }
            </ul>
            @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
            <button class="btn btn-primario btn-grande" type="submit" [disabled]="guardando()">
              @if (guardando()) { <span class="giro" aria-hidden="true"></span> Guardando… } @else { <pjl-icono nombre="llave" [tam]="18" /> Guardar nueva clave }
            </button>
          </form>
        }
        @case ('listo') {
          <span class="sello" aria-hidden="true"><pjl-icono nombre="ok" [tam]="28" /></span>
          <h1 id="titulo-listo" tabindex="-1">Tu clave se cambió</h1>
          <p class="suave">Ya puedes ingresar con tu nueva clave. Te enviamos un aviso a tu correo.</p>
          <a class="btn btn-primario btn-grande" routerLink="/ingreso" [queryParams]="{ cuenta: usuario() }">Ingresar</a>
        }
      }
    </pjl-marco-acceso>
  `,
  styles: `
    h1 { font-size: var(--t-30); }
    p { font-size: var(--t-15); }
    .suave { color: var(--tinta-600); }
    .cargando { display: flex; align-items: center; gap: 10px; }
    .campos { display: flex; flex-direction: column; gap: 16px; margin-top: 18px; }
    .btn-grande { width: 100%; }
    p + .btn { margin-top: 14px; }
    .error { color: var(--peligro-700); font-weight: 600; font-size: var(--t-13); }
    .volver { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; margin-top: 6px; min-height: 44px; font-weight: 700; font-size: var(--t-14); text-decoration: none; }
    .sello { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; background: var(--ok-100); color: var(--ok-700); margin-bottom: 6px; }
    .sello.alerta { background: var(--aviso-100); color: var(--aviso-700); }
    #titulo-listo { outline: none; }
    .con-ojo { position: relative; }
    .con-ojo .entrada { width: 100%; padding-right: 48px; }
    .ojo { position: absolute; right: 2px; top: 50%; translate: 0 -50%; width: 40px; height: 40px; border: 0; border-radius: var(--r-10); background: transparent; color: var(--tinta-600); display: grid; place-items: center; cursor: pointer; }
    @media (hover: hover) and (pointer: fine) { .ojo:hover { background: var(--azul-50); color: var(--azul-700); } }
    .reglas { list-style: none; margin: -4px 0 0; padding: 0; display: grid; gap: 4px; }
    .reglas li { display: flex; align-items: center; gap: 8px; font-size: var(--t-13); color: var(--tinta-600); font-weight: 600; }
    .reglas li pjl-icono { color: var(--tinta-300); transition: color var(--dur-ui) ease; }
    .reglas li.ok { color: var(--ok-700); }
    .reglas li.ok pjl-icono { color: var(--ok-500); }
  `,
})
export class Restablecer {
  private readonly api = inject(Api);

  protected readonly minutos = 30;
  protected readonly estado = signal<Estado>('verificando');
  protected readonly nombre = signal('');
  protected readonly usuario = signal('');
  protected readonly ver = signal(false);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly version = signal(0);
  private readonly token: string;
  protected clave = '';
  protected repetir = '';

  /** Las mismas reglas que valida core-api. */
  protected readonly reglas = computed(() => {
    this.version();
    const c = this.clave;
    const u = this.usuario().toLowerCase();
    return [
      { texto: 'Al menos 10 caracteres', ok: c.length >= 10 && new TextEncoder().encode(c).length <= 72 },
      { texto: 'Letras y números', ok: /\p{L}/u.test(c) && /\d/.test(c) },
      { texto: 'Sin tu usuario', ok: c.length > 0 && (!u || !c.toLowerCase().includes(u)) },
      { texto: 'Las dos claves coinciden', ok: c.length > 0 && c === this.repetir },
    ];
  });

  constructor() {
    const fragmento = new URLSearchParams(location.hash.replace(/^#/, ''));
    this.token = fragmento.get('token') ?? '';
    if (location.hash) history.replaceState(history.state, '', location.pathname);
    this.verificar();
  }

  protected tocar(): void { this.version.update((v) => v + 1); this.error.set(null); }

  private async verificar(): Promise<void> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(this.token)) { this.estado.set('invalido'); return; }
    try {
      const r = await this.api.post<{ valido: boolean; nombre?: string; usuario?: string }>('/auth/recuperar/verificar', { token: this.token });
      if (!r.valido) { this.estado.set('invalido'); return; }
      this.nombre.set(r.nombre ?? '');
      this.usuario.set(r.usuario ?? '');
      this.estado.set('formulario');
      queueMicrotask(() => document.getElementById('clave')?.focus());
    } catch (e) {
      this.estado.set('invalido');
    }
  }

  protected async guardar(): Promise<void> {
    const pendiente = this.reglas().find((r) => !r.ok);
    if (pendiente) { this.error.set(`Revisa la clave: ${pendiente.texto.toLowerCase()}.`); return; }
    this.guardando.set(true);
    this.error.set(null);
    try {
      await this.api.post('/auth/recuperar/restablecer', { token: this.token, clave: this.clave });
      this.clave = '';
      this.repetir = '';
      this.estado.set('listo');
      queueMicrotask(() => document.getElementById('titulo-listo')?.focus());
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 410) { this.estado.set('invalido'); return; }
      this.error.set(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
