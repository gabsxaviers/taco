// Constantes de jogabilidade. Unidades: metros, segundos, m/s.
// Mexa à vontade testando; nada fora daqui deve ter número mágico de gameplay.

export const BALANCE = {
  // Campo
  distanciaCasinhas: 15,
  raioCirculo: 1.2,
  alturaCasinha: 0.25,
  larguraCasinha: 0.12,
  recuoArremessador: 2, // atrás da casinha
  afastamentoRebatedor: 0.6, // da casinha em direção ao meio
  ladoRebatedor: 0.8, // deslocamento lateral do rebatedor em relação à casinha

  // Arremesso. A força define onde a bola toca o chão pela 1ª vez, em fração da distância
  // arremessador→casinha: fraca quica cedo e morre no caminho, forte chega direto ou passa por cima.
  velocidadeArremesso: 18, // componente horizontal
  alturaSoltura: 1.0,
  primeiroQuiqueMin: 0.3, // força 0
  primeiroQuiqueMax: 1.15, // força 1
  periodoBarraForca: 1.2, // s para ida e volta da barra
  miraMax: 2, // m de desvio lateral máximo na casinha alvo
  velocidadeMiraTeclado: 1.5, // m/s

  // Bola e quique
  raioBola: 0.035,
  gravidade: 9.8,
  coeficienteQuique: 0.55, // fração da velocidade vertical que sobra no quique
  atritoQuique: 0.6, // fração da velocidade horizontal que sobra no quique (terra)
  velocidadeVerticalMinQuique: 0.8, // abaixo disso para de quicar e passa a rolar
  atritoRolamento: 8, // m/s² de desaceleração rolando
  velocidadeParada: 0.2,

  // CPU
  erroCpuForca: 0.12, // desvio máximo da força ideal
  erroCpuMira: 0.35, // m

  // Rebatida. Momento do clique → direção e força; altura da bola no contato → ângulo de subida.
  forcaMaxRebatida: 22,
  forcaMinRebatida: 0.45, // fração da máxima no limite da janela
  janelaContato: 0.18, // s no total, centrada no momento ideal
  frenteContato: 0.3, // m à frente da casinha onde o contato é perfeito
  alturaMaxContato: 1.1, // acima disso o taco não alcança
  alcanceTaco: 1.1, // m de desvio lateral da bola em relação à casinha
  anguloCedo: 75, // graus: clique adiantado puxa a bola pro lado
  anguloAtrasado: 150, // graus: clique atrasado manda a bola pro outro lado / pra trás
  anguloSubidaMin: 3, // graus, bola no chão: sai rasteira pra frente
  anguloSubidaMax: 30, // graus, bola na altura máxima de contato: sobe um pouco (pegável)
  erroCpuRebatida: 0.8, // fração da janela: erro máximo do momento do swing da CPU

  // Corrida
  velocidadeCorredor: 6,
  tempoCorrerDeNovo: 1.5, // s que o botão fica disponível após cada cruzada

  // Defesa
  velocidadeDefensor: 5.5,
  alcancePegada: 0.9, // distância horizontal pra pegar a bola
  alturaPegada: 2.2, // acima disso não alcança
  velocidadeArremessoDefensor: 16,
  erroArremessoDefensor: 0.03, // CPU: m de desvio lateral máximo por metro até a casinha
  // Você: mira que oscila na casinha; solte quando passar pela lata
  miraDefesaBase: 0.25, // m de amplitude mesmo colado na casinha
  miraDefesaPorMetro: 0.03, // m a mais de amplitude por metro de distância
  miraDefesaPeriodo: 1.0, // s pra ir e voltar
  // CPU rebatendo corre se o tempo do defensor queimar > tempo da cruzada × margem
  margemCpuCorrer: 1.15, // >1 = cautelosa, <1 = arrisca
  margemCpuCorrerPraVencer: 0.85, // quando essa cruzada ganha o jogo, arrisca mais
  reacaoDefensor: 0.3, // s que a CPU estima pro defensor pegar e soltar a bola

  // Simulação
  passoFixo: 1 / 120,
} as const;
