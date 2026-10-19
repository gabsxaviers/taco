import { describe, expect, it } from 'vitest';
import { BALANCE as B } from './balance';
import { escolherArremesso, escolherMomentoSwing } from './cpu';
import {
  faixasBoas,
  lancarArremesso,
  passo,
  rebater,
  simularArremesso,
  tempoAteContato,
} from './physics';
import { createRng } from './rng';

describe('CPU arremessando', () => {
  const faixas = faixasBoas(0.01);

  it('é determinística pela seed', () => {
    const a = createRng(7);
    const b = createRng(7);
    for (let i = 0; i < 5; i++)
      expect(escolherArremesso(a, faixas)).toEqual(escolherArremesso(b, faixas));
  });

  it('acerta às vezes, mas não sempre', () => {
    const rng = createRng(123);
    let acertos = 0;
    const N = 200;
    for (let i = 0; i < N; i++) {
      const { potencia, mira } = escolherArremesso(rng, faixas);
      if (simularArremesso(i % 2 === 0 ? 0 : 1, potencia, mira) === 'derrubou') acertos++;
    }
    expect(acertos / N).toBeGreaterThan(0.15);
    expect(acertos / N).toBeLessThan(0.85);
  });
});

describe('CPU rebatendo', () => {
  // Arremesso direto no meio da faixa boa, swing da CPU em passo fixo
  function swingDaCpu(seed: number) {
    const rng = createRng(seed);
    const [ini, fim] = faixasBoas(0.01).at(-1)!;
    const b = lancarArremesso(0, (ini + fim) / 2, 0);
    const momento = escolherMomentoSwing(rng);
    for (let t = 0; t < 3; t += B.passoFixo) {
      if (tempoAteContato(b, 1) <= momento) return rebater(b, 1).acertou;
      passo(b, B.passoFixo);
    }
    return false;
  }

  it('é determinística pela seed', () => {
    for (const s of [1, 2, 3]) expect(swingDaCpu(s)).toBe(swingDaCpu(s));
  });

  it('acerta às vezes, mas não sempre', () => {
    let acertos = 0;
    for (let s = 0; s < 200; s++) if (swingDaCpu(s)) acertos++;
    expect(acertos).toBeGreaterThan(40);
    expect(acertos).toBeLessThan(180);
  });
});
