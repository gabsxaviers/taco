import type { Lado } from './field';

export type Time = 0 | 1; // 0 = você, 1 = CPU

export interface Regras {
  pontos: number; // alvo
  cruzada: number; // pontos por cruzada
}

export type Fase =
  | { tipo: 'arremesso' }
  | { tipo: 'bolaVindo' }
  | { tipo: 'bolaEmJogo' } // rebatida: corrida + defesa ao mesmo tempo
  | { tipo: 'resultado'; mensagem: string }
  | { tipo: 'fim'; vencedor: Time; mensagem: string };

export interface Estado {
  fase: Fase;
  regras: Regras;
  placar: [number, number];
  rebatendo: Time;
  arremessoDe: Lado; // casinha de onde sai o próximo arremesso
  cruzadasNaJogada: number;
}

export type Evento =
  | { tipo: 'soltou' }
  | { tipo: 'derrubou' }
  | { tipo: 'passou' }
  | { tipo: 'parou' }
  | { tipo: 'rebateu' }
  | { tipo: 'cruzou' }
  | { tipo: 'pegouNoAr' }
  | { tipo: 'queimou' }
  | { tipo: 'acabou' }
  | { tipo: 'continuar' };

export const alvoDoArremesso = (e: Estado): Lado => (e.arremessoDe === 0 ? 1 : 0);

// Começa mostrando o resultado do sorteio; 'continuar' leva ao primeiro arremesso.
export function inicial(rebatendo: Time, regras: Regras): Estado {
  const mensagem = `Sorteio: ${rebatendo === 0 ? 'você começa rebatendo' : 'você começa arremessando'}. Primeiro a ${regras.pontos} pontos vence`;
  return {
    fase: { tipo: 'resultado', mensagem },
    regras,
    placar: [0, 0],
    rebatendo,
    arremessoDe: 0,
    cruzadasNaJogada: 0,
  };
}

const pts = (n: number) => `${n} ponto${n === 1 ? '' : 's'}`;

// Troca de papéis com a explicação do motivo, do ponto de vista de quem joga.
function troca(e: Estado, voceRebatia: string, cpuRebatia: string): Estado {
  const voceRebate = e.rebatendo === 0;
  const mensagem = voceRebate
    ? `${voceRebatia} Troca: agora você arremessa`
    : `${cpuRebatia} Troca: agora você rebate`;
  return {
    ...e,
    rebatendo: voceRebate ? 1 : 0,
    arremessoDe: alvoDoArremesso(e),
    cruzadasNaJogada: 0,
    fase: { tipo: 'resultado', mensagem },
  };
}

// Transição pura. Evento que não faz sentido na fase atual é ignorado.
export function step(e: Estado, ev: Evento): Estado {
  const proximoLado = alvoDoArremesso(e);
  switch (e.fase.tipo) {
    case 'arremesso':
      return ev.tipo === 'soltou' ? { ...e, fase: { tipo: 'bolaVindo' } } : e;

    case 'bolaVindo':
      if (ev.tipo === 'rebateu') return { ...e, cruzadasNaJogada: 0, fase: { tipo: 'bolaEmJogo' } };
      if (ev.tipo === 'derrubou')
        return troca(e, 'A CPU derrubou sua casinha!', 'Você derrubou a casinha!');
      if (ev.tipo === 'passou' || ev.tipo === 'parou') {
        const como = ev.tipo === 'passou' ? 'passou da casinha' : 'parou antes da casinha';
        const mensagem = `A bola ${como}. Próximo arremesso do outro lado`;
        return { ...e, arremessoDe: proximoLado, fase: { tipo: 'resultado', mensagem } };
      }
      return e;

    case 'bolaEmJogo': {
      const ganhos = pts(e.cruzadasNaJogada * e.regras.cruzada);
      switch (ev.tipo) {
        case 'cruzou': {
          const placar: [number, number] = [...e.placar];
          placar[e.rebatendo] += e.regras.cruzada;
          const s = { ...e, placar, cruzadasNaJogada: e.cruzadasNaJogada + 1 };
          if (placar[e.rebatendo] < e.regras.pontos) return s;
          const [voce, cpu] = placar;
          const mensagem =
            e.rebatendo === 0 ? `Você venceu ${voce} a ${cpu}!` : `A CPU venceu ${cpu} a ${voce}`;
          return { ...s, fase: { tipo: 'fim', vencedor: e.rebatendo, mensagem } };
        }
        case 'pegouNoAr':
          return troca(e, 'A CPU pegou sua rebatida no ar!', 'Você pegou a rebatida no ar!');
        case 'queimou':
          return troca(
            e,
            `Queimado! A CPU derrubou a casinha com você fora do círculo (ficou com ${ganhos}).`,
            `Queimou! Você derrubou a casinha com a CPU fora do círculo.`,
          );
        case 'acabou': {
          const n = e.cruzadasNaJogada;
          const quem = e.rebatendo === 0 ? 'Você' : 'A CPU';
          const feito =
            n > 0
              ? `${quem} fez ${n} cruzada${n === 1 ? '' : 's'}: +${ganhos}.`
              : 'Bola dominada, sem cruzada.';
          const mensagem = `${feito} Próximo arremesso do outro lado`;
          return { ...e, arremessoDe: proximoLado, fase: { tipo: 'resultado', mensagem } };
        }
        default:
          return e;
      }
    }

    case 'resultado':
      return ev.tipo === 'continuar' ? { ...e, fase: { tipo: 'arremesso' } } : e;

    case 'fim':
      return e;
  }
}
