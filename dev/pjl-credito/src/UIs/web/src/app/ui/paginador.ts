import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Icono } from './icono';

/**
 * Paginador de las listas (Bandeja, Cartera): «1–6 de 34», Anterior, números y Siguiente.
 * En el teléfono queda ← rango → con flechas de 44 px. No se muestra si todo cabe en una página.
 */
@Component({
  selector: 'pjl-paginador',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icono],
  template: `
    @if (paginas() > 1) {
      <nav class="paginador" [attr.aria-label]="etiqueta()">
        <span class="rango">{{ desde() }}–{{ hasta() }} de {{ total() }}</span>
        <div class="botones">
          <button type="button" class="btn btn-chico" (click)="cambiar.emit(actual() - 1)" [disabled]="actual() === 1" aria-label="Página anterior">
            <pjl-icono nombre="arrow-left" [tam]="15" /><span class="texto-paso">Anterior</span>
          </button>
          @for (p of numeros(); track $index) {
            @if (p === null) { <span class="puntos" aria-hidden="true">…</span> }
            @else {
              <button type="button" class="chip num" [attr.aria-current]="p === actual() ? 'page' : null" [attr.aria-label]="'Página ' + p" (click)="cambiar.emit(p)">{{ p }}</button>
            }
          }
          <button type="button" class="btn btn-chico" (click)="cambiar.emit(actual() + 1)" [disabled]="actual() === paginas()" aria-label="Página siguiente">
            <span class="texto-paso">Siguiente</span><pjl-icono nombre="chevron-right" [tam]="15" />
          </button>
        </div>
      </nav>
    }
  `,
  styles: `
    :host { display: block; }
    .paginador { display: flex; align-items: center; justify-content: space-between; gap: 10px 16px; flex-wrap: wrap; padding: 12px var(--relleno-panel); border-top: 1px solid var(--linea); }
    .rango { font-size: var(--t-13); font-weight: 600; color: var(--tinta-600); font-variant-numeric: tabular-nums; }
    .botones { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .chip { min-width: 36px; justify-content: center; padding: 0 10px; }
    .chip[aria-current='page'] { background: var(--azul-900); border-color: var(--azul-900); color: #fff; }
    .puntos { color: var(--tinta-500); padding: 0 2px; }
    @media (max-width: 760px) {
      .paginador { flex-wrap: nowrap; }
      .botones { display: contents; }
      .chip, .puntos { display: none; }
      .btn-chico:first-child { order: 1; }
      .rango { order: 2; }
      .btn-chico:last-child { order: 3; }
      .texto-paso { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
      .btn-chico { width: 44px; min-height: 44px; padding: 0; border-radius: var(--r-10); }
    }
  `,
})
export class Paginador {
  readonly total = input.required<number>();
  readonly pagina = input.required<number>();
  readonly porPagina = input(6);
  readonly etiqueta = input('Páginas');
  readonly cambiar = output<number>();

  protected readonly paginas = computed(() => Math.max(1, Math.ceil(this.total() / this.porPagina())));
  protected readonly actual = computed(() => Math.min(Math.max(this.pagina(), 1), this.paginas()));
  protected readonly desde = computed(() => (this.actual() - 1) * this.porPagina() + 1);
  protected readonly hasta = computed(() => Math.min(this.actual() * this.porPagina(), this.total()));
  /** Todos los números si son pocos; si no, primera, última y las vecinas de la actual. */
  protected readonly numeros = computed<(number | null)[]>(() => {
    const n = this.paginas(), p = this.actual();
    if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1);
    const vecinas = [1, p - 1, p, p + 1, n].filter((x, i, a) => x >= 1 && x <= n && a.indexOf(x) === i).sort((a, c) => a - c);
    const salida: (number | null)[] = [];
    vecinas.forEach((x, i) => { if (i > 0 && x - vecinas[i - 1] > 1) salida.push(null); salida.push(x); });
    return salida;
  });
}

/** Página actual (desde ?pagina=) acotada al total, y las filas que le tocan. */
export function paginar<T>(filas: T[] | null, pagina: string | undefined, porPagina = 6): { actual: number; visibles: T[] } {
  const total = filas?.length ?? 0;
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const actual = Math.min(Math.max(Number(pagina) || 1, 1), paginas);
  return { actual, visibles: (filas ?? []).slice((actual - 1) * porPagina, actual * porPagina) };
}

/** Lleva la lista desplazable al principio al cambiar de página. */
export function subirLista(id: string): void {
  const lista = document.getElementById(id);
  lista?.scrollTo({ top: 0 });
  if (lista && lista.getBoundingClientRect().top < 0) lista.scrollIntoView({ block: 'start' });
}
