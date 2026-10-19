// 'tacos' = vitória ao bater os tacos no meio (variação futura, ainda não implementada)
export type CondicaoVitoria = 'pontos' | 'tacos';

export interface MatchConfig {
  pontos: number; // pontuação alvo
  cruzada: number; // pontos por cruzada
  seed: number;
  vitoria: CondicaoVitoria;
}

export const DEFAULT_CONFIG: MatchConfig = {
  pontos: 24,
  cruzada: 2,
  seed: 0,
  vitoria: 'pontos',
};

function intParam(p: URLSearchParams, key: string, min: number, max: number): number | undefined {
  const raw = p.get(key);
  if (raw === null || !/^\d+$/.test(raw)) return undefined;
  const n = Number(raw);
  return n >= min && n <= max ? n : undefined;
}

// Ex.: ?pontos=12&cruzada=1&seed=42. Valor inválido cai no padrão.
export function parseConfig(search: string, randomSeed = Date.now()): MatchConfig {
  const p = new URLSearchParams(search);
  return {
    pontos: intParam(p, 'pontos', 1, 999) ?? DEFAULT_CONFIG.pontos,
    cruzada: intParam(p, 'cruzada', 1, 99) ?? DEFAULT_CONFIG.cruzada,
    seed: intParam(p, 'seed', 0, 2 ** 32 - 1) ?? randomSeed >>> 0,
    vitoria: DEFAULT_CONFIG.vitoria, // ponytail: ?vitoria= só quando 'tacos' existir
  };
}
