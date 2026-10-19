import { BALANCE as B } from './balance';

// Mundo 3D em metros: x ao longo do campo (casinha 0 em x=0, casinha 1 em x=distância),
// z lateral (+ = direita de quem está na casinha 0 olhando pra casinha 1), y altura.
export interface Ponto {
  x: number;
  z: number;
}

export type Lado = 0 | 1;

export const casinhaX = (lado: Lado): number => (lado === 0 ? 0 : B.distanciaCasinhas);

// +1 aponta da casinha pro meio do campo
const praDentro = (lado: Lado): number => (lado === 0 ? 1 : -1);

// Rebatedor ao lado da casinha, um pouco à frente; arremessador atrás dela.
export const rebatedorPos = (lado: Lado): Ponto => ({
  x: casinhaX(lado) + praDentro(lado) * B.afastamentoRebatedor,
  z: -praDentro(lado) * B.ladoRebatedor,
});

export const arremessadorPos = (lado: Lado): Ponto => ({
  x: casinhaX(lado) - praDentro(lado) * B.recuoArremessador,
  z: 0,
});
