import { describe, expect, it } from 'vitest';
import { desprojetarChao, projetar } from './perspectiva';

describe('perspectiva', () => {
  it('desprojetar desfaz projetar no chão, com a câmera parada ou andando', () => {
    for (const vista of [0, 1] as const) {
      for (const cam of [undefined, { avanco: 7, lateral: -2 }]) {
        const s = projetar(vista, 1280, 9, 0, 1.5, cam);
        const p = desprojetarChao(vista, 1280, s.sx, s.sy, cam)!;
        expect(p.x).toBeCloseTo(9);
        expect(p.z).toBeCloseTo(1.5);
      }
    }
  });
});
