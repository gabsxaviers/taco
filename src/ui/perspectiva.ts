import { BALANCE as B } from '../rules/balance';
import type { Lado } from '../rules/field';

// Câmera atrás da casinha `vista`, olhando pro outro lado do campo. Sem inclinação:
// o horizonte fica numa altura fixa da tela. Pode andar ao longo do campo e pros lados
// (seguindo a bola), sempre olhando na mesma direção.
const CAM_RECUO = 6; // m atrás da casinha
const CAM_ALTURA = 2.6; // m
const FOCAL = 1250; // px; maior = mais zoom
const HORIZONTE_Y = 70; // px
const PROFUNDIDADE_MIN = 0.5;
// Mais perto que isso não é desenhado (o arremessador atrás da sua casinha taparia o campo)
export const PROFUNDIDADE_VISIVEL = 4.5;

// Deslocamento da câmera a partir da posição de repouso, no referencial da vista:
// avanco = metros pra frente (rumo à outra casinha), lateral = metros pra direita da tela.
export interface Camera {
  avanco: number;
  lateral: number;
}
export const CAMERA_PARADA: Camera = { avanco: 0, lateral: 0 };

export interface Projetado {
  sx: number;
  sy: number;
  escala: number; // px por metro naquela profundidade
  profundidade: number;
}

// Mundo → referencial da vista: lado 1 é o mundo espelhado (x e z invertidos)
export const paraVista = (vista: Lado, x: number, z: number) =>
  vista === 0 ? { xl: x, zl: z } : { xl: B.distanciaCasinhas - x, zl: -z };

export function projetar(
  vista: Lado,
  larguraTela: number,
  x: number,
  y: number,
  z: number,
  cam: Camera = CAMERA_PARADA,
): Projetado {
  const { xl, zl } = paraVista(vista, x, z);
  const profundidade = Math.max(xl - cam.avanco + CAM_RECUO, PROFUNDIDADE_MIN);
  const escala = FOCAL / profundidade;
  return {
    sx: larguraTela / 2 + (zl - cam.lateral) * escala,
    sy: HORIZONTE_Y + (CAM_ALTURA - y) * escala,
    escala,
    profundidade,
  };
}

// Inverso de projetar no chão (y=0): ponto da tela → ponto do campo. null acima do horizonte.
export function desprojetarChao(
  vista: Lado,
  larguraTela: number,
  sx: number,
  sy: number,
  cam: Camera = CAMERA_PARADA,
): { x: number; z: number } | null {
  if (sy <= HORIZONTE_Y + 4) return null;
  const escala = (sy - HORIZONTE_Y) / CAM_ALTURA;
  const xl = FOCAL / escala - CAM_RECUO + cam.avanco;
  const zl = (sx - larguraTela / 2) / escala + cam.lateral;
  return vista === 0 ? { x: xl, z: zl } : { x: B.distanciaCasinhas - xl, z: -zl };
}

export { HORIZONTE_Y };
