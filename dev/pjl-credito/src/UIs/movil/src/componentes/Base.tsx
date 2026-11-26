import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { CircleAlert, CircleCheck, House, Calculator, FilePlus2, UserRound, X } from 'lucide-react';
import { cerrarSesion, leerSesion } from '../api';

// ---------------------------------------------------------------- avisos (toasts)
interface Aviso {
  id: number;
  texto: string;
  tipo: 'ok' | 'error';
}
const ContextoAvisos = createContext<(texto: string, tipo?: Aviso['tipo']) => void>(() => {});
export const useAviso = () => useContext(ContextoAvisos);

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<Aviso[]>([]);
  const sec = useRef(0);
  const mostrar = useCallback((texto: string, tipo: Aviso['tipo'] = 'ok') => {
    const id = ++sec.current;
    setLista((l) => [...l.slice(-1), { id, texto, tipo }]);
    setTimeout(() => setLista((l) => l.filter((a) => a.id !== id)), 4500);
  }, []);
  return (
    <ContextoAvisos.Provider value={mostrar}>
      {children}
      <div className="avisos" aria-live="polite">
        {lista.map((a) => (
          <div key={a.id} className={`aviso ${a.tipo}`} role="status">
            {a.tipo === 'ok' ? (
              <CircleCheck size={20} aria-hidden />
            ) : (
              <CircleAlert size={20} aria-hidden />
            )}
            <span>{a.texto}</span>
            <button
              type="button"
              aria-label="Cerrar aviso"
              onClick={() => setLista((l) => l.filter((x) => x.id !== a.id))}
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ContextoAvisos.Provider>
  );
}

// ---------------------------------------------------------------- hoja inferior (bottom sheet)
export function Hoja({
  abierta,
  titulo,
  alCerrar,
  children,
}: {
  abierta: boolean;
  titulo: string;
  alCerrar: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierta) return;
    const previo = document.activeElement as HTMLElement | null;
    const t = setTimeout(
      () => ref.current?.querySelector<HTMLElement>('button, input, [href]')?.focus(),
      60,
    );
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar();
    };
    document.addEventListener('keydown', tecla);
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = '';
      previo?.focus();
    };
  }, [abierta, alCerrar]);
  return (
    <div className={`hoja-capa ${abierta ? 'abierta' : ''}`} aria-hidden={!abierta}>
      <div className="hoja-velo" onClick={alCerrar} />
      <div
        ref={ref}
        className="hoja"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        inert={!abierta}
      >
        <span className="hoja-asa" aria-hidden />
        <div className="hoja-cab">
          <h2>{titulo}</h2>
          <button type="button" className="icono-btn" aria-label="Cerrar" onClick={alCerrar}>
            <X size={22} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- estados de carga y error
export function Esqueleto({ alto = 72, n = 3 }: { alto?: number; n?: number }) {
  return (
    <div className="pila">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="esqueleto" style={{ height: alto }} />
      ))}
    </div>
  );
}

export function ErrorCaja({ texto, reintentar }: { texto: string; reintentar?: () => void }) {
  return (
    <div className="error-caja" role="alert">
      <CircleAlert size={20} aria-hidden />
      <span>{texto}</span>
      {reintentar && (
        <button type="button" className="btn btn-chico" onClick={reintentar}>
          Reintentar
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- marco con navegación
const NAV = [
  { a: '/', texto: 'Inicio', icono: House, fin: true },
  { a: '/simulador', texto: 'Simular', icono: Calculator },
  { a: '/solicitar', texto: 'Solicitar', icono: FilePlus2 },
  { a: '/perfil', texto: 'Perfil', icono: UserRound },
];

export function Marco() {
  return (
    <div className="marco">
      <a className="salto" href="#contenido">
        Saltar al contenido
      </a>
      <header className="barra-sup">
        <img src="/logo-pjl-192.png" alt="" width={36} height={36} />
        <span>PJL Móvil</span>
        <nav aria-label="Principal" className="nav-sup">
          {NAV.map(({ a, texto, icono: I, fin }) => (
            <NavLink key={a} to={a} end={fin}>
              <I size={18} aria-hidden /> {texto}
            </NavLink>
          ))}
        </nav>
      </header>
      <main id="contenido" tabIndex={-1}>
        <Outlet />
      </main>
      <nav aria-label="Principal" className="nav-inf">
        {NAV.map(({ a, texto, icono: I, fin }) => (
          <NavLink key={a} to={a} end={fin}>
            <I size={22} aria-hidden />
            <span>{texto}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function RequiereSesion({ children }: { children: ReactNode }) {
  const navegar = useNavigate();
  const hay = !!leerSesion();
  useEffect(() => {
    if (!hay) navegar('/ingreso', { replace: true });
  }, [hay, navegar]);
  return hay ? <>{children}</> : null;
}

export function salir(navegar: (a: string) => void) {
  cerrarSesion();
  navegar('/ingreso');
}
