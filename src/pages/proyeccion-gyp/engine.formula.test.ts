/**
 * C9 · Una fórmula propia SUMA sus piezas; no las encadena.
 *
 * El fold de `evaluarMetodoV2` hace que cada paso opere sobre el resultado del
 * anterior, que es lo correcto para un método de fábrica de varios pasos. Para
 * una fórmula armada por el usuario («sumas o restas piezas») es lo contrario:
 * la segunda pieza tomaba la primera como base y el resultado no se parecía a
 * lo que la persona armó.
 */
import { describe, it, expect } from 'vitest';
import { evaluarMetodoV2 } from './engine';
import type { MetodoV2, CtxPaso, Regla, Parametro } from './engine';

const regla = { empresa: 'Beval', concepto: 'X', valor: null, serie: [], acum: 0 } as unknown as Regla;
const ctx = {
  regla,
  param: { empresa: 'Beval', dias: 26, trans: 7, factor: 1, tasa: null } as Parametro,
  gn: 9,
  escenario: 'PROYECCION',
  venta: { Beval: 1000 },
  agg: {},
  grupo: {},
  refConcepto: () => 0,
  cargoFijoDemas: () => 0,
  serieVenta: () => [],
} as unknown as CtxPaso;

const paso = (valor: number) => ({
  op: 'valor_fijo' as const,
  base: { origen: 'real' as const, ref: 'ninguna' as const },
  valor,
  n: null,
  invertir: false,
});

describe('C9 · modo de combinación de los pasos', () => {
  it('«suma»: 100 + 30 = 130, cada pieza por su cuenta', () => {
    const m: MetodoV2 = {
      id: 'f1', nombre: 'propia', pasos: [paso(100), paso(30)],
      combinar: 'suma', orden: 2, causadoDefault: 'calendario', deFabrica: false,
    };
    expect(evaluarMetodoV2(m, ctx)).toBeCloseTo(130, 2);
  });

  it('una pieza con signo negativo RESTA', () => {
    const m: MetodoV2 = {
      id: 'f2', nombre: 'propia', pasos: [paso(100), { ...paso(30), invertir: true }],
      combinar: 'suma', orden: 2, causadoDefault: 'calendario', deFabrica: false,
    };
    expect(evaluarMetodoV2(m, ctx)).toBeCloseTo(70, 2);
  });

  it('sin `combinar` el comportamiento de siempre NO cambia (los 190 casos)', () => {
    const m: MetodoV2 = {
      id: 'm1', nombre: 'fabrica', pasos: [paso(100), paso(30)],
      orden: 2, causadoDefault: 'igual', deFabrica: true,
    };
    // Encadenado: el segundo paso pisa al primero (valor_fijo ignora `acc`).
    expect(evaluarMetodoV2(m, ctx)).toBeCloseTo(30, 2);
  });

  it('un solo paso se comporta igual en los dos modos', () => {
    const base = { id: 'u', nombre: 'u', pasos: [paso(42)], orden: 2, causadoDefault: 'igual' as const, deFabrica: false };
    expect(evaluarMetodoV2({ ...base }, ctx)).toBeCloseTo(42, 2);
    expect(evaluarMetodoV2({ ...base, combinar: 'suma' }, ctx)).toBeCloseTo(42, 2);
  });
});
