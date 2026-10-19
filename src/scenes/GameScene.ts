import Phaser from 'phaser';
import type { MatchConfig } from '../config';
import { BALANCE as B } from '../rules/balance';
import { cpuDefesa, cpuQuerCorrer, escolherArremesso, escolherMomentoSwing } from '../rules/cpu';
import { arremessadorPos, casinhaX, rebatedorPos, type Lado, type Ponto } from '../rules/field';
import {
  avancarJogada,
  casinhaMaisProxima,
  defensorDaBola,
  desvioMiraDefesa,
  iniciarJogada,
  posCorredor,
  type Entrada,
  type Jogada,
} from '../rules/jogada';
import { alvoDoArremesso, inicial, step, type Estado, type Evento } from '../rules/match';
import {
  avancarArremesso,
  faixasBoas,
  lancarArremesso,
  rebater,
  tempoAteContato,
  type Bola,
} from '../rules/physics';
import { createRng, type Rng } from '../rules/rng';
import { BotaoCorrer } from '../ui/BotaoCorrer';
import { Hud } from '../ui/Hud';
import {
  CAMERA_PARADA,
  HORIZONTE_Y,
  PROFUNDIDADE_VISIVEL,
  desprojetarChao,
  paraVista,
  projetar,
  type Camera,
  type Projetado,
} from '../ui/perspectiva';
import { PowerBar } from '../ui/PowerBar';

const COR_TIME = [0x2f80ed, 0xd64545]; // você, CPU
const ALTURA_JOGADOR = 1.7;
const MEIA_RUA = 4; // m de cada lado: só visual
const ESPERA_CPU = 1000; // ms antes da CPU arremessar
const AUTO_CONTINUAR = 3000; // ms
const DURACAO_SWING = 160; // ms, só visual
const TOQUE_CASINHA = 90; // px: toque mais perto que isso de uma casinha = arremessar nela
const CAM_DISTANCIA_BOLA = 9; // m que a câmera fica atrás da bola rebatida
const CAM_LATERAL = 0.7; // fração do desvio lateral da bola que a câmera acompanha
const CAM_SUAVIDADE = 3; // maior = câmera gruda mais rápido na bola

const TEXTO_SWING: Record<string, string> = {
  cedo: 'Cedo demais!',
  atrasado: 'Atrasado!',
  alta: 'Alta demais!',
  longe: 'Longe demais!',
};
const textoAcerto = (q: number) => (q > 0.8 ? 'Na medida!' : q > 0.4 ? 'Boa!' : 'Pegou de raspão');

// Onda triangular 0→1→0 com o período da barra
const forcaNoTempo = (t: number) => {
  const fase = (t / B.periodoBarraForca) % 1;
  return 1 - Math.abs(fase * 2 - 1);
};

interface Boneco {
  corpo: Phaser.GameObjects.Rectangle;
  cabeca: Phaser.GameObjects.Arc;
}

export class GameScene extends Phaser.Scene {
  private estado!: Estado;
  private rng!: Rng;
  private faixas!: [number, number][];
  private hud!: Hud;
  private barra!: PowerBar;
  private botaoCorrer!: BotaoCorrer;

  private vista: Lado = 0;
  private cam: Camera = { ...CAMERA_PARADA };
  private cenario!: Phaser.GameObjects.Graphics; // rua e círculos
  private grama!: Phaser.GameObjects.Rectangle;
  private casinhas: Phaser.GameObjects.Rectangle[] = [];
  private rebatedores: Boneco[] = [];
  private defensores: Boneco[] = [];
  private tacos: Phaser.GameObjects.Graphics[] = [];
  private swingTaco = [0, 0]; // progresso visual do swing de cada rebatedor
  private bolaObj!: Phaser.GameObjects.Arc;
  private sombra!: Phaser.GameObjects.Ellipse;
  private marcas!: Phaser.GameObjects.Graphics; // mira, defensor controlado, casinhas-alvo

