import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, mensajeError } from '../nucleo/api';
import { Borrador, Borradores, haceCuanto, nuevoIdBorrador } from '../nucleo/borradores';
import { Avisos, FORMATOS, dinero, enmascarar } from '../nucleo/formato';
import { Icono } from '../ui/icono';
import { OpcionVista, Vistas } from '../ui/vistas';

type Mapa = Record<string, any>;

const PASOS = [
  { id: 1, titulo: 'Crédito y socio' },
  { id: 2, titulo: 'Información personal' },
  { id: 3, titulo: 'Actividad económica' },
  { id: 4, titulo: 'Cónyuge' },
  { id: 5, titulo: 'Referencias' },
  { id: 6, titulo: 'Bienes' },
  { id: 7, titulo: 'Situación patrimonial' },
  { id: 8, titulo: 'Declaraciones y autorización' },
];

export const GRUPOS_SITUACION = [
  { titulo: 'Activos', total: 'Total activos', campos: [['efectivo', 'Efectivo'], ['bancos', 'Bancos'], ['mobiliario', 'Mobiliario'], ['vehiculos', 'Vehículos'], ['bienesInmuebles', 'Bienes inmuebles'], ['cuentasPorCobrar', 'Cuentas por cobrar'], ['otrosActivos', 'Otros activos']] },
  { titulo: 'Pasivos', total: 'Total pasivos', campos: [['cuentasPorPagar', 'Cuentas por pagar'], ['deudasSfnMicrocredito', 'Deudas SFN microcrédito'], ['deudasSfnConsumo', 'Deudas SFN consumo'], ['deudasSfnComercial', 'Deudas SFN comercial'], ['deudasSfnVivienda', 'Deudas SFN vivienda'], ['deudasSectorComercial', 'Deudas sector comercial'], ['otrosPasivos', 'Otros pasivos']] },
  { titulo: 'Ingresos mensuales', total: 'Total ingresos', campos: [['sueldo', 'Sueldos'], ['sueldoConyuge', 'Sueldo cónyuge'], ['arriendos', 'Arriendos'], ['pensionJubilacion', 'Pensión jubilación'], ['comisiones', 'Comisiones'], ['remesasIntereses', 'Remesas e intereses'], ['ingresoVentas', 'Ingreso por ventas'], ['ingresoVentasConyuge', 'Ventas cónyuge'], ['otrosIngresos', 'Otros ingresos']] },
  { titulo: 'Egresos mensuales', total: 'Total egresos', campos: [['alimentacion', 'Alimentación'], ['arriendo', 'Arriendo o alquiler'], ['serviciosBasicos', 'Servicios básicos'], ['gastosFinancieros', 'Gastos financieros'], ['transporte', 'Transporte'], ['educacion', 'Educación'], ['salud', 'Salud'], ['vestimenta', 'Vestimenta'], ['otrosEgresos', 'Otros egresos']] },
];

function cedulaValida(c: string): boolean {
  if (!/^\d{10}$/.test(c)) return false;
  const prov = +c.slice(0, 2);
  if (!((prov >= 1 && prov <= 24) || prov === 30) || +c[2] > 5) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) { let d = +c[i] * (i % 2 === 0 ? 2 : 1); s += d > 9 ? d - 9 : d; }
  return (10 - (s % 10)) % 10 === +c[9];
}

/** Formulario en blanco: cada solicitud nueva (y cada borrador) parte de aquí. */
function modeloVacio(): Mapa {
  return {
    cedula: '', idProducto: null, monto: null, plazoMeses: null, destino: '', tipoPago: 'FIJO', calidad: 'DEUDOR',
    socio: { fechaNacimiento: '', sexo: '', estadoCivil: '', cargasFamiliares: 0, separacionBienes: false, instruccion: '', profesion: '', tipoVivienda: '',
             tiempoResidenciaMeses: null, callePrincipal: '', calleTransversal: '', numeroCasa: '', referenciaUbicacion: '', provincia: 'Loja', canton: 'Loja',
             parroquia: '', barrio: '', telefono: '', celular: '', correo: '' },
    actividades: [{ condicion: '', empresa: '', actividadEmpresa: '', sector: '', cargo: '', tipoContratacion: '', tipoIngresos: 'VARIABLE', afiliacion: 'NINGUNO',
                    tiempoTrabajoMeses: null, numeroTrabajadores: null, horasTrabajo: 8, tiempoMercadoMeses: null, localPropio: false, productos: '', direccion: '', ventasAnuales: null }],
    conyuge: { cedula: '', apellidos: '', nombres: '', fechaNacimiento: '', instruccion: '', profesion: '', condicionLaboral: '', actividad: '', empresa: '', cargo: '', celular: '', correo: '' },
    referencias: [
      { tipo: 'CUENTA_BANCARIA', nombre: '', tipoCuenta: 'AHORROS', numeroCuenta: '' },
      { tipo: 'COMERCIAL', nombre: '', direccion: '', telefono: '' },
      { tipo: 'PERSONAL', nombre: '', direccion: '', telefono: '', empresaTrabajo: '', parentesco: '' },
      { tipo: 'PERSONAL', nombre: '', direccion: '', telefono: '', empresaTrabajo: '', parentesco: '' },
    ],
    bienes: [] as Mapa[],
    situacion: Object.fromEntries(GRUPOS_SITUACION.flatMap((g) => g.campos.map(([k]) => [k, 0]))),
    declaraciones: { declaraLicitud: false, esPep: false },
    autorizacion: { acepta: false, actividadEconomica: '' },
    croquis: { casaLat: null, casaLng: null },
    observaciones: '',
  };
}
const VACIO = JSON.stringify(modeloVacio());

