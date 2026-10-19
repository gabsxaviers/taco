import Phaser from 'phaser';

// Botão grande "CORRER" com barra do tempo que resta pra decidir.
export class BotaoCorrer {
  private container: Phaser.GameObjects.Container;
  private barra: Phaser.GameObjects.Rectangle;
  private static LARGURA = 260;

  constructor(scene: Phaser.Scene, x: number, y: number, aoApertar: () => void) {
    const w = BotaoCorrer.LARGURA;
    const fundo = scene.add.rectangle(0, 0, w, 110, 0x2fbf71).setStrokeStyle(5, 0xffffff);
    const texto = scene.add
      .text(0, -8, 'CORRER', { fontSize: '48px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5);
    this.barra = scene.add.rectangle(-w / 2 + 10, 38, w - 20, 10, 0xffffff).setOrigin(0, 0.5);
    this.container = scene.add.container(x, y, [fundo, texto, this.barra]).setDepth(30);
    fundo.setInteractive({ useHandCursor: true }).on('pointerdown', aoApertar);
    this.container.setVisible(false);
  }

  posicionar(x: number, y: number) {
    this.container.setPosition(x, y);
  }

  // fracao = tempo restante / tempo total; null esconde
  mostrar(fracao: number | null) {
    this.container.setVisible(fracao !== null);
    if (fracao !== null) this.barra.width = (BotaoCorrer.LARGURA - 20) * fracao;
  }
}
