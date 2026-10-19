import Phaser from 'phaser';

const ALTURA = 360;
const LARGURA = 36;

// Barra vertical: 0 embaixo, 1 em cima. Faixas verdes = forças que derrubam mirando no centro.
export class PowerBar {
  private container: Phaser.GameObjects.Container;
  private marcador: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, x: number, y: number, faixas: [number, number][]) {
    const fundo = scene.add.rectangle(0, 0, LARGURA, ALTURA, 0x000000, 0.5).setOrigin(0.5, 1);
    fundo.setStrokeStyle(3, 0xffffff, 0.8);
    const zonas = faixas.map(([ini, fim]) =>
      scene.add
        .rectangle(0, -ini * ALTURA, LARGURA - 6, (fim - ini) * ALTURA, 0x5cd65c, 0.7)
        .setOrigin(0.5, 1),
    );
    this.marcador = scene.add.rectangle(0, 0, LARGURA + 16, 6, 0xffffff);
    const rotulo = scene.add
      .text(0, 16, 'FORÇA', { fontSize: '20px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5, 0);
    this.container = scene.add
      .container(x, y, [fundo, ...zonas, this.marcador, rotulo])
      .setDepth(10)
      .setVisible(false);
  }

  posicionar(x: number, y: number) {
    this.container.setPosition(x, y);
  }

  mostrar(valor: number | null) {
    this.container.setVisible(valor !== null);
    if (valor !== null) this.marcador.setY(-valor * ALTURA);
  }
}
