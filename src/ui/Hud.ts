import Phaser from 'phaser';
import type { MatchConfig } from '../config';

const FONT = { fontSize: '30px', color: '#ffffff', fontStyle: 'bold' } as const;

export class Hud {
  private barraTopo: Phaser.GameObjects.Rectangle;
  private placar: Phaser.GameObjects.Text;
  private rebatendo: Phaser.GameObjects.Text;
  private mensagem: Phaser.GameObjects.Text;
  private dicaTexto: Phaser.GameObjects.Text;

  constructor(
    private scene: Phaser.Scene,
    private cfg: MatchConfig,
  ) {
    this.barraTopo = scene.add.rectangle(0, 0, 1, 64, 0x000000, 0.45).setOrigin(0).setDepth(20);
    this.placar = scene.add.text(24, 14, '', FONT).setDepth(20);
    this.rebatendo = scene.add.text(0, 14, '', FONT).setOrigin(1, 0).setDepth(20);
    this.mensagem = scene.add
      .text(0, 330, '', {
        ...FONT,
        fontSize: '38px',
        backgroundColor: '#000000bb',
        align: 'center',
      })
      .setOrigin(0.5)
      .setPadding(24, 12, 24, 12)
      .setDepth(20)
      .setVisible(false);
    this.dicaTexto = scene.add
      .text(0, 0, '', {
        ...FONT,
        fontSize: '28px', // ~15px num celular em paisagem
        backgroundColor: '#00000088',
        align: 'center',
      })
      .setOrigin(0.5, 1)
      .setPadding(12, 6, 12, 6)
      .setDepth(20);
    this.layout(scene.scale.width, scene.scale.height);
  }

  // Chamado na criação e quando a tela muda de tamanho (tela cheia, girar o celular)
  layout(w: number, h: number) {
    this.barraTopo.width = w;
    this.rebatendo.setX(w - 24);
    // y=330: faixa vazia do meio do campo, longe das duas casinhas
    this.mensagem.setX(w / 2).setWordWrapWidth(Math.min(w - 200, 1100));
    this.dicaTexto.setPosition(w / 2, h - 20).setWordWrapWidth(Math.min(w - 120, 1200));
  }

  setPlacar(voce: number, cpu: number) {
    this.placar.setText(`Você ${voce} × ${cpu} CPU   ·   alvo ${this.cfg.pontos}`);
  }

  setRebatendo(voce: boolean) {
    this.rebatendo
      .setText(voce ? 'Você REBATE' : 'Você ARREMESSA')
      .setColor(voce ? '#7cc4ff' : '#ff8a80');
  }

  // Texto rápido que sobe e some (feedback do swing)
  flash(texto: string, bom: boolean) {
    const t = this.scene.add
      .text(this.scene.scale.width / 2, 220, texto, {
        ...FONT,
        fontSize: '44px',
        color: bom ? '#9cff8a' : '#ffd166',
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(21);
    this.scene.tweens.add({ targets: t, y: 170, alpha: 0, delay: 500, duration: 600 });
    this.scene.time.delayedCall(1200, () => t.destroy());
  }

  dica(texto: string) {
    if (texto === this.dicaTexto.text) return; // chamada todo frame: não redesenha à toa
    this.dicaTexto.setText(texto).setVisible(texto !== '');
  }

  mostrar(texto: string | null) {
    this.mensagem.setText(texto ?? '').setVisible(texto !== null);
  }
}
