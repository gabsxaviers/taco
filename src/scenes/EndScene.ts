import Phaser from 'phaser';
import type { MatchConfig } from '../config';
import type { Time } from '../rules/match';

interface Dados {
  vencedor: Time;
  placar: [number, number];
}

export class EndScene extends Phaser.Scene {
  constructor() {
    super('fim');
  }

  create({ vencedor, placar }: Dados) {
    const cfg = this.registry.get('config') as MatchConfig;
    const { width: w, height: h } = this.scale;
    // tela sem estado: no resize (tela cheia, girar o celular) só recria com os mesmos dados
    const recriar = () => this.scene.restart({ vencedor, placar });
    this.scale.once('resize', recriar);
    this.events.once('shutdown', () => this.scale.off('resize', recriar));
    const venceu = vencedor === 0;

    this.add.rectangle(0, 0, w, h, venceu ? 0x1f4d2b : 0x4d1f1f).setOrigin(0);
    this.add
      .text(w / 2, h * 0.24, venceu ? 'VOCÊ VENCEU!' : 'A CPU VENCEU', {
        fontSize: '88px',
        fontStyle: 'bold',
        color: '#f4d35e',
      })
      .setOrigin(0.5);
    this.add
      .text(w / 2, h * 0.42, `Você ${placar[0]} × ${placar[1]} CPU`, {
        fontSize: '48px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.add
      .text(w / 2, h * 0.52, `Até ${cfg.pontos} pontos · ${cfg.cruzada} por cruzada`, {
        fontSize: '28px',
        color: '#ffffffaa',
      })
      .setOrigin(0.5);

    this.botao(w / 2 - 190, h * 0.72, 'JOGAR DE NOVO', 0xf4d35e, '#1b2a1b', () =>
      this.scene.start('game'),
    );
    this.botao(w / 2 + 190, h * 0.72, 'MENU', 0xffffff, '#1b2a1b', () => this.scene.start('menu'));
    this.add
      .text(w / 2, h * 0.88, 'Espaço = jogar de novo', { fontSize: '24px', color: '#ffffff88' })
      .setOrigin(0.5);
    this.input.keyboard!.once('keydown-SPACE', () => this.scene.start('game'));
  }

  private botao(
    x: number,
    y: number,
    texto: string,
    cor: number,
    corTexto: string,
    acao: () => void,
  ) {
    this.add
      .rectangle(x, y, 340, 100, cor)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', acao);
    this.add
      .text(x, y, texto, { fontSize: '36px', fontStyle: 'bold', color: corTexto })
      .setOrigin(0.5);
  }
}
