import { BALANCE as B } from './balance';
import { arremessadorPos, casinhaX, rebatedorPos, type Lado } from './field';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Bola {
  pos: Vec3;
  vel: Vec3;
  rolando: boolean;
  quiques: number; // toques no chão desde o último lançamento/rebatida (0 = ainda no ar)
}

export type FimArremesso = 'derrubou' | 'passou' | 'parou';

const outro = (l: Lado): Lado => (l === 0 ? 1 : 0);

// Arremesso de quem está atrás da casinha `de` contra a casinha do outro lado.
// potencia ∈ [0,1] escolhe onde a bola quica pela 1ª vez; mira = desvio lateral (m) na casinha alvo.
export function lancarArremesso(de: Lado, potencia: number, mira: number): Bola {
  const a = arremessadorPos(de);
  const alvoX = casinhaX(outro(de));
  const dist = Math.abs(alvoX - a.x);
  const sentido = Math.sign(alvoX - a.x);
  const p = Math.min(Math.max(potencia, 0), 1);
  const quique = dist * (B.primeiroQuiqueMin + p * (B.primeiroQuiqueMax - B.primeiroQuiqueMin));
  const t = quique / B.velocidadeArremesso;
  // vy tal que y(t) = raio da bola no ponto do 1º quique
  const vy = (B.raioBola - B.alturaSoltura + 0.5 * B.gravidade * t * t) / t;
  return {
    pos: { x: a.x, y: B.alturaSoltura, z: a.z },
    vel: {
      x: sentido * B.velocidadeArremesso,
      y: vy,
      z: ((mira - a.z) * B.velocidadeArremesso) / dist,
    },
    rolando: false,
    quiques: 0,
  };
}

// Avança a bola dt segundos (muta). Quica no chão até perder força, depois rola.
export function passo(b: Bola, dt: number): void {
  const { pos, vel } = b;
  if (b.rolando) {
    const v = Math.hypot(vel.x, vel.z);
    const nova = Math.max(v - B.atritoRolamento * dt, 0);
    const f = v > 0 ? nova / v : 0;
    vel.x *= f;
    vel.z *= f;
  } else {
    vel.y -= B.gravidade * dt;
  }
  pos.x += vel.x * dt;
  pos.y += vel.y * dt;
  pos.z += vel.z * dt;

  if (!b.rolando && pos.y <= B.raioBola && vel.y < 0) {
    b.quiques++;
    pos.y = B.raioBola;
    vel.y = -vel.y * B.coeficienteQuique;
    vel.x *= B.atritoQuique;
    vel.z *= B.atritoQuique;
    if (vel.y < B.velocidadeVerticalMinQuique) {
      vel.y = 0;
      b.rolando = true;
    }
  }
}

// A bola atravessou o plano da casinha entre `antes` e `depois` na altura/largura dela?
export function bateuNaCasinha(antes: Vec3, depois: Vec3, lado: Lado): boolean {
  const cx = casinhaX(lado);
  if ((antes.x - cx) * (depois.x - cx) > 0) return false; // não cruzou
  const t = antes.x === depois.x ? 0 : (cx - antes.x) / (depois.x - antes.x);
  const y = antes.y + (depois.y - antes.y) * t;
  const z = antes.z + (depois.z - antes.z) * t;
  return y - B.raioBola < B.alturaCasinha && Math.abs(z) < B.larguraCasinha / 2 + B.raioBola;
}

// Resultado do arremesso depois de mais um passo, ou null se a bola ainda está vindo.
export function avancarArremesso(b: Bola, alvo: Lado, dt: number): FimArremesso | null {
  const antes = { ...b.pos };
  passo(b, dt);
  if (bateuNaCasinha(antes, b.pos, alvo)) return 'derrubou';
  const alemDaCasinha = (b.pos.x - casinhaX(alvo)) * Math.sign(b.vel.x || 1) > 1;
  if (alemDaCasinha && b.vel.x !== 0) return 'passou';
  if (Math.abs(b.pos.z) > 8) return 'passou';
  if (b.rolando && Math.hypot(b.vel.x, b.vel.z) < B.velocidadeParada) return 'parou';
  return null;
}

