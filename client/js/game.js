// Game Renderer for Ball Race
class GameRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");
    this.gameData = null;
    this.obstacles = [];
    this.balls = [];
    this.animationId = null;
    this.winner = null;

    // Camera settings
    this.camera = {
      x: 0,
      y: 0,
      scale: 1,
    };

    // Colors
    this.colors = {
      background: "#0f172a",
      platform: "#3b82f6",
      moving: "#dc2626",
      finish: "#10b981",
      ball: "#fbbf24",
    };

    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
  }

  resizeCanvas() {
    const container = this.canvas.parentElement;
    const maxWidth = Math.min(container.clientWidth - 40, 500);
    this.canvas.width = maxWidth;
    this.canvas.height = Math.floor(maxWidth * 1.5); // 3:2 aspect ratio

    // Update camera scale based on canvas size
    this.camera.scale = this.canvas.width / 800; // 800 is world width
  }

  initGame(gameData) {
    this.gameData = gameData;
    this.obstacles = gameData.obstacles || [];
    this.balls = [];
    this.winner = null;

    // Start rendering loop
    this.startRenderLoop();
  }

  updateGame(gameData) {
    this.balls = gameData.balls || [];
    this.obstacles = gameData.obstacles || [];
    this.winner = gameData.winner || null;
  }

  startRenderLoop() {
    const render = () => {
      this.clearCanvas();
      this.drawBackground();
      this.drawObstacles();
      this.drawBalls();
      this.drawUI();

      this.animationId = requestAnimationFrame(render);
    };

    render();
  }

  clearCanvas() {
    this.ctx.fillStyle = this.colors.background;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawBackground() {
    // Draw gradient background
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, "#1e293b");
    gradient.addColorStop(1, "#0f172a");
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw grid pattern
    this.ctx.strokeStyle = "rgba(59, 130, 246, 0.1)";
    this.ctx.lineWidth = 1;

    const gridSize = 50 * this.camera.scale;
    for (let x = 0; x < this.canvas.width; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }

    for (let y = 0; y < this.canvas.height; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
  }

  drawObstacles() {
    this.obstacles.forEach((obstacle) => {
      const x = obstacle.x * this.camera.scale;
      const y = obstacle.y * this.camera.scale;
      const width = obstacle.width * this.camera.scale;
      const height = obstacle.height * this.camera.scale;

      if (obstacle.type === "finish") {
        // Draw finish line with pattern
        this.ctx.fillStyle = this.colors.finish;
        this.ctx.fillRect(x, y, width, height);

        // Add checkered pattern
        this.ctx.fillStyle = "#ffffff";
        for (let i = 0; i < width; i += 20) {
          if (Math.floor(i / 20) % 2 === 0) {
            this.ctx.fillRect(x + i, y, 20, height);
          }
        }

        // Finish line text
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = `bold ${Math.max(12, 16 * this.camera.scale)}px Inter`;
        this.ctx.textAlign = "center";
        this.ctx.fillText("🏁 FINISH", this.canvas.width / 2, y - 10);
      } else if (obstacle.type === "moving") {
        // Draw moving obstacle with glow
        this.ctx.shadowColor = this.colors.moving;
        this.ctx.shadowBlur = 10;
        this.ctx.fillStyle = this.colors.moving;
        this.ctx.fillRect(x, y, width, height);
        this.ctx.shadowBlur = 0;
      } else {
        // Draw regular platform
        this.ctx.fillStyle = this.colors.platform;
        this.ctx.fillRect(x, y, width, height);

        // Add highlight
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        this.ctx.fillRect(x, y, width, 3);
      }
    });
  }

  drawBalls() {
    // Sort balls by Y position for proper layering
    const sortedBalls = [...this.balls].sort(
      (a, b) => (a.position?.y || a.y || 0) - (b.position?.y || b.y || 0)
    );

    sortedBalls.forEach((ball) => {
      const x = (ball.position?.x || ball.x || 0) * this.camera.scale;
      const y = (ball.position?.y || ball.y || 0) * this.camera.scale;
      const radius = 12 * this.camera.scale;

      // Draw ball shadow
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      this.ctx.beginPath();
      this.ctx.ellipse(x + 2, y + 2, radius, radius * 0.5, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Draw ball
      this.ctx.fillStyle = ball.color || this.colors.ball;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.fill();

      // Add highlight
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      this.ctx.beginPath();
      this.ctx.arc(
        x - radius * 0.3,
        y - radius * 0.3,
        radius * 0.3,
        0,
        Math.PI * 2
      );
      this.ctx.fill();

      // Player name (small text)
      if (ball.playerName || ball.username) {
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = `${Math.max(10, 12 * this.camera.scale)}px Inter`;
        this.ctx.textAlign = "center";
        this.ctx.strokeStyle = "#000000";
        this.ctx.lineWidth = 2;
        this.ctx.strokeText(
          ball.playerName || ball.username,
          x,
          y - radius - 8
        );
        this.ctx.fillText(ball.playerName || ball.username, x, y - radius - 8);
      }

      // Draw winner indicator
      if (this.winner && ball.id === this.winner.ballId) {
        this.ctx.strokeStyle = "#fbbf24";
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
        this.ctx.stroke();

        // Winner crown
        this.ctx.fillStyle = "#fbbf24";
        this.ctx.font = `${Math.max(16, 20 * this.camera.scale)}px Inter`;
        this.ctx.textAlign = "center";
        this.ctx.fillText("👑", x, y - radius - 25);
      }
    });
  }

  drawUI() {
    // Draw winner text
    if (this.winner) {
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      this.ctx.fillRect(0, 20, this.canvas.width, 80);

      this.ctx.fillStyle = "#fbbf24";
      this.ctx.font = "bold 28px Inter";
      this.ctx.textAlign = "center";
      this.ctx.fillText(
        `🏆 Winner: ${this.winner.playerName}`,
        this.canvas.width / 2,
        60
      );

      this.ctx.fillStyle = "#ffffff";
      this.ctx.font = "16px Inter";
      this.ctx.fillText("Game finished!", this.canvas.width / 2, 85);
    }

    // Draw player stats
    const playerStats = this.getBallCountByPlayer();
    if (playerStats.length > 0) {
      this.ctx.fillStyle = "rgba(59, 130, 246, 0.9)";
      this.ctx.fillRect(
        10,
        this.canvas.height - (playerStats.length * 25 + 20),
        180,
        playerStats.length * 25 + 15
      );

      this.ctx.fillStyle = "#ffffff";
      this.ctx.font = "14px Inter";
      this.ctx.textAlign = "left";

      playerStats.forEach((player, index) => {
        this.ctx.fillText(
          `${player.username}: ${player.count} 🎱`,
          15,
          this.canvas.height - (playerStats.length - index) * 25
        );
      });
    }
  }

  getBallCountByPlayer() {
    const playerCounts = {};

    this.balls.forEach((ball) => {
      const name = ball.playerName || ball.username;
      if (!playerCounts[name]) {
        playerCounts[name] = 0;
      }
      playerCounts[name]++;
    });

    return Object.entries(playerCounts)
      .map(([username, count]) => ({ username, count }))
      .sort((a, b) => b.count - a.count);
  }

  stopRenderLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  destroy() {
    this.stopRenderLoop();
  }
}

// Make GameRenderer available globally
window.GameRenderer = GameRenderer;
