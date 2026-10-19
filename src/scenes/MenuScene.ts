import Phaser from 'phaser';
import type { MatchConfig } from '../config';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
  }

  create() {
    const cfg = this.registry.get('config') as MatchConfig;
    const { width: w, height: h } = this.scale;
    // tela sem estado: no resize (tela cheia, girar o celular) só recria
    const recriar = () => this.scene.restart();
    this.scale.once('resize', recriar);
    this.events.once('shutdown', () => this.scale.off('resize', recriar));

    this.add.rectangle(0, 0, w, h, 0x1b2a1b).setOrigin(0);
    this.add
      .text(w / 2, h * 0.28, 'TACO', { fontSize: '120px', fontStyle: 'bold', color: '#f4d35e' })
      .setOrigin(0.5);
    this.add
      .text(w / 2, h * 0.45, `Até ${cfg.pontos} pontos · ${cfg.cruzada} por cruzada`, {
        fontSize: '32px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const btn = this.add
      .rectangle(w / 2, h * 0.65, 320, 100, 0xf4d35e)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(btn.x, btn.y, 'JOGAR', { fontSize: '44px', fontStyle: 'bold', color: '#1b2a1b' })
      .setOrigin(0.5);

    btn.on('pointerup', () => {
      // Celular: tela cheia + paisagem. Desktop ignora silenciosamente.
      if (this.sys.game.device.input.touch && !this.scale.isFullscreen) {
        this.scale.startFullscreen();
        (screen.orientation as { lock?: (o: string) => Promise<void> })
          .lock?.('landscape')
          .catch(() => {});
      }
      this.scene.start('game');
    });
  }
}
