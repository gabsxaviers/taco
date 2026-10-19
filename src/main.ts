import Phaser from 'phaser';
import { parseConfig } from './config';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { EndScene } from './scenes/EndScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#8fc7e8',
  // EXPAND: 1280×720 é o tamanho mínimo; telas mais compridas (celular) ganham campo extra
  // em vez de faixas pretas. As cenas se reposicionam no evento 'resize'.
  scale: { mode: Phaser.Scale.EXPAND, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [MenuScene, GameScene, EndScene],
});

game.registry.set('config', parseConfig(location.search));
