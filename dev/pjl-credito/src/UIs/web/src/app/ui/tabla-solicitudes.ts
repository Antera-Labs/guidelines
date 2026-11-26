import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { DineroPipe } from '../nucleo/formato';

export interface FilaSolicitud {
  idSolicitud: number;
  numero: string;
  socio: string;
  cedula: string;
  producto: string;
  montoSolicitado: number;
  plazoMeses: number;
  idEtapa: number;
  etapa: string;
  idSubetapa: string;
  subetapa: string;
  estado: string;
  dictamen: string | null;
  score: number | null;
  categoriaRiesgo: string | null;
  horasEnEtapa: number;
  fechaSolicitud: string;
  canal: string;
  destino: string;
  asesor: string | null;
  montoAprobado: number | null;
  cuotaMensual: number | null;
  agencia: string;
}

export const ESTADOS: Record<string, { texto: string; clase: string }> = {
  EN_PROCESO: { texto: 'En proceso', clase: 'info' },
  EN_COMITE: { texto: 'En comité', clase: 'aviso' },
  APROBADA: { texto: 'Aprobada', clase: 'ok' },
  RECHAZADA: { texto: 'Rechazada', clase: 'peligro' },
  DESEMBOLSADA: { texto: 'Desembolsada', clase: 'neutro' },
  ANULADA: { texto: 'Anulada', clase: 'neutro' },
};

/**
 * Tabla de solicitudes del Panel y la Bandeja: Solicitud · Socio (cédula) · Monto · Estado · Tipo de crédito.
 * Sencilla a propósito: el detalle (etapa, riesgo, tiempos) está en el expediente, a un clic.
 */
@Component({
  selector: 'pjl-tabla-solicitudes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DineroPipe],
  template: `
    <div class="tabla-marco">
      <table class="tabla solicitudes">
        <caption class="sr-only">
          {{
            titulo()
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">Solicitud</th>
            <th scope="col">Socio (cédula)</th>
            <th scope="col" class="num">Monto</th>
            <th scope="col">Estado</th>
            <th scope="col">Tipo de crédito</th>
          </tr>
        </thead>
        <tbody>
          @for (f of filas(); track f.idSolicitud) {
            <tr
              class="fila-link"
              tabindex="0"
              (click)="abrir(f)"
              (keydown.enter)="abrir(f)"
              [attr.aria-label]="'Abrir ' + f.numero + ' de ' + f.socio"
            >
              <td class="c-num">
                <span class="principal num">{{ f.numero }}</span>
              </td>
              <td class="c-socio">
                <span class="principal">{{ f.socio }}</span><span class="secundario num">{{
                  f.cedula
                }}</span>
              </td>
              <td class="c-monto num">
                <span class="principal">{{ f.montoSolicitado | dinero }}</span>
              </td>
              <td class="c-estado">
                <span class="insignia" [class]="'insignia ' + estado(f.estado).clase">{{
                  estado(f.estado).texto
                }}</span><span class="secundario">{{ f.subetapa }}</span>
              </td>
              <td class="c-tipo">
                <span class="tipo">{{ f.producto }}</span><span class="secundario"
                  >{{ f.plazoMeses }} meses</span
                >
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="5">
                <div class="vacio">
                  <strong>{{ vacio() }}</strong><span>{{ pista() }}</span>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .tipo {
      font-weight: 600;
      color: var(--tinta-900);
    }
    .c-estado .secundario {
      margin-top: 6px;
      white-space: nowrap;
      max-width: 240px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .c-num .principal,
    .c-monto .principal {
      white-space: nowrap;
    }
    @media (max-width: 760px) {
      thead {
        display: none;
      }
      .tabla,
      tbody,
      tr,
      td {
        display: block;
      }
      tr.fila-link {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        grid-template-areas: 'socio monto' 'num estado' 'tipo tipo';
        gap: 6px 12px;
        padding: 14px var(--relleno-panel);
        border-bottom: 1px solid var(--tinta-100);
      }
      tr.fila-link > td {
        padding: 0;
        border: 0;
      }
      .c-socio {
        grid-area: socio;
      }
      .c-monto {
        grid-area: monto;
        text-align: right;
      }
      .c-num {
        grid-area: num;
      }
      .c-estado {
        grid-area: estado;
        text-align: right;
      }
      .c-estado .secundario {
        display: none;
      }
      .c-tipo {
        grid-area: tipo;
        color: var(--tinta-600);
        font-size: var(--t-13);
      }
      .c-tipo .secundario {
        display: inline;
        margin-left: 6px;
      }
    }
  `,
})
export class TablaSolicitudes {
  private readonly router = inject(Router);
  readonly filas = input.required<FilaSolicitud[]>();
  readonly titulo = input('Solicitudes de crédito');
  readonly vacio = input('No hay solicitudes con estos filtros.');
  readonly pista = input('Prueba con otra etapa o quita la búsqueda.');

  protected estado(e: string) {
    return ESTADOS[e] ?? { texto: e, clase: 'neutro' };
  }
  protected abrir(f: FilaSolicitud) {
    this.router.navigate(['/solicitudes', f.idSolicitud]);
  }
}
