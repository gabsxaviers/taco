# Taco 🏏

Protótipo jogável de **taco** (também chamado de **bets**), o jogo de rua brasileiro, rodando no navegador. Você joga contra a CPU.

O objetivo do protótipo é validar se o jogo é divertido, por isso tudo é desenhado com formas geométricas simples.

## Como rodar

Precisa do [Node.js](https://nodejs.org) 20 ou mais novo.

```bash
npm install
npm run dev
```

Abra o endereço **Local** que aparecer no terminal. Para jogar no celular, conectado ao mesmo Wi-Fi, use o endereço **Network** e deite o celular na horizontal.

## Regras

- Duas duplas: uma rebate e a outra arremessa. Em cada ponta do campo fica uma casinha (latinha).
- O arremessador tenta derrubar a casinha do outro lado. Se derrubar, as duplas trocam de papel.
- Depois de rebater, os rebatedores podem correr e trocar de lado. Cada **cruzada** vale pontos.
- Se o defensor derrubar uma casinha com o rebatedor fora do círculo, o rebatedor está **queimado** e as duplas trocam.
- Se a bola rebatida for pega no ar, as duplas também trocam.
- Vence quem chegar primeiro à pontuação alvo.

## Controles

Funciona com mouse, toque e teclado.

| Momento    | Como                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------- |
| Arremessar | Segure e solte quando a barra de força estiver na zona verde. Mire com o mouse, o dedo ou ← → |
| Rebater    | Clique, toque ou aperte espaço quando a bola chegar                                           |
| Correr     | Botão **CORRER** ou espaço, depois de cada cruzada                                            |
| Defender   | Toque ou arraste no campo para mover o defensor amarelo                                       |
| Queimar    | Com a bola na mão, segure numa casinha e solte quando a mira passar pela lata                 |

## Configurar a partida pela URL

| Parâmetro | Padrão    | Exemplo                                            |
| --------- | --------- | -------------------------------------------------- |
| `pontos`  | 24        | `?pontos=12` é a pontuação alvo                    |
| `cruzada` | 2         | `?cruzada=1` são os pontos por cruzada             |
| `seed`    | aleatória | `?seed=42` faz a CPU repetir o mesmo comportamento |

Exemplo: `http://localhost:5173/?pontos=12&cruzada=1`

## Scripts

| Comando          | O que faz                    |
| ---------------- | ---------------------------- |
| `npm run dev`    | Servidor de desenvolvimento  |
| `npm test`       | Testes da lógica (Vitest)    |
| `npm run lint`   | ESLint                       |
| `npm run format` | Prettier                     |
| `npm run build`  | Build de produção em `dist/` |

## Estrutura

```
src/
├─ config.ts        leitura dos parâmetros da URL
├─ rules/           lógica do jogo em TypeScript puro, sem Phaser, com testes
│  ├─ balance.ts    constantes de jogabilidade (ajuste aqui)
│  ├─ match.ts      máquina de estados e placar
│  ├─ physics.ts    arremesso, quique e rebatida
│  ├─ jogada.ts     corrida, defesa, pegada e queimada
│  └─ cpu.ts        decisões da CPU
├─ scenes/          menu, jogo e tela de fim (Phaser)
└─ ui/              câmera em perspectiva, HUD, barra de força e botão CORRER
```

## Stack

Phaser 3, TypeScript, Vite, Vitest, ESLint e Prettier.
