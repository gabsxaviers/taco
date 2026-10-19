import { describe, expect, it } from 'vitest';
import { BALANCE as B } from './balance';
import { cpuDefesa, cpuQuerCorrer } from './cpu';
import {
  avancarJogada,
  desvioMiraDefesa,
  foraDoCirculo,
  iniciarJogada,
  posCorredor,
  type Entrada,
  type EventoJogada,
  type Jogada,
} from './jogada';
import type { Bola } from './physics';
import { createRng } from './rng';

const dt = B.passoFixo;
const semErro = () => 0.5; // rng que zera o erro de arremesso

function bola(x: number, y: number, z: number, vx = 0, vy = 0, vz = 0): Bola {
  return { pos: { x, y, z }, vel: { x: vx, y: vy, z: vz }, rolando: false, quiques: 0 };
}

// Roda até um evento (ou até `seg` segundos) com a mesma entrada a cada passo
function rodar(j: Jogada, entrada: (j: Jogada) => Entrada, seg = 10, rng = semErro) {
  const eventos: EventoJogada[] = [];
  for (let t = 0; t < seg; t += dt) {
    const ev = avancarJogada(j, dt, entrada(j), rng);
    if (ev) eventos.push(ev);
    if (ev && ev !== 'cruzou') break;
  }
  return eventos;
}

describe('jogada', () => {
  it('correr completa a cruzada no tempo esperado e troca os corredores de lado', () => {
    const j = iniciarJogada(bola(7, 0.035, 30)); // bola longe, ninguém pega
    j.bola.rolando = true;
    avancarJogada(j, dt, { correr: true }, semErro);
    expect(j.correndo).toBe(true);
    const tempo = B.distanciaCasinhas / B.velocidadeCorredor;
    const ev = rodar(j, () => ({}), tempo + 0.1);
    expect(ev[0]).toBe('cruzou');
    expect(j.cruzadas).toBe(1);
    expect(j.partida).toEqual([1, 0]);
    expect(posCorredor(j, 0).x).toBeGreaterThan(B.distanciaCasinhas / 2);
  });

  it('fora do círculo só no meio da corrida', () => {
    const j = iniciarJogada(bola(7, 0.035, 30));
    expect(foraDoCirculo(j)).toBe(false);
    j.correndo = true;
    j.progresso = 0.02;
    expect(foraDoCirculo(j)).toBe(false);
    j.progresso = 0.5;
    expect(foraDoCirculo(j)).toBe(true);
  });

  it('defensor embaixo de bola que não quicou: pegou no ar', () => {
    const j = iniciarJogada(bola(-2, 1.5, 0)); // em cima do defensor 0
    expect(rodar(j, () => ({}), 0.1)).toEqual(['pegouNoAr']);
  });

  it('bola que já quicou é só dominada; jogada acaba quando a janela fecha', () => {
    const j = iniciarJogada(bola(-2, 0.035, 0));
    j.bola.quiques = 1;
    j.bola.rolando = true;
    const ev = rodar(j, () => ({}), B.tempoCorrerDeNovo + 0.5);
    expect(j.comBola).toBe(0);
    expect(ev).toEqual(['acabou']);
  });

  it('arremessar na casinha com o corredor fora do círculo queima', () => {
    const j = iniciarJogada(bola(3, 0.035, 0));
    j.bola.quiques = 1;
    j.defensores[0] = { x: 3, z: 0 };
    j.comBola = 0;
    j.correndo = true;
    j.progresso = 0.4;
    j.janela = 0;
    const ev = rodar(j, (s) => ({ arremessarEm: s.comBola !== null ? 0 : null }), 1);
    expect(ev).toEqual(['queimou']);
  });

  it('com a mira do jogador: no centro queima, de lado erra', () => {
    const montar = () => {
      const j = iniciarJogada(bola(5, 0.035, 0));
      j.bola.quiques = 1;
      j.defensores[0] = { x: 5, z: 0 };
      j.comBola = 0;
      j.correndo = true;
      j.progresso = 0.4;
      return j;
    };
    // o rng nunca deve ser usado quando o desvio vem da mira: um rng de erro máximo prova isso
    const rngRuim = () => 0.999;
    const mirar = (desvio: number) => (s: Jogada) =>
      s.comBola !== null ? { arremessarEm: 0 as const, desvio } : {};
    expect(rodar(montar(), mirar(0), 0.6, rngRuim)).toEqual(['queimou']);
    expect(rodar(montar(), mirar(0.3), 0.6, rngRuim)).not.toContain('queimou');
  });

  it('a mira oscila de um extremo ao outro e passa pelo centro', () => {
    const de = { x: 5, z: 0 };
    const amp = B.miraDefesaBase + B.miraDefesaPorMetro * 5;
    expect(desvioMiraDefesa(0, de, 0)).toBeCloseTo(-amp);
    expect(desvioMiraDefesa(B.miraDefesaPeriodo / 4, de, 0)).toBeCloseTo(0);
    expect(desvioMiraDefesa(B.miraDefesaPeriodo / 2, de, 0)).toBeCloseTo(amp);
    // mais longe = oscila mais
    expect(desvioMiraDefesa(0, { x: 12, z: 0 }, 0)).toBeLessThan(-amp);
  });

  it('a mesma bola na casinha com os corredores no círculo não queima', () => {
    const j = iniciarJogada(bola(3, 0.035, 0));
    j.defensores[0] = { x: 3, z: 0 };
    j.comBola = 0;
    j.janela = 5; // ainda podem correr: a jogada não acaba
    const ev = rodar(j, (s) => ({ arremessarEm: s.comBola !== null ? 0 : null }), 0.6);
    expect(ev).not.toContain('queimou');
  });

  it('CPU defendendo busca a bola e queima quem arrisca demais', () => {
    const rng = createRng(1);
    const j = iniciarJogada(bola(5, 0.035, 1, -3, 0, 0));
    j.bola.quiques = 1;
    j.bola.rolando = true;
    // rebatedor arrisca sempre que pode
    const ev = rodar(j, (s) => ({ ...cpuDefesa(s), correr: true }), 20, rng);
    expect(ev.at(-1)).toBe('queimou');
  });

  it('CPU rebatendo só corre se o defensor não chega a tempo de queimar', () => {
    const perto = iniciarJogada(bola(-1, 0.035, 0));
    const longe = iniciarJogada(bola(7.5, 0.035, 6));
    expect(cpuQuerCorrer(perto)).toBe(false);
    expect(cpuQuerCorrer(longe)).toBe(true);
    longe.comBola = 0; // já dominou: arriscar seria suicídio
    longe.defensores[0] = { x: 7.5, z: 6 };
    expect(cpuQuerCorrer(longe)).toBe(false);
  });

  it('CPU arrisca mais quando a cruzada vale a vitória', () => {
    // procura uma distância em que a CPU cautelosa fica, mas arrisca pra vencer
    let achou = false;
    for (let z = 0; z <= 12 && !achou; z += 0.25) {
      const j = iniciarJogada(bola(7.5, 0.035, z));
      if (!cpuQuerCorrer(j) && cpuQuerCorrer(j, true)) achou = true;
    }
    expect(achou).toBe(true);
  });
});
