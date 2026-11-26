import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, ETAPAS, Sesion, mensajeError } from '../nucleo/api';
import { Avisos, FORMATOS } from '../nucleo/formato';
import { Riesgo } from '../ui/etapas';
import { Icono } from '../ui/icono';
import { OpcionVista, Vistas } from '../ui/vistas';
import { ESTADOS } from '../ui/tabla-solicitudes';

type Exp = Record<string, any>;
type Pestana = 'evaluacion' | 'solicitud' | 'datos' | 'documentos' | 'linea';

const DOCS = [
  { tipo: 'CEDULA', texto: 'Cédula de identidad' },
  { tipo: 'PLANILLA_SERVICIO', texto: 'Planilla de servicio básico' },
  { tipo: 'ROL_PAGOS', texto: 'Rol de pagos' },
  { tipo: 'RUC_RISE', texto: 'RUC o RISE' },
  { tipo: 'DECLARACION_SRI', texto: 'Declaración de impuestos' },
  { tipo: 'RESPALDO_GARANTIA', texto: 'Respaldo de garantía' },
  { tipo: 'OTRO', texto: 'Otro documento' },
];
const FILTROS = [
  {
    clave: 'filtroEdad',
    texto: 'Edad y plazo dentro de la política (18 a 75 años al vencimiento)',
  },
  { clave: 'filtroCapacidadMinima', texto: 'Flujo disponible positivo después de la cuota' },
  { clave: 'filtroMoraVigente', texto: 'Sin deuda vencida en el sistema financiero' },
  { clave: 'filtroSobreendeudamiento', texto: 'Cuota/ingreso total hasta 50 %' },
  { clave: 'filtroListas', texto: 'Listas UAFE, OFAC y ONU satisfactorias' },
];
const CORTES = [
  { cat: 'E', desde: 0, hasta: 500 },
  { cat: 'D', desde: 500, hasta: 580 },
  { cat: 'C', desde: 580, hasta: 650 },
  { cat: 'B', desde: 650, hasta: 720 },
  { cat: 'A', desde: 720, hasta: 1000 },
];

@Component({
  selector: 'pjl-expediente',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Riesgo, Icono, Vistas, ...FORMATOS],
  templateUrl: './expediente.html',
  styleUrl: './expediente.css',
})
export class Expediente {
  private readonly api = inject(Api);
  private readonly avisos = inject(Avisos);
  protected readonly sesion = inject(Sesion);
  readonly id = input.required<string>();

  protected readonly exp = signal<Exp | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly trabajando = signal<string | null>(null);
  protected readonly descargando = signal<number | null>(null);
  protected readonly errorAccion = signal<string | null>(null);
  protected readonly pestana = signal<Pestana>('evaluacion');
  /** Pantallas pequeñas: se ve «Siguiente paso» (ruta y acción) o el contenido de una pestaña. */
  protected readonly enPaso = signal(true);
  protected readonly vistaChica = computed(() => (this.enPaso() ? 'paso' : this.pestana()));
  protected readonly vistasChicas = computed<OpcionVista[]>(() => [
    { id: 'paso', texto: 'Siguiente paso' },
    { id: 'evaluacion', texto: 'Evaluación' },
    { id: 'solicitud', texto: 'Solicitud' },
    { id: 'datos', texto: 'Datos y buró' },
    { id: 'documentos', texto: 'Documentos', cuenta: this.exp()?.['documentos']?.length },
    { id: 'linea', texto: 'Línea de tiempo' },
  ]);
  protected readonly etapas = ETAPAS;
  protected readonly docs = DOCS;
  protected readonly filtros = FILTROS;
  protected readonly cortes = CORTES;
  protected readonly ajustando = signal(false);

  // Formularios
  protected comite = {
    dictamen: 'APROBADO',
    motivo: '',
    acta: '',
    votosFavor: 3,
    votosContra: 0,
    montoAprobado: null as number | null,
    plazoMeses: null as number | null,
  };
  protected ajuste = { montoAprobado: 0, plazoMeses: 0, tipoGarantia: '', detalleGarantia: '' };
  protected formal = { contratoFirmado: false, pagareFirmado: false, garantiasConstituidas: false };
  protected tipoDoc = 'CEDULA';
  protected archivo: File | null = null;

