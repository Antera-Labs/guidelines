import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icono } from '../ui/icono';

/**
 * Portada pública de LorenteScore: invita a ingresar. Con la sesión abierta, la ruta lleva al panel;
 * la bienvenida con el nombre del usuario está en la pantalla de carga (paginas/carga.ts).
 */
@Component({
  selector: 'pjl-bienvenida',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icono],
  template: `
    <main class="bienvenida">
      <div class="centro">
        <img class="logo" src="logo-pjl-512.png" alt="" width="512" height="512" />
        <h1>
          <span class="bienvenidos">Bienvenidos a</span>
          <span class="nombre">Lorente<span>Score</span></span>
        </h1>
        <p class="cooperativa">Cooperativa de Ahorro y Crédito Padre Julián Lorente</p>
        <div class="acciones">
          <a class="btn btn-ambar btn-grande" routerLink="/ingreso">
            Ingresar <pjl-icono nombre="flecha-derecha" [tam]="18" />
          </a>
        </div>
        <p class="nota">Uso exclusivo del personal de la cooperativa.</p>
      </div>
    </main>
  `,
  styles: `
    :host {
      display: block;
    }
    .bienvenida {
      min-height: 100dvh;
      display: grid;
      background: linear-gradient(180deg, var(--azul-700) 0%, var(--azul-900) 100%);
      color: #fff;
      overflow: hidden;
    }
    .centro {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 48px 20px 64px;
    }
    .logo {
      width: clamp(132px, 26dvh, 240px);
      height: auto;
      aspect-ratio: 1;
      border-radius: 50%;
      box-shadow: 0 26px 60px -24px rgba(5, 22, 38, 0.7);
    }
    h1 {
      margin-top: clamp(20px, 3dvh, 32px);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      color: #fff;
    }
    .bienvenidos {
      font-size: clamp(1.5rem, 1.4vw + 1rem, 2.25rem);
      font-weight: 600;
      letter-spacing: -0.02em;
      line-height: 1.1;
      color: var(--azul-100);
    }
    .nombre {
      font-size: clamp(3rem, 4.5vw + 1.5rem, 5.75rem);
      font-weight: 800;
      letter-spacing: -0.04em;
      line-height: 1;
    }
    .nombre span {
      color: var(--ambar-500);
    }
    .cooperativa {
      margin-top: 16px;
      font-size: clamp(1.0625rem, 0.6vw + 0.9rem, 1.3125rem);
      font-weight: 700;
      letter-spacing: -0.01em;
      color: var(--azul-100);
      text-wrap: balance;
    }
    .acciones {
      margin-top: 28px;
      justify-content: center;
      gap: 12px;
    }
    .acciones .btn {
      min-width: 180px;
    }
    .acciones pjl-icono {
      transition: translate var(--dur-ui) var(--ease-out);
    }
    .btn:focus-visible {
      box-shadow:
        0 0 0 2px var(--azul-900),
        0 0 0 4px var(--ambar-300);
    }
    @media (hover: hover) and (pointer: fine) {
      .btn-ambar:hover pjl-icono {
        translate: 3px 0;
      }
    }
    .nota {
      margin-top: 14px;
      font-size: var(--t-13);
      color: var(--azul-200);
    }

    @media (max-width: 640px) {
      .centro {
        padding-top: 40px;
      }
      .logo {
        width: 112px;
      }
      .acciones {
        flex-direction: column;
        align-items: stretch;
        width: min(320px, 100%);
      }
    }
  `,
})
export class Bienvenida {}
