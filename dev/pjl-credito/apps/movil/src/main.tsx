import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider, ScrollRestoration, Outlet } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@fontsource-variable/manrope';
import './estilos/tokens.css';
import './estilos/app.css';
import { Marco, ProveedorAvisos, RequiereSesion } from './componentes/Base';
import { Ingreso } from './paginas/Ingreso';
import { Inicio } from './paginas/Inicio';
import { Solicitar } from './paginas/Solicitar';
import { Solicitud } from './paginas/Solicitud';
import { Credito } from './paginas/Credito';
import { Perfil, Simulador } from './paginas/Otras';

const consultas = new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, retry: 1, refetchOnWindowFocus: true } } });

function Raiz() {
  return (<><ScrollRestoration /><Outlet /></>);
}

const rutas = createBrowserRouter([
  {
    element: <Raiz />,
    children: [
      { path: '/ingreso', element: <Ingreso /> },
      {
        element: <Marco />,
        children: [
          { path: '/', element: <RequiereSesion><Inicio /></RequiereSesion> },
          { path: '/simulador', element: <Simulador /> },
          { path: '/solicitar', element: <RequiereSesion><Solicitar /></RequiereSesion> },
          { path: '/solicitudes/:id', element: <RequiereSesion><Solicitud /></RequiereSesion> },
          { path: '/creditos/:id', element: <RequiereSesion><Credito /></RequiereSesion> },
          { path: '/perfil', element: <RequiereSesion><Perfil /></RequiereSesion> },
        ],
      },
    ],
  },
]);

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <QueryClientProvider client={consultas}>
      <ProveedorAvisos>
        <RouterProvider router={rutas} />
      </ProveedorAvisos>
    </QueryClientProvider>
  </StrictMode>,
);
