/** Cliente de core-api para la app del socio. La sesión vive solo en esta pestaña (sessionStorage). */
const BASE = '/api/v1';
const CLAVE = 'pjl.movil.sesion';

export interface Usuario { usuario: string; nombre: string; rol: 'SOCIO'; agencia: string; idSocio: number; }
interface Sesion { token: string; usuario: Usuario; expira: number; }

export class ErrorApi extends Error {
  constructor(mensaje: string, readonly estado: number, readonly codigo?: string) { super(mensaje); }
}

export function leerSesion(): Sesion | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(CLAVE) ?? 'null') as Sesion | null;
    return s && s.expira > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export function guardarSesion(token: string, usuario: Usuario, expiraEnSeg: number): void {
  try { sessionStorage.setItem(CLAVE, JSON.stringify({ token, usuario, expira: Date.now() + expiraEnSeg * 1000 })); } catch { /* sin almacenamiento */ }
}

export function cerrarSesion(): void {
  try { sessionStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ }
}

export async function api<T>(ruta: string, opciones: { metodo?: string; cuerpo?: unknown; formulario?: FormData } = {}): Promise<T> {
  const sesion = leerSesion();
  const cabeceras: Record<string, string> = {};
  if (sesion) cabeceras.Authorization = `Bearer ${sesion.token}`;
  if (opciones.cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';
  let r: Response;
  try {
    r = await fetch(BASE + ruta, {
      method: opciones.metodo ?? (opciones.cuerpo !== undefined || opciones.formulario ? 'POST' : 'GET'),
      headers: cabeceras,
      body: opciones.formulario ?? (opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined),
    });
  } catch {
    throw new ErrorApi('Sin conexión. Revisa tu internet e intenta de nuevo.', 0);
  }
  if (r.status === 401 && ruta !== '/auth/login') {
    cerrarSesion();
    window.location.assign('/ingreso?vencida=1');
  }
  if (!r.ok) {
    let detalle: { detail?: string; codigo?: string } | null = null;
    try { detalle = await r.json(); } catch { /* respuesta sin cuerpo */ }
    throw new ErrorApi(detalle?.detail ?? `El servidor respondió ${r.status}.`, r.status, detalle?.codigo);
  }
  return (r.status === 204 ? undefined : await r.json()) as T;
}

export function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : 'Ocurrió un error inesperado.';
}

// ---------------------------------------------------------------- tipos de la API
export interface Cuenta { numero: string; tipo: string; nombre: string; saldo: number; }
export interface Credito {
  idCredito: number; numeroOperacion: string; producto: string; monto: number; plazoMeses: number; tasaNominal: number; cuotaMensual: number;
  saldoCapital: number; diasMora: number; estado: string; cuotasPagadas: number; proximoVencimiento: string | null; proximaCuota: number | null;
  montoVencido: number; fechaDesembolso: string; idSolicitud: number;
}
export interface SolicitudResumen {
  idSolicitud: number; numero: string; producto: string; montoSolicitado: number; plazoMeses: number; idEtapa: number; etapa: string;
  idSubetapa: string; subetapa: string; estado: string; dictamen: string | null; fechaSolicitud: string; montoAprobado: number | null; cuotaMensual: number | null;
}
export interface Aviso { id: string; tipo: string; titulo: string; texto: string; }
export interface Inicio {
  socio: { nombres: string; apellidos: string; numeroSocio: string; agencia: string; celular: string; correo: string };
  cuentas: Cuenta[]; creditos: Credito[]; solicitudes: SolicitudResumen[];
  consentimiento: { idConsentimiento: number; fechaOtorgamiento: string; vigenteHasta: string } | null; avisos: Aviso[];
}
export interface Producto {
  id: number; codigo: string; segmento: string; subsegmento: string; nombre: string; descripcion: string; montoMinimo: number; montoMaximo: number;
  plazoMaximoMeses: number; tasaReferencial: number; tasaConAportacion: number | null; requisitos: string[]; beneficios: string[]; rangoVentas: string | null;
}
export interface Simulacion { producto: string; tasaNominal: number; tasaEfectiva: number; monto: number; plazoMeses: number; cuota: number; totalIntereses: number; totalPagar: number; nota: string; }