@Component({
  selector: 'pjl-nueva-solicitud',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icono, Vistas, ...FORMATOS],
  templateUrl: './nueva-solicitud.html',
  styleUrl: './nueva-solicitud.css',
  host: { '(window:pagehide)': 'guardarActual()' },
})
export class NuevaSolicitud {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly avisos = inject(Avisos);
  private readonly borradores = inject(Borradores);

  /** ?borrador=<id> en la URL: la solicitud a medio llenar que está abierta. */
  readonly borrador = input<string>();
  protected readonly idBorrador = signal<string | null>(null);
  protected readonly guardadoA = signal<number | null>(null);
  protected readonly porDescartar = signal<string | null>(null);
  protected readonly otros = computed(() => this.borradores.lista().filter((b) => b.id !== this.idBorrador()));
  /** Pantallas pequeñas: el formulario o la lista de solicitudes sin terminar. */
  protected readonly vista = signal('formulario');
  protected readonly vistas = computed<OpcionVista[]>(() => [
    { id: 'formulario', texto: 'Formulario' },
    { id: 'borradores', texto: 'Sin terminar', cuenta: this.otros().length },
  ]);
  private sucio = false;
  private registrada = false;
  private temporizador: ReturnType<typeof setTimeout> | undefined;

  protected readonly pasos = PASOS;
  protected readonly grupos = GRUPOS_SITUACION;
  protected readonly paso = signal(1);
  protected readonly visitado = signal(1);
  protected readonly productos = signal<Mapa[]>([]);
  protected readonly socioCore = signal<Mapa | null>(null);
  protected readonly buscando = signal(false);
  protected readonly enviando = signal(false);
  protected readonly errores = signal<Record<string, string>>({});
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly version = signal(0); // fuerza recálculo de totales al editar números

  protected m: Mapa = modeloVacio();

  protected readonly producto = computed(() => { this.version(); return this.productos().find((p) => p['idProducto'] === Number(this.m['idProducto'])) ?? null; });
  protected readonly conConyuge = computed(() => { this.version(); return ['CASADO', 'UNION_LIBRE'].includes(this.m['socio']['estadoCivil']); });
  protected readonly totales = computed(() => {
    this.version();
    const s = this.m['situacion'];
    const t = GRUPOS_SITUACION.map((g) => g.campos.reduce((a, [k]) => a + (Number(s[k]) || 0), 0));
    return { activos: t[0], pasivos: t[1], ingresos: t[2], egresos: t[3], patrimonio: t[0] - t[1], disponible: t[2] - t[3] };
  });
  protected readonly cuotaEstimada = computed(() => {
    this.version();
    const p = this.producto(); const monto = Number(this.m['monto']); const n = Number(this.m['plazoMeses']);
    if (!p || !monto || !n) return null;
    const i = Number(p['tasaReferencial']) / 1200;
    return (monto * i) / (1 - Math.pow(1 + i, -n));
  });
  protected readonly segmentos = computed(() => {
    const grupos = new Map<string, Mapa[]>();
    for (const p of this.productos()) {
      const k = p['segmento'] === 'CONSUMO' ? 'Consumo' : `Microcrédito · ${p['subsegmento']}`;
      grupos.set(k, [...(grupos.get(k) ?? []), p]);
    }
    return [...grupos.entries()];
  });

  constructor() {
    this.api.get<Mapa[]>('/catalogos/productos').then((p) => this.productos.set(p)).catch((e) => this.errorGeneral.set(mensajeError(e)));
    this.borradores.cargar();
    effect(() => {
      const id = this.borrador() ?? null;
      untracked(() => this.abrir(id));
    });
    inject(DestroyRef).onDestroy(() => this.guardarActual());
  }

  protected tocar() { this.version.update((v) => v + 1); this.marcar(); }

