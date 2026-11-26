import { describe, expect, it } from 'vitest';
import { dinero, enmascarar, porcentaje } from './formato';

// Prueba de humo: confirma que el runner (Vitest con @angular/build:unit-test)
// funciona en local y en el CI. Las pruebas de cada pantalla quedan para el equipo.
describe('formato', () => {
  it('muestra montos en dólares y un guion cuando no hay valor', () => {
    expect(dinero(80000)).toBe('$80,000.00');
    expect(dinero(null)).toBe('—');
  });

  it('muestra porcentajes con coma decimal', () => {
    expect(porcentaje(24.09, 2)).toBe('24,09 %');
  });

  it('deja visibles solo los 4 últimos dígitos de la cédula (LOPDP)', () => {
    expect(enmascarar('1104567890')).toBe('•••• 7890');
  });
});
