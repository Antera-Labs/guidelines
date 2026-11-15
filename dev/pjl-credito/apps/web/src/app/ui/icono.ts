import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  ArrowLeft, Banknote, BadgePercent, Building2, Calculator, Check, ChevronRight, CircleAlert, CircleCheck, CircleX, Clock,
  Cpu, FileText, FilePlus2, Gavel, Inbox, Info, LayoutDashboard, LogOut, Menu, Phone, Plus, RefreshCw, Scale, Search,
  ShieldCheck, TriangleAlert, Upload, UserRound, Wallet, X, Landmark, Send, Lock, PanelLeftClose, PanelLeftOpen, ArrowRight, Download, FilePen, Trash2, MailCheck, KeyRound, Eye, EyeOff,
} from 'lucide';

type Nodo = [string, Record<string, string | number>];

const ICONOS: Record<string, Nodo[]> = {
  'arrow-left': ArrowLeft, banknote: Banknote, porcentaje: BadgePercent, agencia: Building2, calculadora: Calculator,
  check: Check, 'chevron-right': ChevronRight, alerta: CircleAlert, ok: CircleCheck, no: CircleX, reloj: Clock, motor: Cpu,
  documento: FileText, nueva: FilePlus2, comite: Gavel, bandeja: Inbox, info: Info, panel: LayoutDashboard, salir: LogOut,
  menu: Menu, telefono: Phone, mas: Plus, refrescar: RefreshCw, balanza: Scale, buscar: Search, escudo: ShieldCheck,
  peligro: TriangleAlert, subir: Upload, usuario: UserRound, cartera: Wallet, cerrar: X, banco: Landmark, enviar: Send, candado: Lock,
  'riel-cerrar': PanelLeftClose, 'riel-abrir': PanelLeftOpen, 'flecha-derecha': ArrowRight,
  descargar: Download, borrador: FilePen, borrar: Trash2,
  'correo-enviado': MailCheck, llave: KeyRound, ver: Eye, ocultar: EyeOff,
} as unknown as Record<string, Nodo[]>;

/** Iconos Lucide (ISC) dibujados como SVG en línea, trazo uniforme. */
@Component({
  selector: 'pjl-icono',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:inline-flex;flex:none', 'aria-hidden': 'true' },
  template: `
    <svg xmlns="http://www.w3.org/2000/svg" [attr.width]="tam()" [attr.height]="tam()" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" [attr.stroke-width]="trazo()" stroke-linecap="round" stroke-linejoin="round" focusable="false">
      @for (n of nodos(); track $index) {
        @switch (n[0]) {
          @case ('path') { <svg:path [attr.d]="n[1]['d']" /> }
          @case ('circle') { <svg:circle [attr.cx]="n[1]['cx']" [attr.cy]="n[1]['cy']" [attr.r]="n[1]['r']" /> }
          @case ('rect') { <svg:rect [attr.x]="n[1]['x']" [attr.y]="n[1]['y']" [attr.width]="n[1]['width']" [attr.height]="n[1]['height']" [attr.rx]="n[1]['rx']" [attr.ry]="n[1]['ry']" /> }
          @case ('line') { <svg:line [attr.x1]="n[1]['x1']" [attr.y1]="n[1]['y1']" [attr.x2]="n[1]['x2']" [attr.y2]="n[1]['y2']" /> }
          @case ('polyline') { <svg:polyline [attr.points]="n[1]['points']" /> }
          @case ('polygon') { <svg:polygon [attr.points]="n[1]['points']" /> }
          @case ('ellipse') { <svg:ellipse [attr.cx]="n[1]['cx']" [attr.cy]="n[1]['cy']" [attr.rx]="n[1]['rx']" [attr.ry]="n[1]['ry']" /> }
        }
      }
    </svg>
  `,
})
export class Icono {
  readonly nombre = input.required<string>();
  readonly tam = input(18);
  readonly trazo = input(2);
  protected readonly nodos = computed(() => ICONOS[this.nombre()] ?? ICONOS['info']);
}
