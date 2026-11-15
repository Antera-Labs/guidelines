import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { Sesion, requiereSesion } from './nucleo/api';
import { Shell } from './shell';

export const routes: Routes = [
  // Portada pública; con la sesión abierta se va directo al panel.
  { path: '', pathMatch: 'full', title: 'Bienvenidos a LorenteScore', canActivate: [() => inject(Sesion).token() ? inject(Router).createUrlTree(['/panel']) : true],
    loadComponent: () => import('./paginas/bienvenida').then((m) => m.Bienvenida) },
  { path: 'cargando', title: 'Bienvenidos a LorenteScore', canActivate: [requiereSesion], loadComponent: () => import('./paginas/carga').then((m) => m.Carga) },
  { path: 'ingreso', title: 'Ingreso · LorenteScore', loadComponent: () => import('./paginas/ingreso').then((m) => m.Ingreso) },
  { path: 'recuperar', title: 'Recuperar clave · LorenteScore', loadComponent: () => import('./paginas/recuperar').then((m) => m.Recuperar) },
  { path: 'restablecer', title: 'Nueva clave · LorenteScore', loadComponent: () => import('./paginas/restablecer').then((m) => m.Restablecer) },
  {
    path: '', component: Shell, canActivate: [requiereSesion],
    children: [
      { path: 'panel', title: 'Panel · LorenteScore', loadComponent: () => import('./paginas/panel').then((m) => m.Panel) },
      { path: 'solicitudes', title: 'Bandeja · LorenteScore', loadComponent: () => import('./paginas/bandeja').then((m) => m.Bandeja) },
      { path: 'comite', title: 'Comité · LorenteScore', loadComponent: () => import('./paginas/bandeja').then((m) => m.Bandeja), data: { comite: true } },
      { path: 'solicitudes/nueva', title: 'Nueva solicitud · LorenteScore', loadComponent: () => import('./paginas/nueva-solicitud').then((m) => m.NuevaSolicitud) },
      { path: 'solicitudes/:id', title: 'Expediente · LorenteScore', loadComponent: () => import('./paginas/expediente').then((m) => m.Expediente) },
      { path: 'cartera', title: 'Cartera · LorenteScore', loadComponent: () => import('./paginas/cartera').then((m) => m.Cartera) },
      { path: 'cartera/:id', title: 'Crédito · LorenteScore', loadComponent: () => import('./paginas/credito').then((m) => m.Credito) },
      { path: 'provisiones', title: 'Provisiones · LorenteScore', loadComponent: () => import('./paginas/provisiones').then((m) => m.Provisiones) },
      { path: 'tarifario', title: 'Tarifario · LorenteScore', loadComponent: () => import('./paginas/tarifario').then((m) => m.Tarifario) },
    ],
  },
  { path: '**', redirectTo: '' },
];
