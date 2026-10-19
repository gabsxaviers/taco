import { BALANCE as B } from './balance';
import { arremessadorPos, casinhaX, rebatedorPos, type Lado, type Ponto } from './field';
import { bateuNaCasinha, passo, type Bola } from './physics';
import type { Rng } from './rng';

// Bola em jogo depois da rebatida: corredores, defensores, pegada e arremesso na casinha.
// TypeScript puro; a cena só desenha e traduz input em Entrada.

export interface Jogada {
  bola: Bola;
  defensores: [Ponto, Ponto]; // [0] começa atrás da casinha 0, [1] atrás da casinha 1
  comBola: 0 | 1 | null;
  bolaDeDefensor: boolean; // a bola solta foi arremessada por um defensor (vale pra queimar)
  semPegar: number; // s em que ninguém pega (logo depois de arremessar)
  progresso: number; // 0..1 da cruzada atual
  correndo: boolean;
  janela: number; // s restantes pra decidir correr (mais uma)
  cruzadas: number;
  partida: [Lado, Lado]; // casinha de onde cada corredor sai na cruzada atual
}

export interface Entrada {
  correr?: boolean;
  alvo?: Ponto | null; // pra onde o defensor controlado corre
  arremessarEm?: Lado | null; // defensor com a bola arremessa nessa casinha
  // desvio lateral (m) do arremesso na casinha, vindo da mira do jogador;
  // sem ele o desvio é sorteado pela distância (CPU)
  desvio?: number;
}

export type EventoJogada = 'cruzou' | 'pegouNoAr' | 'queimou' | 'acabou' | null;

const outro = (l: Lado): Lado => (l === 0 ? 1 : 0);
const dist = (a: Ponto, b: Ponto) => Math.hypot(a.x - b.x, a.z - b.z);

export function iniciarJogada(bola: Bola): Jogada {
  return {
    bola,
    defensores: [arremessadorPos(0), arremessadorPos(1)],
    comBola: null,
    bolaDeDefensor: false,
    semPegar: 0,
    progresso: 0,
    correndo: false,
    janela: B.tempoCorrerDeNovo,
    cruzadas: 0,
    partida: [0, 1],
  };
}

export const foraDoCirculo = (j: Jogada): boolean => {
  const d = j.progresso * B.distanciaCasinhas;
  return j.correndo && d > B.raioCirculo && B.distanciaCasinhas - d > B.raioCirculo;
};

export function posCorredor(j: Jogada, i: 0 | 1): Ponto {
  const de = rebatedorPos(j.partida[i]);
  const para = rebatedorPos(outro(j.partida[i]));
  return { x: de.x + (para.x - de.x) * j.progresso, z: de.z + (para.z - de.z) * j.progresso };
}

// Quem está com a bola, ou o defensor mais próximo dela: é esse que se controla.
export function defensorDaBola(j: Jogada): 0 | 1 {
  if (j.comBola !== null) return j.comBola;
  const b = { x: j.bola.pos.x, z: j.bola.pos.z };
  return dist(j.defensores[0], b) <= dist(j.defensores[1], b) ? 0 : 1;
}

export const casinhaMaisProxima = (p: Ponto): Lado =>
  Math.abs(p.x - casinhaX(0)) <= Math.abs(p.x - casinhaX(1)) ? 0 : 1;

function mover(p: Ponto, alvo: Ponto, passoMax: number): Ponto {
  const d = dist(p, alvo);
  if (d <= passoMax) return { ...alvo };
  return { x: p.x + ((alvo.x - p.x) / d) * passoMax, z: p.z + ((alvo.z - p.z) / d) * passoMax };
}

const distAteCasinha = (de: Ponto, alvo: Lado) => dist(de, { x: casinhaX(alvo), z: 0 });

