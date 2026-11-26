import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Marco de las pantallas de acceso (ingreso, recuperar y restablecer la clave):
 * campo azul del escudo con el logo y la cooperativa, y el formulario a la derecha.
 */
@Component({
  selector: 'pjl-marco-acceso',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="acceso">
      <section class="campo-azul">
        <div class="marca">
          <img src="logo-pjl-512.png" alt="" width="512" height="512" />
          <p class="nombre">Lorente<span>Score</span></p>
          <p class="cooperativa">Cooperativa de Ahorro y Crédito Padre Julián Lorente</p>
        </div>
        <svg viewBox="0 0 600 160" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M0 160V70Q50 52 100 70V88Q150 72 200 88V100Q250 86 300 100V112Q350 100 400 112V124Q450 114 500 124V134Q550 126 600 134V160Z"
            fill="#f5b500"
          />
          <path
            d="M0 160V118Q50 106 100 118V128Q150 118 200 128V136Q250 128 300 136V142Q350 136 400 142V148Q450 142 500 148V152Q550 148 600 152V160Z"
            fill="#e0a100"
          />
        </svg>
      </section>
      <main class="contenido">
        <div class="caja"><ng-content /></div>
      </main>
    </div>
  `,
  styles: `
    .acceso {
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
      min-height: 100dvh;
      background: var(--superficie);
    }
    /* El logo es el protagonista: centrado sobre las terrazas, tan grande como lo permita la pantalla. */
    .campo-azul {
      position: sticky;
      top: 0;
      align-self: start;
      height: 100dvh;
      overflow: hidden;
      background: linear-gradient(180deg, var(--azul-700), var(--azul-900));
      color: #fff;
      padding: 48px 40px 24dvh;
      display: grid;
      place-items: center;
    }
    .marca {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .marca img {
      width: clamp(180px, min(30vw, 42dvh), 420px);
      height: auto;
      aspect-ratio: 1;
      border-radius: 50%;
      box-shadow: 0 30px 70px -28px rgba(5, 22, 38, 0.7);
    }
    .nombre {
      margin-top: clamp(20px, 3dvh, 36px);
      font-size: clamp(2.5rem, 3.6vw + 0.5rem, 4.75rem);
      font-weight: 800;
      letter-spacing: -0.04em;
      line-height: 1;
    }
    .nombre span {
      color: var(--ambar-500);
    }
    .cooperativa {
      margin-top: 14px;
      max-width: 30ch;
      font-size: clamp(1rem, 0.5vw + 0.85rem, 1.25rem);
      font-weight: 700;
      line-height: 1.3;
      color: var(--azul-100);
      text-wrap: balance;
    }
    .campo-azul svg {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      height: 24%;
    }
    .contenido {
      display: grid;
      place-items: center;
      padding: 40px 20px;
    }
    .caja {
      width: min(420px, 100%);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    @media (max-width: 900px) {
      .acceso {
        grid-template-columns: minmax(0, 1fr);
        align-content: start;
      }
      .campo-azul {
        position: relative;
        height: auto;
        padding: 24px 20px 60px;
        place-items: start;
      }
      .marca {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        column-gap: 16px;
        align-items: center;
        text-align: left;
      }
      .marca img {
        grid-row: span 2;
        width: 76px;
      }
      .nombre {
        margin-top: 0;
        font-size: var(--t-30);
        align-self: end;
      }
      .cooperativa {
        margin-top: 4px;
        max-width: none;
        font-size: var(--t-13);
        align-self: start;
      }
      .campo-azul svg {
        height: 40px;
      }
      .contenido {
        place-items: start center;
        padding-top: 28px;
      }
    }
  `,
})
export class MarcoAcceso {}
