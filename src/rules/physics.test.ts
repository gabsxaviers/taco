import { describe, expect, it } from 'vitest';
import { BALANCE as B } from './balance';
import {
  faixasBoas,
  lancarArremesso,
  passo,
  rebater,
  simularArremesso,
  tempoAteContato,
  type Bola,
} from './physics';

// Bola chegando na casinha 1 (vinda do lado 0) a uma altura y, a `tau` s do contato ideal
function bolaChegando(tau: number, y: number): Bola {
  const xContato = B.distanciaCasinhas - B.frenteContato;
  return {
    pos: { x: xContato - tau * 15, y, z: 0 },
    vel: { x: 15, y: 0, z: 0 },
    rolando: false,
    quiques: 0,
  };
}

describe('rebatida', () => {
  it('no tempo certo devolve forte pro campo; fora da janela erra', () => {
    const b = bolaChegando(0, 0.3);
    expect(tempoAteContato(b, 1)).toBeCloseTo(0);
    const s = rebater(b, 1);
    expect(s).toMatchObject({ acertou: true });
    expect(b.vel.x).toBeLessThan(0); // de volta pro lado 0
    expect(Math.hypot(b.vel.x, b.vel.y, b.vel.z)).toBeCloseTo(B.forcaMaxRebatida);

    expect(rebater(bolaChegando(B.janelaContato, 0.3), 1)).toEqual({
      acertou: false,
      motivo: 'cedo',
    });
    expect(rebater(bolaChegando(-B.janelaContato, 0.3), 1)).toEqual({
      acertou: false,
      motivo: 'atrasado',
    });
    expect(rebater(bolaChegando(0, 2), 1)).toEqual({ acertou: false, motivo: 'alta' });
  });

  it('cedo puxa pra um lado, atrasado manda pro outro e mais fraco', () => {
    const meia = B.janelaContato / 2;
    const cedo = bolaChegando(meia * 0.8, 0.3);
    const tarde = bolaChegando(-meia * 0.8, 0.3);
    rebater(cedo, 1);
    rebater(tarde, 1);
    expect(Math.sign(cedo.vel.z)).toBe(-Math.sign(tarde.vel.z));
    expect(tarde.vel.x).toBeGreaterThan(0); // passou da casinha: vai pra trás
  });

  it('bola alta sobe mais que bola rasteira', () => {
    const alta = bolaChegando(0, 0.9);
    const baixa = bolaChegando(0, B.raioBola);
    rebater(alta, 1);
    rebater(baixa, 1);
    expect(alta.vel.y).toBeGreaterThan(baixa.vel.y + 5);
  });
});

describe('arremesso', () => {
  it('força fraca morre antes, força máxima passa por cima', () => {
    expect(simularArremesso(0, 0, 0)).toBe('parou');
    expect(simularArremesso(0, 1, 0)).toBe('passou');
  });

  it('existe força que derruba, e a mira torta erra com a mesma força', () => {
    const faixas = faixasBoas(0.01);
    expect(faixas.length).toBeGreaterThan(0);
    const [ini, fim] = faixas[0];
    const p = (ini + fim) / 2;
    expect(simularArremesso(0, p, 0)).toBe('derrubou');
    expect(simularArremesso(0, p, 1.5)).not.toBe('derrubou');
  });

  it('é simétrico entre os dois lados', () => {
    for (const p of [0.2, 0.4, 0.6, 0.8]) {
      expect(simularArremesso(1, p, 0)).toBe(simularArremesso(0, p, 0));
    }
  });

  it('o quique perde altura e a bola termina rolando', () => {
    const b = lancarArremesso(0, 0.3, 0);
    const picos: number[] = [];
    let subindo = false;
    let pico = 0;
    for (let t = 0; t < 4 && !b.rolando; t += B.passoFixo) {
      passo(b, B.passoFixo);
      if (b.vel.y > 0) {
        subindo = true;
        pico = Math.max(pico, b.pos.y);
      } else if (subindo) {
        picos.push(pico);
        subindo = false;
        pico = 0;
      }
    }
    expect(b.rolando).toBe(true);
    expect(picos.length).toBeGreaterThan(1);
    for (let i = 1; i < picos.length; i++) expect(picos[i]).toBeLessThan(picos[i - 1]);
  });
});