// Mira do jogador ao arremessar na casinha: oscila de um lado pro outro da lata (onda
// triangular, começando num extremo) e é mais larga quanto mais longe. Retorna o desvio em m.
export function desvioMiraDefesa(t: number, de: Ponto, alvo: Lado): number {
  const amplitude = B.miraDefesaBase + B.miraDefesaPorMetro * distAteCasinha(de, alvo);
  const fase = (t / B.miraDefesaPeriodo) % 1;
  return amplitude * (1 - 4 * Math.abs(fase - 0.5)); // -amp → +amp → -amp
}

// Arremesso reto e baixo do defensor até a base da casinha, desviado `erro` m pro lado.
function arremessar(j: Jogada, de: Ponto, alvo: Lado, erro: number) {
  const tx = casinhaX(alvo);
  const d = Math.max(dist(de, { x: tx, z: erro }), 0.5);
  const t = d / B.velocidadeArremessoDefensor;
  const y0 = 1.0;
  const yAlvo = B.alturaCasinha / 2;
  j.bola.pos = { x: de.x, y: y0, z: de.z };
  j.bola.vel = {
    x: (tx - de.x) / t,
    y: (yAlvo - y0 + 0.5 * B.gravidade * t * t) / t,
    z: (erro - de.z) / t,
  };
  j.bola.rolando = false;
  j.comBola = null;
  j.bolaDeDefensor = true;
  j.semPegar = 0.3;
}

export function avancarJogada(j: Jogada, dt: number, e: Entrada, rng: Rng): EventoJogada {
  let evento: EventoJogada = null;
  j.semPegar -= dt;

  // Corrida
  if (e.correr && !j.correndo && j.janela > 0) {
    j.correndo = true;
    j.janela = 0;
  }
  if (j.correndo) {
    j.progresso += (B.velocidadeCorredor * dt) / B.distanciaCasinhas;
    if (j.progresso >= 1) {
      j.progresso = 0;
      j.correndo = false;
      j.cruzadas++;
      j.partida = [outro(j.partida[0]), outro(j.partida[1])];
      j.janela = B.tempoCorrerDeNovo;
      evento = 'cruzou';
    }
  } else {
    j.janela = Math.max(0, j.janela - dt);
  }

  // Defensores: o controlado vai pro alvo; o outro volta pra trás da casinha dele
  const ctrl = defensorDaBola(j);
  const outroDef = ctrl === 0 ? 1 : 0;
  const passoMax = B.velocidadeDefensor * dt;
  if (e.alvo) j.defensores[ctrl] = mover(j.defensores[ctrl], e.alvo, passoMax);
  j.defensores[outroDef] = mover(j.defensores[outroDef], arremessadorPos(outroDef), passoMax);

  // Bola
  if (j.comBola !== null) {
    const d = j.defensores[j.comBola];
    j.bola.pos = { x: d.x, y: 1.0, z: d.z };
    j.bola.vel = { x: 0, y: 0, z: 0 };
    if (e.arremessarEm != null) {
      const sorteado =
        (rng() * 2 - 1) * B.erroArremessoDefensor * distAteCasinha(d, e.arremessarEm);
      arremessar(j, d, e.arremessarEm, e.desvio ?? sorteado);
    }
  } else {
    const antes = { ...j.bola.pos };
    passo(j.bola, dt);
    const derrubou = bateuNaCasinha(antes, j.bola.pos, 0) || bateuNaCasinha(antes, j.bola.pos, 1);
    if (j.bolaDeDefensor && derrubou && foraDoCirculo(j)) return 'queimou';

    if (j.semPegar <= 0) {
      for (const i of [0, 1] as const) {
        const perto = dist(j.defensores[i], { x: j.bola.pos.x, z: j.bola.pos.z });
        if (perto > B.alcancePegada || j.bola.pos.y > B.alturaPegada) continue;
        if (!j.bolaDeDefensor && j.bola.quiques === 0) return 'pegouNoAr';
        j.comBola = i;
        j.bolaDeDefensor = false;
        break;
      }
    }
  }

  // Bola dominada com os corredores parados no círculo e sem tempo pra correr de novo
  if (!evento && j.comBola !== null && !j.correndo && j.janela <= 0) evento = 'acabou';
  return evento;
}