  private bola: Bola | null = null;
  private jogada: Jogada | null = null;
  private acumulador = 0;
  private carregando = false;
  private tCarga = 0;
  private miraTela = 0; // m de desvio lateral, positivo = direita da tela
  private swingou = false;
  private momentoSwingCpu = 0;
  private timer?: Phaser.Time.TimerEvent;
  private setas!: Phaser.Types.Input.Keyboard.CursorKeys;

  // entrada do jogador na jogada, consumida no próximo passo fixo
  private pedirCorrer = false;
  private pedirArremesso: Lado | null = null;
  private pedirDesvio: number | undefined;
  private miraDefesa: { alvo: Lado; t: number } | null = null; // segurando pra arremessar na casinha
  private alvoJogador: Ponto | null = null; // null = defensor busca a bola sozinho
  private controladoAntes: 0 | 1 | null = null;

  constructor() {
    super('game');
  }

  create() {
    const cfg = this.registry.get('config') as MatchConfig;
    // ?seed= reproduz a 1ª partida; "jogar de novo" avança a seed pra não repetir a mesma
    const partida = (this.registry.get('partidas') as number | undefined) ?? 0;
    this.registry.set('partidas', partida + 1);
    this.rng = createRng(cfg.seed + partida);
    this.faixas = faixasBoas();
    this.estado = inicial(this.rng() < 0.5 ? 0 : 1, { pontos: cfg.pontos, cruzada: cfg.cruzada });
    this.bola = null;
    this.jogada = null;

    const { width: w, height: h } = this.scale;
    this.grama = this.add.rectangle(0, HORIZONTE_Y, w, h, 0x6aa84f).setOrigin(0).setDepth(-1000);
    this.cenario = this.add.graphics().setDepth(-999);
    const lata = () =>
      this.add.rectangle(0, 0, 6, 12, 0xd9d9d9).setOrigin(0.5, 1).setStrokeStyle(2, 0x555555);
    this.casinhas = [lata(), lata()];
    const boneco = (): Boneco => ({
      corpo: this.add.rectangle(0, 0, 10, 10).setOrigin(0.5, 1),
      cabeca: this.add.circle(0, 0, 5),
    });
    this.rebatedores = [boneco(), boneco()];
    this.defensores = [boneco(), boneco()];
    this.tacos = [this.add.graphics(), this.add.graphics()];
    this.sombra = this.add.ellipse(0, 0, 10, 4, 0x000000, 0.35);
    this.bolaObj = this.add.circle(0, 0, 4, 0xffffff).setStrokeStyle(1, 0x333333);
    this.marcas = this.add.graphics().setDepth(-997);
    this.hud = new Hud(this, cfg);
    this.barra = new PowerBar(this, w - 70, h - 160, this.faixas);
    this.botaoCorrer = new BotaoCorrer(this, 170, h - 110, () => (this.pedirCorrer = true));
    const aoRedimensionar = (tamanho: Phaser.Structs.Size) =>
      this.layout(tamanho.width, tamanho.height);
    this.scale.on('resize', aoRedimensionar);
    this.events.once('shutdown', () => this.scale.off('resize', aoRedimensionar));

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.pressionar(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.miraPeloPonteiro(p.x);
      if (p.isDown) this.comandarDefensor(p, false);
    });
    this.input.on('pointerup', () => this.soltar());
    const kb = this.input.keyboard!;
    kb.on('keydown-SPACE', () => this.pressionar(null));
    kb.on('keyup-SPACE', () => this.soltar());
    this.setas = kb.createCursorKeys();