  protected readonly estado = computed(
    () => ESTADOS[this.exp()?.['estado']] ?? { texto: '', clase: 'neutro' },
  );
  protected readonly sub = computed(() => String(this.exp()?.['idSubetapa'] ?? '1.1'));
  protected readonly docsCargados = computed<string[]>(() =>
    (this.exp()?.['documentos'] ?? []).map((d: Exp) => d['tipo']),
  );
  protected readonly docsCompletos = computed(() => {
    const t = this.docsCargados();
    return (
      t.includes('CEDULA') &&
      t.includes('PLANILLA_SERVICIO') &&
      ['ROL_PAGOS', 'RUC_RISE', 'DECLARACION_SRI'].some((x) => t.includes(x))
    );
  });
  protected readonly factores = computed(() => {
    const f: Exp[] = this.exp()?.['factores'] ?? [];
    const max = Math.max(...f.map((x) => Math.abs(x['aporte'])), 0.01);
    return f.map((x): Exp => ({ ...x, ancho: Math.round((Math.abs(x['aporte']) / max) * 100) }));
  });
  protected readonly marcador = computed(() =>
    Math.min(100, Math.max(0, (Number(this.exp()?.['score'] ?? 0) / 1000) * 100)),
  );
  protected readonly lineaPorEtapa = computed(() => {
    const eventos: Exp[] = this.exp()?.['lineaTiempo'] ?? [];
    return ETAPAS.map((e) => ({
      ...e,
      eventos: eventos.filter((x) => x['idEtapa'] === e.id),
    })).filter((g) => g.eventos.length);
  });
  protected readonly ultimaDecision = computed(() => {
    const d: Exp[] = this.exp()?.['decisiones'] ?? [];
    return d.length ? d[d.length - 1] : null;
  });
  protected readonly formalizado = computed(() => {
    const e = this.exp();
    return !!e && e['contratoFirmado'] && e['pagareFirmado'] && e['garantiasConstituidas'];
  });

  constructor() {
    effect(() => {
      this.cargar(this.id());
    });
  }

  protected async cargar(id = this.id()): Promise<void> {
    try {
      const e = await this.api.get<Exp>(`/solicitudes/${id}`);
      this.exp.set(e);
      this.error.set(null);
      this.formal = {
        contratoFirmado: !!e['contratoFirmado'],
        pagareFirmado: !!e['pagareFirmado'],
        garantiasConstituidas: !!e['garantiasConstituidas'],
      };
      this.ajuste = {
        montoAprobado: e['montoAprobado'] ?? e['montoSolicitado'],
        plazoMeses: e['plazoAprobado'] ?? e['plazoMeses'],
        tipoGarantia: e['tipoGarantia'] ?? '',
        detalleGarantia: e['detalleGarantia'] ?? '',
      };
      if (!e['score'] && this.pestana() === 'evaluacion') this.pestana.set('solicitud');
    } catch (err) {
      this.error.set(mensajeError(err));
    }
  }

  private async accion(nombre: string, fn: () => Promise<unknown>, exito: string): Promise<void> {
    this.trabajando.set(nombre);
    this.errorAccion.set(null);
    try {
      const r = await fn();
      await this.cargar();
      this.avisos.mostrar(typeof exito === 'function' ? (exito as any)(r) : exito);
    } catch (err) {
      this.errorAccion.set(mensajeError(err));
    } finally {
      this.trabajando.set(null);
    }
  }

  protected validarIdentidad() {
    return this.accion(
      'kyc',
      () => this.api.post(`/solicitudes/${this.id()}/identidad`),
      'Identidad validada en Registro Civil, biometría y listas restrictivas.',
    );
  }

  protected async procesar() {
    this.trabajando.set('motor');
    this.errorAccion.set(null);
    try {
      const r = await this.api.post<{ resultado: Exp }>(`/solicitudes/${this.id()}/procesamiento`);
      await this.cargar();
      this.verVista('evaluacion');
      const d = r.resultado['dictamen'];
      this.avisos.mostrar(
        d === 'APROBADO'
          ? `Aprobada automáticamente · score ${r.resultado['score']}`
          : d === 'RECHAZADO'
            ? 'La matriz rechazó la solicitud. Revisa los factores.'
            : 'Derivada a comité por la matriz de decisión.',
        d === 'RECHAZADO' ? 'info' : 'ok',
      );
    } catch (err) {
      this.errorAccion.set(mensajeError(err));
    } finally {
      this.trabajando.set(null);
    }
  }

