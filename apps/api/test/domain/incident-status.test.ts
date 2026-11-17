import { describe, expect, it } from 'vitest';
import {
  assertTransition,
  availableTransitions,
  isReopen,
} from '../../src/domain/incident-status.js';
import { DomainError } from '../../src/domain/errors.js';

const codeOf = (fn: () => unknown) => {
  try {
    fn();
    return null;
  } catch (e) {
    return (e as DomainError).code;
  }
};

describe('Máquina de estados de la incidencia', () => {
  it('permite el flujo normal ABIERTA → EN_CURSO → RESUELTA → CERRADA', () => {
    expect(codeOf(() => assertTransition('ABIERTA', 'EN_CURSO', 'USUARIO', null))).toBeNull();
    expect(codeOf(() => assertTransition('EN_CURSO', 'RESUELTA', 'USUARIO', 'Hecho'))).toBeNull();
    expect(codeOf(() => assertTransition('RESUELTA', 'CERRADA', 'RESPONSABLE', null))).toBeNull();
  });

  it('rechaza transiciones no definidas', () => {
    expect(codeOf(() => assertTransition('ABIERTA', 'CERRADA', 'ADMIN', 'x'))).toBe(
      'INVALID_TRANSITION',
    );
    expect(codeOf(() => assertTransition('CERRADA', 'RESUELTA', 'ADMIN', 'x'))).toBe(
      'INVALID_TRANSITION',
    );
    expect(codeOf(() => assertTransition('ABIERTA', 'ABIERTA', 'ADMIN', 'x'))).toBe(
      'INVALID_TRANSITION',
    );
  });

  it('exige comentario al resolver, rechazar o reabrir', () => {
    expect(codeOf(() => assertTransition('EN_CURSO', 'RESUELTA', 'USUARIO', '  '))).toBe(
      'VALIDATION',
    );
    expect(codeOf(() => assertTransition('ABIERTA', 'RECHAZADA', 'RESPONSABLE', null))).toBe(
      'VALIDATION',
    );
    expect(codeOf(() => assertTransition('CERRADA', 'EN_CURSO', 'RESPONSABLE', undefined))).toBe(
      'VALIDATION',
    );
  });

  it('solo un gestor puede rechazar, cerrar o reabrir', () => {
    expect(codeOf(() => assertTransition('ABIERTA', 'RECHAZADA', 'USUARIO', 'motivo'))).toBe(
      'FORBIDDEN',
    );
    expect(codeOf(() => assertTransition('RESUELTA', 'CERRADA', 'USUARIO', null))).toBe(
      'FORBIDDEN',
    );
    expect(codeOf(() => assertTransition('CERRADA', 'EN_CURSO', 'USUARIO', 'reabrir'))).toBe(
      'FORBIDDEN',
    );
    expect(codeOf(() => assertTransition('CERRADA', 'EN_CURSO', 'ADMIN', 'reabrir'))).toBeNull();
  });

  it('calcula las transiciones disponibles según el rol', () => {
    expect(availableTransitions('ABIERTA', 'USUARIO')).toEqual(['EN_CURSO']);
    expect(availableTransitions('ABIERTA', 'RESPONSABLE')).toEqual(['EN_CURSO', 'RECHAZADA']);
    expect(availableTransitions('CERRADA', 'USUARIO')).toEqual([]);
  });

  it('identifica una reapertura', () => {
    expect(isReopen('CERRADA', 'EN_CURSO')).toBe(true);
    expect(isReopen('PENDIENTE_TERCERO', 'EN_CURSO')).toBe(false);
  });
});