    this.desenharMundo(this.vistaDoArremesso()); // campo já aparece atrás do aviso do sorteio
    this.entrarFase();
  }

  // A projeção já usa a largura atual da tela; aqui só a interface fixa nas bordas
  private layout(w: number, h: number) {
    this.grama.setSize(w, h);
    this.hud.layout(w, h);
    this.barra.posicionar(w - 70, h - 160);
    this.botaoCorrer.posicionar(170, h - 110);
  }

  // ---------- fluxo ----------

  private get voceArremessa() {
    return this.estado.rebatendo === 1;
  }

  private vistaDoArremesso(): Lado {
    return this.voceArremessa ? this.estado.arremessoDe : alvoDoArremesso(this.estado);
  }

  private aplicar(ev: Evento) {
    const antes = this.estado;
    this.estado = step(antes, ev);
    if (this.estado.fase !== antes.fase) this.entrarFase();
    else this.hud.setPlacar(this.estado.placar[0], this.estado.placar[1]);
  }

  private entrarFase() {
    const e = this.estado;
    this.timer?.remove();
    this.hud.setPlacar(e.placar[0], e.placar[1]);
    this.hud.setRebatendo(!this.voceArremessa);
    this.botaoCorrer.mostrar(null);
    switch (e.fase.tipo) {
      case 'arremesso':
        // Câmera atrás de quem arremessa (se é você) ou de quem recebe (se você rebate).
        // Só vira aqui, pra mensagem do resultado ainda mostrar onde a bola foi.
        this.desenharMundo(this.vistaDoArremesso());
        this.hud.mostrar(null);
        this.bola = null;
        this.jogada = null;
        this.swingTaco = [0, 0];
        if (!this.voceArremessa) {
          this.timer = this.time.delayedCall(ESPERA_CPU, () => {
            const { potencia, mira } = escolherArremesso(this.rng, this.faixas);
            this.lancar(potencia, mira);
          });
        }
        break;
      case 'bolaEmJogo':
        this.jogada = iniciarJogada(this.bola!);
        this.alvoJogador = null;
        this.controladoAntes = null;
        this.pedirCorrer = false;
        this.pedirArremesso = null;
        this.miraDefesa = null;
        break;
      case 'resultado':
        this.hud.mostrar(e.fase.mensagem);
        this.timer = this.time.delayedCall(AUTO_CONTINUAR, () =>
          this.aplicar({ tipo: 'continuar' }),
        );
        break;
      case 'fim': {
        // um respiro pra ver a última cruzada antes da tela final
        const dados = { vencedor: e.fase.vencedor, placar: e.placar };
        this.hud.mostrar(e.fase.mensagem);
        this.timer = this.time.delayedCall(1500, () => this.scene.start('fim', dados));
        break;
      }
    }
  }

  private lancar(potencia: number, mira: number) {
    this.bola = lancarArremesso(this.estado.arremessoDe, potencia, mira);
    this.acumulador = 0;
    this.swingou = false;
    this.momentoSwingCpu = escolherMomentoSwing(this.rng);
    this.aplicar({ tipo: 'soltou' });
  }

  // Swing do rebatedor que defende a casinha alvo. Um por arremesso.
  private swing() {
    if (this.swingou || !this.bola) return;
    this.swingou = true;
    const alvo = alvoDoArremesso(this.estado);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: DURACAO_SWING,
      onUpdate: (tw) => (this.swingTaco[alvo] = tw.getValue() ?? 1),
    });
    const r = rebater(this.bola, alvo);
    const quem = this.voceArremessa ? 'CPU: ' : '';
    this.hud.flash(
      quem + (r.acertou ? textoAcerto(r.qualidade) : TEXTO_SWING[r.motivo]),
      r.acertou,
    );
    if (r.acertou) this.aplicar({ tipo: 'rebateu' });
  }

  // ---------- input ----------

  private pressionar(p: Phaser.Input.Pointer | null) {
    const fase = this.estado.fase.tipo;
    if (fase === 'resultado') return this.aplicar({ tipo: 'continuar' });
    if (fase === 'bolaVindo' && !this.voceArremessa) return this.swing();
    if (fase === 'bolaEmJogo') {
      if (!this.voceArremessa) {
        if (!p) this.pedirCorrer = true; // espaço; no toque é o botão CORRER
      } else if (p) {
        this.comandarDefensor(p, true);
      } else if (this.jogada?.comBola != null && !this.miraDefesa) {
        // espaço com a bola: mira na casinha mais próxima
        const alvo = casinhaMaisProxima(this.jogada.defensores[this.jogada.comBola]);
        this.miraDefesa = { alvo, t: 0 };
      }
      return;
    }
    if (fase === 'arremesso' && this.voceArremessa && !this.carregando) {
      if (p) this.miraPeloPonteiro(p.x);
      this.carregando = true;
      this.tCarga = 0;
    }
  }

  private soltar() {
    const j = this.jogada;
    if (this.miraDefesa && j?.comBola != null) {
      const { alvo, t } = this.miraDefesa;
      this.pedirArremesso = alvo;
      this.pedirDesvio = desvioMiraDefesa(t, j.defensores[j.comBola], alvo);
      this.miraDefesa = null;
      return;
    }
    if (!this.carregando) return;
    this.carregando = false;
    this.barra.mostrar(null);
    // vista 1 é o mundo espelhado: direita da tela = z negativo
    this.lancar(forcaNoTempo(this.tCarga), this.vista === 0 ? this.miraTela : -this.miraTela);
  }

  private miraPeloPonteiro(px: number) {
    if (!this.voceArremessa || this.estado.fase.tipo !== 'arremesso') return;
    const alvo = this.p(casinhaX(alvoDoArremesso(this.estado)), 0, 0);
    this.miraTela = Phaser.Math.Clamp((px - alvo.sx) / alvo.escala, -B.miraMax, B.miraMax);
  }

  // Você defendendo: segurar perto de uma casinha com a bola na mão = mira nela (solta pra
  // arremessar); qualquer outro toque/arrasto no campo = leva o defensor controlado até ali.
  private comandarDefensor(p: Phaser.Input.Pointer, toqueNovo: boolean) {
    const j = this.jogada;
    if (!j || !this.voceArremessa || this.estado.fase.tipo !== 'bolaEmJogo') return;
    if (this.miraDefesa) return; // mirando: o dedo está "segurando" a casinha
    if (toqueNovo && j.comBola !== null) {
      for (const lado of [0, 1] as Lado[]) {
        const c = this.p(casinhaX(lado), 0, 0);
        if (Math.hypot(p.x - c.sx, p.y - c.sy) < TOQUE_CASINHA) {
          this.miraDefesa = { alvo: lado, t: 0 };
          return;
        }
      }
    }
    const ponto = desprojetarChao(this.vista, this.scale.width, p.x, p.y, this.cam);
    if (ponto) {
      this.alvoJogador = {
        x: Phaser.Math.Clamp(ponto.x, -10, B.distanciaCasinhas + 10),
        z: Phaser.Math.Clamp(ponto.z, -12, 12),
      };
    }
  }

  // ---------- loop ----------

  update(_: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.1);
    const e = this.estado;

    if (this.carregando) {
      this.tCarga += dt;
      this.barra.mostrar(forcaNoTempo(this.tCarga));
    }
    if (this.miraDefesa) {
      // perdeu a bola ou a jogada acabou no meio da mira: cancela
      if (e.fase.tipo !== 'bolaEmJogo' || this.jogada?.comBola == null) this.miraDefesa = null;
      else this.miraDefesa.t += dt;
    }
    const dirX = (this.setas.right.isDown ? 1 : 0) - (this.setas.left.isDown ? 1 : 0);
    const dirY = (this.setas.up.isDown ? 1 : 0) - (this.setas.down.isDown ? 1 : 0);
    if (this.voceArremessa && e.fase.tipo === 'arremesso') {
      this.miraTela = Phaser.Math.Clamp(
        this.miraTela + dirX * B.velocidadeMiraTeclado * dt,
        -B.miraMax,
        B.miraMax,
      );
    }
    if (this.voceArremessa && this.jogada && (dirX || dirY)) {
      // setas relativas à tela: ↑ = pra longe da câmera
      const d = this.jogada.defensores[defensorDaBola(this.jogada)];
      const s = this.vista === 0 ? 1 : -1;
      this.alvoJogador = { x: d.x + dirY * 2 * s, z: d.z + dirX * 2 * s };
    }

    // física em passo fixo
    if (this.bola) {
      this.acumulador += dt;
      while (this.acumulador >= B.passoFixo && this.passoFisica(this.bola));
    }

    this.moverCamera(dt);
    this.atualizarUi();
    this.desenharCenario();
    this.desenharJogadores();
    this.desenharBola();
    this.desenharMarcas();
  }

  // Um passo fixo conforme a fase. Retorna false quando a fase mudou (para o loop).
  private passoFisica(bola: Bola): boolean {
    this.acumulador -= B.passoFixo;
    const e = this.estado;
    const alvo = alvoDoArremesso(e);

    if (e.fase.tipo === 'bolaVindo') {
      if (
        this.voceArremessa &&
        !this.swingou &&
        tempoAteContato(bola, alvo) <= this.momentoSwingCpu
      ) {
        this.swing();
        if (this.estado !== e) return false; // rebateu: o próximo frame já é bolaEmJogo
      }
      const fim = avancarArremesso(bola, alvo, B.passoFixo);
      if (!fim) return true;
      if (fim === 'derrubou') this.derrubarCasinha(alvo);
      this.aplicar({ tipo: fim });
      return false;
    }

    if (e.fase.tipo === 'bolaEmJogo' && this.jogada) {
      const ev = avancarJogada(this.jogada, B.passoFixo, this.entradaJogada(this.jogada), this.rng);
      if (!ev) return true;
      if (ev === 'queimou') this.derrubarCasinha(casinhaMaisProxima({ x: bola.pos.x, z: 0 }));
      if (ev === 'cruzou') {
        this.hud.flash(
          `${this.voceArremessa ? 'CPU ' : ''}+${e.regras.cruzada}`,
          !this.voceArremessa,
        );
      }
      this.aplicar({ tipo: ev });
      return this.estado.fase === e.fase;
    }
    return false;
  }

  private entradaJogada(j: Jogada): Entrada {
    if (this.voceArremessa) {
      // você defende, a CPU corre
      const ctrl = defensorDaBola(j);
      if (ctrl !== this.controladoAntes) this.alvoJogador = null; // trocou o controlado
      this.controladoAntes = ctrl;
      const sozinho = j.comBola === null ? { x: j.bola.pos.x, z: j.bola.pos.z } : null;
      const entrada = {
        alvo: this.alvoJogador ?? sozinho,
        arremessarEm: this.pedirArremesso,
        desvio: this.pedirDesvio,
        correr: cpuQuerCorrer(
          j,
          this.estado.placar[1] + this.estado.regras.cruzada >= this.estado.regras.pontos,
        ),
      };
      this.pedirArremesso = null;
      this.pedirDesvio = undefined;
      return entrada;
    }
    const entrada = { ...cpuDefesa(j), correr: this.pedirCorrer };
    this.pedirCorrer = false;
    return entrada;
  }

  // ---------- ui ----------

  private atualizarUi() {
    const e = this.estado;
    const j = this.jogada;
    let dica = '';
    switch (e.fase.tipo) {
      case 'arremesso':
        dica = this.voceArremessa
          ? 'Segure e solte pra arremessar · mire com o mouse/dedo ou ← →'
          : 'Clique, toque ou espaço quando a bola chegar pra rebater';
        break;
      case 'bolaVindo':
        dica = this.voceArremessa ? '' : 'Agora! Clique, toque ou espaço';
        break;
      case 'bolaEmJogo':
        if (!j) break;
        if (!this.voceArremessa) {
          const pode = !j.correndo && j.janela > 0;
          this.botaoCorrer.mostrar(pode ? j.janela / B.tempoCorrerDeNovo : null);
          dica = j.correndo
            ? 'Correndo!'
            : pode
              ? `CORRER (ou espaço) cruza e vale ${e.regras.cruzada} · arriscar ou ficar no círculo?`
              : 'Seguros no círculo';
        } else {
          dica =
            j.comBola !== null
              ? this.miraDefesa
                ? 'Solte quando a mira amarela passar pela lata!'
                : 'Segure numa casinha (ou espaço) e solte com a mira na lata: queima quem está fora do círculo'
              : 'Toque/arraste no campo pra mover o defensor amarelo (ele busca a bola sozinho) · ou setas';
        }
        break;
      case 'resultado':
        dica = 'Toque ou espaço pra continuar';
        break;
      case 'fim':
        dica = '';
        break;
    }
    this.hud.dica(dica);
  }

  // ---------- desenho ----------

  private p(x: number, y: number, z: number): Projetado {
    return projetar(this.vista, this.scale.width, x, y, z, this.cam);
  }

  private desenharJogadores() {
    const j = this.jogada;
    const emJogo = j !== null;
    const controlado = j && this.voceArremessa ? defensorDaBola(j) : null;
    for (const i of [0, 1] as const) {
      // rebatedor i começa (na jogada) na casinha j.partida[i]; fora da jogada, na casinha i
      const pos = j ? posCorredor(j, i) : rebatedorPos(i);
      const ladoCasinha: Lado = j ? j.partida[i] : i;
      this.posicionarBoneco(this.rebatedores[i], pos, COR_TIME[this.estado.rebatendo], emJogo);
      this.desenharTaco(i, pos, ladoCasinha, j?.correndo ? -1 : this.swingTaco[i]);
      const def = j ? j.defensores[i] : arremessadorPos(i);
      const corDef = COR_TIME[this.estado.rebatendo === 0 ? 1 : 0];
      this.posicionarBoneco(this.defensores[i], def, corDef, controlado === i);
    }
  }

  // Perto da câmera fica escondido (taparia o campo); só quem precisa ser visto aparece
  // translúcido: corredores e o defensor que você controla.
  private posicionarBoneco(b: Boneco, pos: Ponto, cor: number, mostrarPerto: boolean) {
    const s = this.p(pos.x, 0, pos.z);
    const visivel = s.profundidade > (mostrarPerto ? 1.5 : PROFUNDIDADE_VISIVEL);
    const alpha = s.profundidade < PROFUNDIDADE_VISIVEL ? 0.4 : 1;
    const larg = 0.45 * s.escala;
    b.corpo
      .setPosition(s.sx, s.sy)
      .setSize(larg, ALTURA_JOGADOR * s.escala)
      .setFillStyle(cor, alpha)
      .setDepth(-s.profundidade)
      .setVisible(visivel);
    b.cabeca
      .setPosition(s.sx, s.sy - ALTURA_JOGADOR * s.escala - larg * 0.4)
      .setRadius(larg * 0.45)
      .setFillStyle(cor, alpha)
      .setDepth(-s.profundidade)
      .setVisible(visivel);
  }

  // swing ∈ [0,1]: 0 = ponta no chão perto da casinha; o taco varre baixo, de lado pra frente
  // (na direção do arremessador), e termina apontando pro campo, como uma tacada de críquete.
  // swing = -1: correndo, taco carregado na frente.
  private desenharTaco(i: 0 | 1, pos: Ponto, ladoCasinha: Lado, swing: number) {
    const g = this.tacos[i].clear();
    const mao = this.p(pos.x, 1.0, pos.z);
    if (mao.profundidade < PROFUNDIDADE_VISIVEL && !this.jogada) return;
    const comprimento = 1.1;
    const praFrente = ladoCasinha === 0 ? 1 : -1; // da casinha pro meio do campo
    let ponta: Projetado;
    if (swing < 0) {
      ponta = this.p(pos.x + praFrente * comprimento * 0.9, 0.5, pos.z);
    } else {
      const praCasinha = -Math.sign(pos.z) || 1; // lateral, do rebatedor pra casinha
      const giro = (swing * 100 * Math.PI) / 180; // 0° = de lado, 100° = pra frente
      ponta = this.p(
        pos.x + praFrente * Math.sin(giro) * comprimento * 0.9,
        0.05 + swing * 0.5,
        pos.z + praCasinha * Math.cos(giro) * comprimento * 0.6,
      );
    }
    g.setDepth(-mao.profundidade + 0.02)
      .lineStyle(Math.max(0.06 * mao.escala, 2), 0x8b5a2b)
      .lineBetween(mao.sx, mao.sy, ponta.sx, ponta.sy);
  }

  private desenharBola() {
    let pos = this.bola?.pos;
    if (!pos) {
      // na mão do arremessador
      const a = arremessadorPos(this.estado.arremessoDe);
      pos = { x: a.x, y: B.alturaSoltura, z: a.z + 0.3 };
    }
    const s = this.p(pos.x, pos.y, pos.z);
    const ch = this.p(pos.x, 0, pos.z);
    const r = Math.max(B.raioBola * s.escala, 4);
    const naFrente = s.profundidade > 1; // bola atrás da câmera não é desenhada
    this.bolaObj
      .setPosition(s.sx, s.sy)
      .setRadius(r)
      .setDepth(-s.profundidade + 0.05)
      .setVisible(naFrente);
    this.sombra
      .setPosition(ch.sx, ch.sy)
      .setSize(r * 2.4, r * 0.9)
      .setDepth(-ch.profundidade + 0.04)
      .setVisible(naFrente && this.bola !== null);
  }

  // Tomba pro lado (na tela) em que a bola estava desviando
  private derrubarCasinha(lado: Lado) {
    const lata = this.casinhas[lado];
    const sentido = (this.bola?.vel.z ?? 0) * (this.vista === 0 ? 1 : -1) >= 0 ? 1 : -1;
    this.tweens.add({ targets: lata, angle: 85 * sentido, duration: 250, ease: 'Quad.easeIn' });
    this.cameras.main.shake(150, 0.004);
  }

  private anelNoChao(cx: number, cz: number, raio: number, cor: number) {
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 20; i++) {
      const t = (i / 20) * Math.PI * 2;
      const s = this.p(cx + Math.cos(t) * raio, 0, cz + Math.sin(t) * raio);
      pts.push(new Phaser.Math.Vector2(s.sx, s.sy));
    }
    this.marcas.lineStyle(3, cor).strokePoints(pts, true);
  }

  private desenharMarcas() {
    this.marcas.clear();
    const fase = this.estado.fase.tipo;
    if (!this.voceArremessa) return;
    if (fase === 'arremesso') {
      const z = this.vista === 0 ? this.miraTela : -this.miraTela;
      this.anelNoChao(casinhaX(alvoDoArremesso(this.estado)), z, 0.35, 0xffeb3b);
    }
    const j = this.jogada;
    if (fase === 'bolaEmJogo' && j) {
      const d = j.defensores[defensorDaBola(j)];
      this.anelNoChao(d.x, d.z, 0.5, 0xffeb3b);
      if (this.alvoJogador) this.anelNoChao(this.alvoJogador.x, this.alvoJogador.z, 0.2, 0xffffff);
      if (j.comBola !== null) {
        const m = this.miraDefesa;
        if (m) {
          const desvio = desvioMiraDefesa(m.t, j.defensores[j.comBola], m.alvo);
          this.anelNoChao(casinhaX(m.alvo), 0, 0.4, 0xff5252);
          this.anelNoChao(casinhaX(m.alvo), desvio, 0.12, 0xffeb3b);
        } else {
          for (const lado of [0, 1] as Lado[]) this.anelNoChao(casinhaX(lado), 0, 0.4, 0xff5252);
        }
      }
    }
  }

  // Troca de vista (novo arremesso): câmera volta pro lugar e as latas ficam de pé.
  private desenharMundo(vista: Lado) {
    this.vista = vista;
    this.cam = { ...CAMERA_PARADA };
    for (const lata of this.casinhas) lata.setAngle(0);
  }

  // Depois da rebatida a câmera anda atrás da bola, mantendo-a uns metros à frente.
  // Fora da bola em jogo ela fica onde está (o resultado mostra onde a bola parou).
  private moverCamera(dt: number) {
    if (this.estado.fase.tipo !== 'bolaEmJogo' || !this.bola) return;
    const { xl, zl } = paraVista(this.vista, this.bola.pos.x, this.bola.pos.z);
    const alvo = {
      avanco: Phaser.Math.Clamp(xl - CAM_DISTANCIA_BOLA, -8, B.distanciaCasinhas),
      lateral: zl * CAM_LATERAL,
    };
    const k = 1 - Math.exp(-CAM_SUAVIDADE * dt);
    this.cam.avanco += (alvo.avanco - this.cam.avanco) * k;
    this.cam.lateral += (alvo.lateral - this.cam.lateral) * k;
  }

  // Chão, círculos e latas, redesenhados todo frame porque a câmera pode andar
  private desenharCenario() {
    // rua do pé da câmera até bem longe, montada no referencial da vista pra nunca ficar atrás dela
    const perto = this.cam.avanco - 5.4;
    const deVista = (xl: number, zl: number): [number, number] =>
      this.vista === 0 ? [xl, zl] : [B.distanciaCasinhas - xl, -zl];
    const g = this.cenario.clear();
    this.poligonoChao(
      g,
      [
        deVista(perto, -MEIA_RUA),
        deVista(perto, MEIA_RUA),
        deVista(perto + 80, MEIA_RUA),
        deVista(perto + 80, -MEIA_RUA),
      ],
      0xc49a6c,
      false,
    );
    for (const lado of [0, 1] as Lado[]) {
      const cx = casinhaX(lado);
      if (this.p(cx, 0, 0).profundidade < 2) {
        this.casinhas[lado].setVisible(false); // ficou atrás da câmera
        continue;
      }
      const pontos: [number, number][] = [];
      for (let i = 0; i < 32; i++) {
        const t = (i / 32) * Math.PI * 2;
        pontos.push([cx + Math.cos(t) * B.raioCirculo, Math.sin(t) * B.raioCirculo]);
      }
      this.poligonoChao(g, pontos, 0xffffff, true);

      // latinha com tamanho mínimo na tela pra ser legível no celular
      const s = this.p(cx, 0, 0);
      this.casinhas[lado]
        .setPosition(s.sx, s.sy)
        .setSize(Math.max(B.larguraCasinha * s.escala, 6), Math.max(B.alturaCasinha * s.escala, 12))
        .setDepth(-s.profundidade)
        .setVisible(true);
    }
  }

  // Polígono no chão (y=0) a partir de pontos [x, z]
  private poligonoChao(
    g: Phaser.GameObjects.Graphics,
    pontos: [number, number][],
    cor: number,
    contorno: boolean,
  ) {
    const pts = pontos.map(([x, z]) => {
      const s = this.p(x, 0, z);
      return new Phaser.Math.Vector2(s.sx, s.sy);
    });
    if (contorno) g.lineStyle(3, cor, 0.9).strokePoints(pts, true);
    else g.fillStyle(cor).fillPoints(pts, true);
  }
}
