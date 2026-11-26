import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
  model,
} from '@angular/core';

export interface OpcionVista {
  id: string;
  texto: string;
  cuenta?: number | null;
}

/**
 * Botones de sección para pantallas pequeñas (tablet y teléfono, menos de 1100 px).
 * Quedan fijos bajo la barra superior y la página muestra una sección a la vez: cada sección
 * lleva `[class.fuera-de-vista]="vista() !== 'su-id'"` (styles.css). En PC no aparecen y todo queda a la vista.
 */
@Component({
  selector: 'pjl-vistas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="barra" role="group" [attr.aria-label]="etiqueta()">
      @for (o of opciones(); track o.id) {
        <button
          type="button"
          class="chip"
          [attr.aria-pressed]="vista() === o.id"
          (click)="vista.set(o.id)"
        >
          {{ o.texto }}
          @if (o.cuenta) {
            <span class="cuenta">{{ o.cuenta }}</span>
          }
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: none;
    }
    @media (max-width: 1099px) {
      :host {
        display: block;
        position: sticky;
        top: 60px;
        z-index: 5;
        margin: -8px calc(-1 * var(--margen-x));
        padding: 8px var(--margen-x);
        background: var(--fondo);
      }
      /* Se reparten el ancho; si no caben, la fila se desliza de lado */
      .barra {
        display: flex;
        gap: 6px;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .barra::-webkit-scrollbar {
        display: none;
      }
      .chip {
        flex: 1 0 auto;
        justify-content: center;
        min-height: 44px;
      }
    }
  `,
})
export class Vistas {
  readonly opciones = input.required<OpcionVista[]>();
  readonly vista = model.required<string>();
  readonly etiqueta = input('Elegir sección');
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // Si la fila se desliza de lado, el botón activo se trae a la vista (sin mover la página).
    afterRenderEffect(() => {
      this.vista();
      this.opciones();
      const barra = this.el.nativeElement.querySelector<HTMLElement>('.barra');
      const activo = barra?.querySelector<HTMLElement>('.chip[aria-pressed="true"]');
      if (!barra || !activo || barra.scrollWidth <= barra.clientWidth) return;
      const desde =
        activo.getBoundingClientRect().left - barra.getBoundingClientRect().left + barra.scrollLeft;
      barra.scrollTo({ left: desde - (barra.clientWidth - activo.offsetWidth) / 2 });
    });
  }
}
