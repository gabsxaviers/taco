import { describe, expect, it } from 'vitest';
import { parseConfig } from './config';
import { createRng } from './rules/rng';

describe('parseConfig', () => {
  it('usa padrões e aceita parâmetros válidos', () => {
    expect(parseConfig('', 7)).toEqual({ pontos: 24, cruzada: 2, seed: 7, vitoria: 'pontos' });
    expect(parseConfig('?pontos=12&cruzada=1&seed=42')).toMatchObject({
      pontos: 12,
      cruzada: 1,
      seed: 42,
    });
  });

  it('ignora valores inválidos', () => {
    expect(parseConfig('?pontos=abc&cruzada=0&seed=-1', 5)).toMatchObject({
      pontos: 24,
      cruzada: 2,
      seed: 5,
    });
  });
});

describe('createRng', () => {
  it('é determinístico pela seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(seqA);
    for (const n of seqA) expect(n >= 0 && n < 1).toBe(true);
  });
});
