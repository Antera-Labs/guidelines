import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Eye, EyeOff, Calculator } from 'lucide-react';
import { api, guardarSesion, mensaje, type Usuario } from '../api';

export function Ingreso() {
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const [cedula, setCedula] = useState('');
  const [clave, setClave] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [demo, setDemo] = useState<{ clave: string; socio: { usuario: string; nombre: string } } | null>(null);
  // Cuenta de demostración: solo existe cuando el backend corre con el perfil "simulador"
  useEffect(() => { api<{ clave: string; socio: { usuario: string; nombre: string } }>('/auth/demo').then(setDemo).catch(() => setDemo(null)); }, []);

  async function ingresar(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{10}$/.test(cedula)) { setError('Tu usuario es tu cédula de 10 dígitos.'); return; }
    if (!clave) { setError('Escribe tu clave.'); return; }
    setCargando(true); setError(null);
    try {
      const r = await api<{ token: string; expiraEn: number; usuario: Usuario }>('/auth/login', { cuerpo: { usuario: cedula, clave, app: 'movil' } });
      guardarSesion(r.token, r.usuario, r.expiraEn);
      navegar('/', { replace: true });
    } catch (err) {
      setError(mensaje(err));
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="ingreso">
      <section className="ingreso-campo" aria-hidden>
        <img src="/logo-pjl-192.png" alt="" width={64} height={64} />
        <p className="ingreso-marca">Cooperativa de Ahorro y Crédito<br /><strong>Padre Julián Lorente</strong></p>
        <svg viewBox="0 0 400 90" preserveAspectRatio="none">
          <path d="M0 90V40Q33 28 66 40V52Q100 42 133 52V60Q166 52 200 60V68Q233 62 266 68V74Q300 68 333 74V78Q366 74 400 78V90Z" fill="#f5b500" />
          <path d="M0 90V66Q33 58 66 66V72Q100 66 133 72V76Q166 72 200 76V80Q233 76 266 80V83Q300 80 333 83V85Q366 83 400 85V90Z" fill="#e0a100" />
        </svg>
      </section>
      <main className="ingreso-forma">
        <h1>Tu crédito, en tu teléfono</h1>
        <p className="suave">Solicita, sigue cada etapa y paga tus cuotas.</p>
        {params.get('vencida') && <p className="nota-aviso" role="status">Tu sesión terminó. Ingresa de nuevo.</p>}
        <form onSubmit={ingresar} noValidate className="pila">
          <label className="campo">
            <span>Cédula</span>
            <input className="entrada" inputMode="numeric" autoComplete="username" maxLength={10} value={cedula}
              onChange={(e) => setCedula(e.target.value.replace(/\D/g, ''))} aria-invalid={!!error} />
          </label>
          <label className="campo">
            <span>Clave</span>
            <span className="con-icono">
              <input className="entrada" type={ver ? 'text' : 'password'} autoComplete="current-password" value={clave}
                onChange={(e) => setClave(e.target.value)} aria-invalid={!!error} />
              <button type="button" className="icono-btn" onClick={() => setVer(!ver)} aria-label={ver ? 'Ocultar clave' : 'Mostrar clave'}>
                {ver ? <EyeOff size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
              </button>
            </span>
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn btn-primario btn-bloque" type="submit" disabled={cargando}>{cargando ? 'Verificando…' : 'Ingresar'}</button>
        </form>
        <Link to="/simulador" className="btn btn-fantasma btn-bloque"><Calculator size={18} aria-hidden /> Simular un crédito sin ingresar</Link>
        {demo && (
          <button type="button" className="demo" onClick={() => { setCedula(demo.socio.usuario); setClave(demo.clave); }}>
            Datos de prueba: {demo.socio.nombre}, cédula <strong>{demo.socio.usuario}</strong>, clave <strong>{demo.clave}</strong>. Toca para completar.
          </button>
        )}
        <p className="muted pie-seguridad">La cooperativa nunca te pedirá tu clave por teléfono, mensaje ni correo.</p>
      </main>
    </div>
  );
}