  // ================================================================ borradores
  /** Cualquier cambio en el formulario: se guarda solo, poco después de dejar de escribir. */
  protected marcar(): void {
    this.sucio = true;
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.guardarActual(true), 800);
  }

  /** Guarda la solicitud abierta como borrador. Con `sincronizar`, deja su id en la URL para que una recarga la recupere. */
  protected guardarActual(sincronizar = false): void {
    clearTimeout(this.temporizador);
    if (!this.sucio || this.registrada || JSON.stringify(this.m) === VACIO) return;
    let id = this.idBorrador();
    const nuevo = !id;
    if (!id) { id = nuevoIdBorrador(); this.idBorrador.set(id); }
    this.borradores.guardar({ id, actualizado: Date.now(), paso: this.paso(), visitado: this.visitado(), m: structuredClone(this.m), socio: this.socioCore() });
    this.sucio = false;
    this.guardadoA.set(Date.now());
    if (nuevo && sincronizar) this.router.navigate(['/solicitudes/nueva'], { queryParams: { borrador: id }, replaceUrl: true });
  }

  /** Abre un borrador (o un formulario en blanco) guardando antes el que estaba abierto. */
  private abrir(id: string | null): void {
    if (id && id === this.idBorrador()) return;
    this.guardarActual();
    const b = id ? this.borradores.obtener(id) : null;
    this.idBorrador.set(b?.id ?? null);
    this.m = b ? structuredClone(b.m) : modeloVacio();
    this.paso.set(b?.paso ?? 1);
    this.visitado.set(b?.visitado ?? 1);
    this.socioCore.set(b?.socio ?? null);
    this.errores.set({});
    this.errorGeneral.set(null);
    this.porDescartar.set(null);
    this.guardadoA.set(b ? b.actualizado : null);
    this.version.update((v) => v + 1);
    this.sucio = false;
  }

  protected empezarOtra(): void {
    const habia = JSON.stringify(this.m) !== VACIO ? this.nombreDe(this.socioCore(), this.m) : null;
    this.abrir(null);
    if (this.borrador()) this.router.navigate(['/solicitudes/nueva']);
    if (habia) this.avisos.mostrar(`La solicitud de ${habia} quedó guardada en «Solicitudes sin terminar».`);
    queueMicrotask(() => document.getElementById('paso-titulo')?.focus());
  }

  protected async continuar(id: string): Promise<void> {
    this.vista.set('formulario');
    await this.router.navigate(['/solicitudes/nueva'], { queryParams: { borrador: id } });
    queueMicrotask(() => document.getElementById('paso-titulo')?.focus());
  }

  protected descartar(b: Borrador): void {
    this.borradores.quitar(b.id);
    this.porDescartar.set(null);
    this.avisos.mostrar(`Se descartó la solicitud de ${this.nombreDe(b.socio, b.m)}.`, 'info');
  }

  /** Título de la fila: el nombre del socio si ya se buscó en el core. */
  protected nombreSocio(b: Borrador): string {
    const n = this.nombreDe(b.socio, b.m);
    if (n.startsWith('la cédula')) return 'Cédula' + n.slice('la cédula'.length);
    if (n === 'un socio sin buscar') return 'Socio sin buscar';
    return n;
  }

  protected resumen(b: Borrador): string {
    const p = this.productos().find((x) => x['idProducto'] === Number(b.m['idProducto']));
    const partes = [p ? p['nombre'] : 'Sin producto todavía'];
    if (Number(b.m['monto'])) partes.push(dinero(b.m['monto']));
    if (Number(b.m['plazoMeses'])) partes.push(`${b.m['plazoMeses']} meses`);
    return partes.join(' · ');
  }

  protected hace(ts: number): string { return haceCuanto(ts); }

  private nombreDe(s: Mapa | null, m: Mapa): string {
    const n = s?.['core']?.['nombres'] ?? s?.['ficha']?.['nombres'];
    const a = s?.['core']?.['apellidos'] ?? s?.['ficha']?.['apellidoPaterno'] ?? '';
    if (n) return `${n} ${a}`.trim();
    const c = String(m['cedula'] ?? '').trim();
    return c ? `la cédula ${enmascarar(c)}` : 'un socio sin buscar';
  }

  protected async buscarSocio(): Promise<void> {
    const c = String(this.m['cedula'] ?? '').trim();
    if (!cedulaValida(c)) { this.errores.set({ cedula: 'La cédula no es válida (10 dígitos, verificador módulo 10).' }); return; }
    this.buscando.set(true);
    this.errores.set({});
    try {
      const r = await this.api.get<Mapa>(`/core/socios/${c}`);
      this.socioCore.set(r);
      const f = r['ficha'];
      if (f) {
        for (const k of Object.keys(this.m['socio'])) if (f[k] !== undefined && f[k] !== null) this.m['socio'][k] = k === 'fechaNacimiento' ? String(f[k]).slice(0, 10) : f[k];
      }
      this.m['autorizacion']['actividadEconomica'] = this.m['autorizacion']['actividadEconomica'] || '';
      this.tocar();
    } catch (e) {
      this.socioCore.set(null);
      this.errores.set({ cedula: mensajeError(e) });
    } finally {
      this.buscando.set(false);
    }
  }

  private validar(paso: number): Record<string, string> {
    const e: Record<string, string> = {};
    const m = this.m;
    if (paso === 1) {
      if (!cedulaValida(String(m['cedula']))) e['cedula'] = 'Ingresa una cédula válida.';
      else if (!this.socioCore()) e['cedula'] = 'Busca al socio en el core antes de continuar.';
      const p = this.producto();
      if (!p) e['idProducto'] = 'Elige un producto del tarifario.';
      const monto = Number(m['monto']);
      if (!monto) e['monto'] = 'Ingresa el monto.';
      else if (p && (monto < p['montoMinimo'] || monto > p['montoMaximo'])) e['monto'] = `Entre $${p['montoMinimo']} y $${Number(p['montoMaximo']).toLocaleString('en-US')}.`;
      const plazo = Number(m['plazoMeses']);
      if (!plazo) e['plazoMeses'] = 'Ingresa el plazo.';
      else if (p && plazo > p['plazoMaximoMeses']) e['plazoMeses'] = `Máximo ${p['plazoMaximoMeses']} meses.`;
      if (!String(m['destino']).trim()) e['destino'] = 'Describe el destino del crédito.';
    }
    if (paso === 2) {
      if (!m['socio']['fechaNacimiento']) e['fechaNacimiento'] = 'Ingresa la fecha de nacimiento.';
      if (!m['socio']['estadoCivil']) e['estadoCivil'] = 'Elige el estado civil.';
      if (!/^09\d{8}$/.test(String(m['socio']['celular'] ?? ''))) e['celular'] = 'Celular de 10 dígitos que empieza con 09.';
    }
    if (paso === 3) {
      if (!m['actividades'][0]['condicion']) e['condicion'] = 'Elige la condición laboral.';
      if (!m['actividades'][0]['tiempoTrabajoMeses']) e['tiempoTrabajoMeses'] = 'Indica el tiempo de trabajo en meses.';
    }
    if (paso === 4 && this.conConyuge()) {
      if (!String(m['conyuge']['nombres']).trim() || !String(m['conyuge']['apellidos']).trim()) e['conyuge'] = 'Ingresa nombres y apellidos del cónyuge.';
    }
    if (paso === 7) {
      if (this.totales().ingresos <= 0) e['ingresos'] = 'Registra al menos un ingreso mensual.';
    }
    if (paso === 8) {
      if (!m['declaraciones']['declaraLicitud']) e['licitud'] = 'El socio debe declarar el origen lícito de los fondos.';
    }
    return e;
  }

  protected irA(n: number): void {
    if (n > this.paso()) {
      for (let p = this.paso(); p < n; p++) {
        const e = this.validar(p);
        if (Object.keys(e).length) { this.paso.set(p); this.errores.set(e); return; }
      }
    }
    this.errores.set({});
    this.paso.set(n);
    this.visitado.update((v) => Math.max(v, n));
    this.marcar();
    queueMicrotask(() => document.getElementById('paso-titulo')?.focus());
  }

  protected agregarBien() { this.m['bienes'].push({ tipo: 'CASA', descripcion: '', valorComercial: null, hipotecado: false, institucion: '' }); this.tocar(); }
  protected quitarBien(i: number) { this.m['bienes'].splice(i, 1); this.tocar(); }

  protected ubicar(): void {
    navigator.geolocation?.getCurrentPosition(
      (p) => { this.m['croquis'] = { casaLat: +p.coords.latitude.toFixed(6), casaLng: +p.coords.longitude.toFixed(6) }; this.tocar(); },
      () => this.avisos.mostrar('No se pudo obtener la ubicación. Escríbela a mano.', 'info'),
    );
  }

  protected async registrar(): Promise<void> {
    const e = this.validar(8);
    if (Object.keys(e).length) { this.errores.set(e); return; }
    this.enviando.set(true);
    this.errorGeneral.set(null);
    const m = structuredClone(this.m);
    if (!this.conConyuge()) m['conyuge'] = null;
    m['actividades'] = m['actividades'].filter((a: Mapa) => a['condicion']);
    try {
      const r = await this.api.post<Mapa>('/solicitudes', m);
      this.registrada = true;
      clearTimeout(this.temporizador);
      const id = this.idBorrador();
      if (id) this.borradores.quitar(id);
      this.avisos.mostrar(`Solicitud ${r['numero']} registrada. Sigue la validación de identidad.`);
      this.router.navigate(['/solicitudes', r['idSolicitud']]);
    } catch (err) {
      this.errorGeneral.set(mensajeError(err));
    } finally {
      this.enviando.set(false);
    }
  }
}