  protected resolverComite() {
    if (this.comite.motivo.trim().length < 10) {
      this.errorAccion.set('Escribe el motivo de la resolución (mínimo 10 caracteres).');
      return;
    }
    const c = {
      ...this.comite,
      montoAprobado: this.comite.montoAprobado || null,
      plazoMeses: this.comite.plazoMeses || null,
    };
    return this.accion(
      'comite',
      () => this.api.post(`/solicitudes/${this.id()}/resolucion-comite`, c),
      this.comite.dictamen === 'APROBADO'
        ? 'Resolución registrada: aprobado. La oferta se envió al socio.'
        : 'Resolución registrada: rechazado.',
    );
  }

  protected guardarAjuste() {
    return this.accion(
      'ajuste',
      async () => {
        await this.api.put(`/solicitudes/${this.id()}/condiciones`, this.ajuste);
        this.ajustando.set(false);
      },
      'Condiciones actualizadas y enviadas al socio.',
    );
  }

  protected formalizar() {
    return this.accion(
      'formal',
      () => this.api.post(`/solicitudes/${this.id()}/formalizacion`, this.formal),
      'Formalización guardada.',
    );
  }

  protected desembolsar() {
    return this.accion(
      'desembolso',
      () => this.api.post(`/solicitudes/${this.id()}/desembolso`),
      'Desembolso acreditado en la cuenta del socio.',
    );
  }

  protected elegirArchivo(ev: Event) {
    this.archivo = (ev.target as HTMLInputElement).files?.[0] ?? null;
  }

  protected subir(form: HTMLFormElement) {
    if (!this.archivo) {
      this.errorAccion.set('Elige un archivo PDF o una imagen.');
      return;
    }
    const datos = new FormData();
    datos.append('tipo', this.tipoDoc);
    datos.append('archivo', this.archivo);
    return this.accion(
      'subir',
      async () => {
        await this.api.subir(`/solicitudes/${this.id()}/documentos`, datos);
        this.archivo = null;
        form.reset();
      },
      'Documento guardado en el expediente digital.',
    );
  }

  protected async descargar(d: Exp): Promise<void> {
    this.descargando.set(d['idDocumento']);
    try {
      await this.api.descargar(
        `/solicitudes/${this.id()}/documentos/${d['idDocumento']}/archivo`,
        d['nombreArchivo'],
      );
    } catch (e) {
      this.avisos.mostrar(
        `No se pudo descargar ${d['nombreArchivo']}: ${mensajeError(e)}`,
        'error',
      );
    } finally {
      this.descargando.set(null);
    }
  }

  /** Abre una pestaña (o «Siguiente paso»); en pantallas pequeñas también cambia la sección visible. */
  protected verVista(v: string): void {
    if (v === 'paso') {
      this.enPaso.set(true);
      return;
    }
    this.pestana.set(v as Pestana);
    this.enPaso.set(false);
  }

  protected tieneDoc(tipo: string) {
    return this.docsCargados().includes(tipo);
  }
  protected nombreDoc(tipo: string) {
    return DOCS.find((d) => d.tipo === tipo)?.texto ?? tipo;
  }
  protected kb(b: number) {
    return b > 1048576
      ? `${(b / 1048576).toFixed(1)} MB`
      : `${Math.max(1, Math.round(b / 1024))} KB`;
  }
  protected marca(idEtapa: number): string {
    const e = this.exp();
    if (!e) return 'pendiente';
    if (e['estado'] === 'DESEMBOLSADA') return idEtapa < 6 ? 'hecha' : 'actual';
    if (idEtapa < e['idEtapa']) return 'hecha';
    if (idEtapa === e['idEtapa']) return e['estado'] === 'RECHAZADA' ? 'rechazada' : 'actual';
    return 'pendiente';
  }
  protected suma(obj: Exp | null, claves: string[]): number {
    return claves.reduce((t, k) => t + Number(obj?.[k] ?? 0), 0);
  }
}
