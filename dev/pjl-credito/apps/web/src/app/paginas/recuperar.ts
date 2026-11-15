import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, mensajeError } from '../nucleo/api';
import { Icono } from '../ui/icono';
import { MarcoAcceso } from '../ui/marco-acceso';

/** Paso 1 de la recuperación: pedir el enlace al correo registrado. */
@Component({
  selector: 'pjl-recuperar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icono, MarcoAcceso],
  template: `
    <pjl-marco-acceso>
      @if (!enviado()) {
        <h1>Recupera tu clave</h1>
        <p class="suave">Escribe tu usuario. Te enviaremos un enlace a tu correo registrado para que crees una nueva clave.</p>
        <form (ngSubmit)="enviar()" class="campos" novalidate>
          <div class="campo">
            <label for="usuario">Usuario</label>
            <input id="usuario" name="usuario" class="entrada" autocomplete="username" autocapitalize="none" spellcheck="false"
                   [(ngModel)]="usuario" [attr.aria-invalid]="!!error()" aria-describedby="error-recuperar" />
          </div>
          @if (error()) { <p id="error-recuperar" class="error" role="alert">{{ error() }}</p> }
          <button class="btn btn-primario btn-grande" type="submit" [disabled]="cargando()">
            @if (cargando()) { <span class="giro" aria-hidden="true"></span> Enviando… } @else { Enviar enlace }
          </button>
        </form>
        <a class="volver" routerLink="/ingreso"><pjl-icono nombre="arrow-left" [tam]="16" /> Volver a ingresar</a>
      } @else {
        <span class="sello" aria-hidden="true"><pjl-icono nombre="correo-enviado" [tam]="28" /></span>
        <h1 id="titulo-enviado" tabindex="-1">Revisa tu correo</h1>
        <p>Si el usuario <strong>{{ usuario.trim() }}</strong> existe y tiene un correo registrado, te enviamos un enlace para crear una nueva clave.
           El enlace vence en {{ minutos() }} minutos y sirve una sola vez.</p>
        <p class="suave">¿No llegó? Revisa la carpeta de correo no deseado o
          <button type="button" class="enlace" (click)="otraVez()">pide otro enlace</button>.</p>
        @if (buzon(); as b) {
          <p class="prueba">Entorno de prueba: los correos llegan al <a [href]="b" target="_blank" rel="noopener">buzón de desarrollo</a>.</p>
        }
        <a class="btn btn-grande" routerLink="/ingreso">Volver a ingresar</a>
      }
    </pjl-marco-acceso>
  `,
  styles: `
    h1 { font-size: var(--t-30); }
    p { font-size: var(--t-15); }
    .suave { color: var(--tinta-600); }
    .campos { display: flex; flex-direction: column; gap: 16px; margin-top: 18px; }
    .btn-grande { width: 100%; }
    .error { color: var(--peligro-700); font-weight: 600; font-size: var(--t-13); }
    .volver { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; margin-top: 14px; min-height: 44px; font-weight: 700; font-size: var(--t-14); text-decoration: none; }
    .sello { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; background: var(--ok-100); color: var(--ok-700); margin-bottom: 6px; }
    #titulo-enviado { outline: none; }
    .enlace { border: 0; background: none; padding: 0; font: inherit; font-weight: 700; color: var(--azul-700); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
    .prueba { margin-top: 4px; padding: 10px 12px; border-radius: var(--r-10); background: var(--ambar-100); color: var(--ambar-800); font-size: var(--t-13); font-weight: 600; }
    .prueba a { color: inherit; font-weight: 800; }
    p + .btn { margin-top: 14px; }
  `,
})
export class Recuperar {
  private readonly api = inject(Api);

  protected usuario = '';
  protected readonly cargando = signal(false);
  protected readonly enviado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly minutos = signal(30);
  protected readonly buzon = signal<string | null>(null);

  constructor() {
    // Solo responde con el perfil «simulador»: enlaza el buzón de Mailpit para las pruebas.
    this.api.get<{ buzon?: string }>('/auth/demo').then((d) => this.buzon.set(d.buzon ?? null)).catch(() => this.buzon.set(null));
  }

  protected async enviar(): Promise<void> {
    if (!this.usuario.trim()) { this.error.set('Escribe tu usuario.'); return; }
    this.cargando.set(true);
    this.error.set(null);
    try {
      const r = await this.api.post<{ minutos: number }>('/auth/recuperar', { usuario: this.usuario.trim() });
      this.minutos.set(r.minutos ?? 30);
      this.enviado.set(true);
      queueMicrotask(() => document.getElementById('titulo-enviado')?.focus());
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected otraVez(): void {
    this.enviado.set(false);
    queueMicrotask(() => document.getElementById('usuario')?.focus());
  }
}
