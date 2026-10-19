import { describe, expect, it } from 'vitest';
import { inicial, step, type Estado, type Evento } from './match';

const REGRAS = { pontos: 6, cruzada: 2 };
const rodar = (e: Estado, ...evs: Evento['tipo'][]) =>
  evs.reduce((s, tipo) => step(s, { tipo } as Evento), e);
const mensagem = (e: Estado) => ('mensagem' in e.fase ? e.fase.mensagem : '');
// partida já passada do aviso do sorteio
const comeco = (rebatendo: 0 | 1) => step(inicial(rebatendo, REGRAS), { tipo: 'continuar' });

describe('máquina de estados', () => {
  it('começa avisando o sorteio', () => {
    const e = inicial(0, REGRAS);
    expect(mensagem(e)).toMatch(/Sorteio: você começa rebatendo/);
    expect(comeco(0).fase.tipo).toBe('arremesso');
  });

  it('arremesso → bola vindo → resultado → arremesso', () => {
    const e = rodar(comeco(1), 'soltou');
    expect(e.fase.tipo).toBe('bolaVindo');
    const r = rodar(e, 'passou');
    expect(r.fase.tipo).toBe('resultado');
    expect(rodar(r, 'continuar').fase.tipo).toBe('arremesso');
  });

  it('bola que não derruba passa o arremesso pro outro lado sem trocar papéis', () => {
    const e = rodar(comeco(1), 'soltou', 'parou', 'continuar');
    expect(e.arremessoDe).toBe(1);
    expect(e.rebatendo).toBe(1);
  });

  it('derrubar a casinha no arremesso troca os papéis e explica', () => {
    const e = rodar(comeco(1), 'soltou', 'derrubou');
    expect(e.rebatendo).toBe(0);
    expect(mensagem(e)).toMatch(/derrubou.*Troca/);
  });

  it('cada cruzada soma pontos e o fim da jogada resume', () => {
    const e = rodar(comeco(0), 'soltou', 'rebateu', 'cruzou', 'cruzou');
    expect(e.placar).toEqual([4, 0]);
    expect(e.fase.tipo).toBe('bolaEmJogo');
    const r = rodar(e, 'acabou');
    expect(mensagem(r)).toMatch(/2 cruzadas: \+4 pontos/);
    expect(r.rebatendo).toBe(0);
  });

  it('chegar no alvo termina a partida', () => {
    const e = rodar(comeco(1), 'soltou', 'rebateu', 'cruzou', 'cruzou', 'cruzou');
    expect(e.fase).toMatchObject({ tipo: 'fim', vencedor: 1 });
    expect(rodar(e, 'continuar', 'soltou')).toEqual(e);
  });

  it('pegou no ar ou queimou trocam os papéis, mas os pontos ficam', () => {
    const e = rodar(comeco(0), 'soltou', 'rebateu', 'cruzou');
    const q = rodar(e, 'queimou');
    expect(q.rebatendo).toBe(1);
    expect(q.placar).toEqual([2, 0]);
    expect(mensagem(q)).toMatch(/Queimado.*2 pontos.*Troca/);
    expect(mensagem(rodar(e, 'pegouNoAr'))).toMatch(/no ar.*Troca/);
  });

  it('ignora eventos fora de hora', () => {
    const e = comeco(0);
    expect(rodar(e, 'derrubou', 'continuar', 'cruzou')).toEqual(e);
  });
});
