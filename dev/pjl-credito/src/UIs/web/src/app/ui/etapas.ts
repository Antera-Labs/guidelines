import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Insignia de categoría de riesgo con la rampa fija A–E. */
@Component({
  selector: 'pjl-riesgo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span
    class="riesgo"
    [class]="'riesgo riesgo-' + (categoria() || 'vacio')"
    [attr.title]="titulo()"
    >{{ categoria() || '—' }}</span
  >`,
})
export class Riesgo {
  readonly categoria = input<string | null | undefined>();
  protected readonly titulo = computed(() =>
    this.categoria() ? `Categoría de riesgo ${this.categoria()}` : 'Sin evaluación',
  );
}

export interface KpiEtapa {
  idEtapa: number;
  nombre: string;
  casoUso: string;
  enCurso: number;
  monto: number;
  atencion: number;
  horasPromedio: number | null;
}
