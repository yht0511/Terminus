import { Game } from "./game/Game";
// 创建并启动游戏
const game = new Game();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    game.initialize();
  });
} else {
  game.initialize();
}

(window as any).game = game;
