import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, ROL_NOMBRE, Rol, Sesion, Usuario, mensajeError } from '../nucleo/api';
import { Icono } from '../ui/icono';
import { MarcoAcceso } from '../ui/marco-acceso';

interface Demo { clave: string; personal: { usuario: string; nombreCompleto: string; rol: Rol; agencia: string }[]; }

@Component({
  selector: 'pjl-ingreso',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icono, MarcoAcceso],
  template: `
    <pjl-marco-acceso>
          <h1 class="sr-only">Ingresar a LorenteScore</h1>
          <p class="suave">Plataforma interna para el personal de crédito.</p>
          @if (vencida()) { <p class="aviso-sesion" role="status">Tu sesión terminó. Ingresa de nuevo.</p> }
          <form (ngSubmit)="ingresar()" class="campos" novalidate>
            <div class="campo">
              <label for="usuario">Usuario</label>
              <input id="usuario" name="usuario" class="entrada" autocomplete="username" [(ngModel)]="usuario" required
                     [attr.aria-invalid]="!!error()" aria-describedby="error-ingreso" />
            </div>
            <div class="campo">
              <div class="fila-etiqueta">
                <label for="clave">Clave</label>
                <a routerLink="/recuperar">¿Olvidaste tu clave?</a>
              </div>
              <input id="clave" name="clave" type="password" class="entrada" autocomplete="current-password" [(ngModel)]="clave" required
                     [attr.aria-invalid]="!!error()" aria-describedby="error-ingreso" />
            </div>
            @if (error()) { <p id="error-ingreso" class="error" role="alert">{{ error() }}</p> }
            <button class="btn btn-primario btn-grande" type="submit" [disabled]="cargando()">
              @if (cargando()) { <span class="giro" aria-hidden="true"></span> Verificando… } @else { Ingresar }
            </button>
          </form>

          @if (demo(); as d) {
            <section class="demo" aria-labelledby="demo-titulo">
              <h2 id="demo-titulo">Cuentas de demostración</h2>
              <p class="muted">Datos de prueba. Clave de todas: <code>{{ d.clave }}</code></p>
              <ul>
                @for (p of d.personal; track p.usuario) {
                  <li>
                    <button type="button" (click)="elegir(p.usuario, d.clave)">
                      <span class="rol">{{ rol(p.rol) }}</span>
                      <span class="nombre">{{ p.nombreCompleto }}</span>
                      <pjl-icono nombre="chevron-right" [tam]="16" />
                    </button>
                  </li>
                }
              </ul>
            </section>
          }
    </pjl-marco-acceso>
  `,
  styles: `
    .suave { font-size: var(--t-15); }
    .fila-etiqueta { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
    .fila-etiqueta label { font-size: var(--t-13); font-weight: 600; color: var(--tinta-700); }
    .fila-etiqueta a { font-size: var(--t-13); font-weight: 700; text-decoration: none; }
    .fila-etiqueta a:hover { text-decoration: underline; }
    .campos { display: flex; flex-direction: column; gap: 16px; margin-top: 18px; }
    .campos .btn { width: 100%; margin-top: 4px; }
    .error { color: var(--peligro-700); font-weight: 600; font-size: var(--t-13); }
    .aviso-sesion { margin-top: 8px; padding: 10px 12px; border-radius: var(--r-10); background: var(--aviso-100); color: var(--aviso-700); font-weight: 600; font-size: var(--t-13); }
    .demo { margin-top: 28px; padding-top: 22px; border-top: 1px solid var(--linea); }
    .demo h2 { font-size: var(--t-14); }
    .demo p { font-size: var(--t-13); margin: 4px 0 12px; }
    code { font-family: inherit; font-weight: 800; color: var(--tinta-900); background: var(--ambar-100); padding: 1px 6px; border-radius: 4px; }
    .demo ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
    .demo button {
      width: 100%; display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 6px 12px; border-radius: var(--r-10);
      border: 1px solid var(--linea); background: var(--superficie-2); cursor: pointer; text-align: left;
      transition: border-color var(--dur-ui) ease, background-color var(--dur-ui) ease, transform var(--dur-press) var(--ease-out);
    }
    .demo button:active { transform: scale(0.98); }
    @media (hover: hover) and (pointer: fine) { .demo button:hover { border-color: var(--azul-300); background: var(--azul-50); } }
    .rol { font-size: var(--t-12); font-weight: 700; color: var(--azul-700); width: 150px; flex: none; }
    .nombre { flex: 1; font-weight: 600; font-size: var(--t-13); }
    .demo pjl-icono { color: var(--tinta-500); }
    @media (max-width: 900px) { .rol { width: 120px; } }
  `,
})
export class Ingreso implements OnInit {
  private readonly api = inject(Api);
  private readonly sesion = inject(Sesion);
  private readonly router = inject(Router);
  readonly vencida = input<string>();
  readonly cuenta = input<string>();

  protected usuario = '';
  protected clave = '';
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly demo = signal<Demo | null>(null);

  constructor() {
    this.api.get<Demo>('/auth/demo').then((d) => this.demo.set(d)).catch(() => this.demo.set(null));
  }

  ngOnInit(): void {
    const c = this.cuenta();
    if (c) {
      this.usuario = c;
      queueMicrotask(() => document.getElementById('clave')?.focus());
    }
  }

  protected rol(r: Rol) { return ROL_NOMBRE[r] ?? r; }

  protected elegir(usuario: string, clave: string): void {
    this.usuario = usuario;
    this.clave = clave;
    this.ingresar();
  }

  protected async ingresar(): Promise<void> {
    if (!this.usuario.trim() || !this.clave) { this.error.set('Escribe tu usuario y tu clave.'); return; }
    this.cargando.set(true);
    this.error.set(null);
    try {
      const r = await this.api.post<{ token: string; expiraEn: number; usuario: Usuario }>('/auth/login', { usuario: this.usuario, clave: this.clave, app: 'web' });
      this.sesion.iniciar(r.token, r.usuario, r.expiraEn);
      // Pantalla de carga de LorenteScore: verifica la sesión, precarga el panel y ofrece entrar o cambiar de usuario.
      await this.router.navigateByUrl('/cargando');
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }
}
