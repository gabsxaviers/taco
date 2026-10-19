import { BALANCE as B } from './balance';
import { casinhaX } from './field';
import {
  casinhaMaisProxima,
  defensorDaBola,
  foraDoCirculo,
  type Entrada,
  type Jogada,
} from './jogada';
import type { Rng } from './rng';

export interface Arremesso {
  potencia: number;
  mira: number;
}

const erro = (rng: Rng, max: number) => (rng() * 2 - 1) * max;

// Escolhe uma das faixas boas e mira no centro, com erro uniforme em força e mira.
// ponytail: CPU sem estratégia (não escolhe rasteira x direta pelo rebatedor), add na etapa 5
export function escolherArremesso(rng: Rng, faixas: [number, number][]): Arremesso {
  const [ini, fim] = faixas.length ? faixas[Math.floor(rng() * faixas.length)] : [0.5, 0.5];
  return {
    potencia: Math.min(Math.max((ini + fim) / 2 + erro(rng, B.erroCpuForca), 0), 1),
    mira: erro(rng, B.erroCpuMira),
  };
}

// Quantos segundos antes do contato ideal a CPU vai bater (negativo = atrasada).
// Sorteado uma vez por arremesso; a cena dispara o swing quando tempoAteContato ≤ esse valor.
export function escolherMomentoSwing(rng: Rng): number {
  return erro(rng, B.janelaContato * B.erroCpuRebatida);
}

// Defesa da CPU: o mais próximo corre na bola; com ela na mão, queima se der,
// senão chega perto da casinha mais próxima e espera o rebatedor arriscar.
export function cpuDefesa(j: Jogada): Entrada {
  if (j.comBola === null) return { alvo: { x: j.bola.pos.x, z: j.bola.pos.z } };
  const comBola = j.defensores[defensorDaBola(j)];
  const casinha = casinhaMaisProxima(comBola);
  if (foraDoCirculo(j)) return { arremessarEm: casinha };
  return { alvo: { x: casinhaX(casinha) + (casinha === 0 ? 2 : -2), z: 0 } };
}

// CPU rebatendo: estima quanto o defensor leva pra chegar na bola e acertar a casinha mais
// próxima, e compara com o tempo que o corredor passa fora do círculo. Arrisca mais se a
// cruzada vale a vitória.
// ponytail: estima com a bola parada onde está (ignora que ela ainda rola/voa)
export function cpuQuerCorrer(j: Jogada, cruzadaVence = false): boolean {
  const def = j.defensores[defensorDaBola(j)];
  const bola = { x: j.bola.pos.x, z: j.bola.pos.z };
  const ate = (a: { x: number; z: number }, b: { x: number; z: number }) =>
    Math.hypot(a.x - b.x, a.z - b.z);
  const buscar = j.comBola === null ? ate(def, bola) / B.velocidadeDefensor : 0;
  const deOnde = j.comBola === null ? bola : def;
  const casinha = { x: casinhaX(casinhaMaisProxima(deOnde)), z: 0 };
  const tempoQueimar =
    buscar + B.reacaoDefensor + ate(deOnde, casinha) / B.velocidadeArremessoDefensor;
  const tempoFora = (B.distanciaCasinhas - B.raioCirculo) / B.velocidadeCorredor;
  const margem = cruzadaVence ? B.margemCpuCorrerPraVencer : B.margemCpuCorrer;
  return tempoQueimar > tempoFora * margem;
}