export function simularArremesso(de: Lado, potencia: number, mira: number): FimArremesso {
  const b = lancarArremesso(de, potencia, mira);
  for (let t = 0; t < 10; t += B.passoFixo) {
    const fim = avancarArremesso(b, outro(de), B.passoFixo);
    if (fim) return fim;
  }
  return 'parou';
}

// Faixas de força que derrubam a casinha mirando no centro (ex.: uma rasteira e uma direta).
// O arremesso é simétrico, então vale pros dois lados. Usado pela barra e pela CPU.
export function faixasBoas(resolucao = 0.005): [number, number][] {
  const faixas: [number, number][] = [];
  let ini = -1;
  for (let p = 0; p <= 1 + 1e-9; p += resolucao) {
    const bom = simularArremesso(0, p, 0) === 'derrubou';
    if (bom && ini < 0) ini = p;
    if (!bom && ini >= 0) {
      faixas.push([ini, p - resolucao]);
      ini = -1;
    }
  }
  if (ini >= 0) faixas.push([ini, 1]);
  return faixas;
}

// ---------- rebatida ----------

const praDentro = (lado: Lado): number => (lado === 0 ? 1 : -1);

// Segundos até a bola chegar no ponto ideal de contato do rebatedor da casinha `lado`.
// Positivo = ainda vai chegar (clique adiantado); negativo = já passou (atrasado).
export function tempoAteContato(b: Bola, lado: Lado): number {
  const xContato = casinhaX(lado) + praDentro(lado) * B.frenteContato;
  const vx = b.vel.x || 1e-6;
  return (xContato - b.pos.x) / vx;
}

export type Swing =
  | { acertou: true; qualidade: number } // 1 = no tempo perfeito
  | { acertou: false; motivo: 'cedo' | 'atrasado' | 'alta' | 'longe' };

// Swing do rebatedor da casinha `lado` agora. Se acertar, muta a velocidade da bola.
export function rebater(b: Bola, lado: Lado): Swing {
  const tau = tempoAteContato(b, lado);
  const meia = B.janelaContato / 2;
  if (tau > meia) return { acertou: false, motivo: 'cedo' };
  if (tau < -meia) return { acertou: false, motivo: 'atrasado' };
  if (b.pos.y > B.alturaMaxContato) return { acertou: false, motivo: 'alta' };
  if (Math.abs(b.pos.z) > B.alcanceTaco) return { acertou: false, motivo: 'longe' };

  const u = tau / meia; // +1 bem cedo … -1 bem atrasado
  const rad = Math.PI / 180;
  const horizontal = (u >= 0 ? u * B.anguloCedo : u * B.anguloAtrasado) * rad;
  const alturaRel = Math.min(Math.max(b.pos.y / B.alturaMaxContato, 0), 1);
  const subida = (B.anguloSubidaMin + alturaRel * (B.anguloSubidaMax - B.anguloSubidaMin)) * rad;
  const forca = B.forcaMaxRebatida * (1 - (1 - B.forcaMinRebatida) * Math.abs(u));

  // "frente" = de volta pro campo; o lado puxado é o oposto de onde o rebatedor está
  const frente = praDentro(lado);
  const ladoPuxado = -Math.sign(rebatedorPos(lado).z);
  const h = forca * Math.cos(subida);
  b.vel = {
    x: frente * h * Math.cos(horizontal),
    y: forca * Math.sin(subida),
    z: ladoPuxado * h * Math.sin(horizontal),
  };
  b.pos.y = Math.max(b.pos.y, B.raioBola);
  b.rolando = false;
  b.quiques = 0;
  return { acertou: true, qualidade: 1 - Math.abs(u) };
}
