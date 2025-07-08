// Game Renderer for Ball Race
class GameRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");
    this.gameData = null;
    this.obstacles = [];
    this.balls = [];
    this.animationId = null;

    // Camera settings
    this.camera = {
      x: 0,
      y: 0,
      scale: 1,
    };

    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
  }

  resizeCanvas() {
    const container = this.canvas.parentElement;
    const maxWidth = Math.min(container.clientWidth - 40, 400);
    this.canvas.width = maxWidth;
    this.canvas.height = Math.floor(maxWidth * 1.5); // 3:2 aspect ratio

    // Update camera scale based on canvas size
    this.camera.scale = this.canvas.width / 800; // 800 is server world width
  }

  initGame(gameData) {
    this.gameData = gameData;
    this.obstacles = gameData.obstacles || [];
    this.balls = [];

    // Start rendering loop
    this.startRenderLoop();
  }

  updateGame(gameData) {
    this.balls = gameData.balls || [];
    // Game data is updated, rendering loop will pick it up
  }

  startRenderLoop() {
    const render = () => {
      this.clearCanvas();
      this.drawBackground();
      this.drawObstacles();
      this.drawBalls();
      this.drawFinishLine();
      this.drawUI();

      this.animationId = requestAnimationFrame(render);
    };

    render();
  }

  stopRenderLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawBackground() {
    // Sky to ground gradient
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, "#87CEEB"); // Sky blue
    gradient.addColorStop(0.3, "#98FB98"); // Light green
    gradient.addColorStop(0.7, "#90EE90"); // Medium green
    gradient.addColorStop(1, "#228B22"); // Forest green

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Add some clouds
    this.drawClouds();
  }

  drawClouds() {
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";

    // Simple cloud shapes
    for (let i = 0; i < 3; i++) {
      const x = (i * 150 + 50) * this.camera.scale;
      const y = (30 + i * 20) * this.camera.scale;
      const size = 20 * this.camera.scale;

      this.ctx.beginPath();
      this.ctx.arc(x, y, size, 0, Math.PI * 2);
      this.ctx.arc(x + size, y, size * 0.8, 0, Math.PI * 2);
      this.ctx.arc(x + size * 1.5, y + size * 0.3, size * 0.6, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  drawObstacles() {
    this.obstacles.forEach((obstacle) => {
      const x = obstacle.x * this.camera.scale;
      const y = obstacle.y * this.camera.scale;
      const width = obstacle.width * this.camera.scale;
      const height = obstacle.height * this.camera.scale;

      // Platform shadow
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
      this.ctx.fillRect(x + 2, y + 2, width, height);

      // Platform
      this.ctx.fillStyle = "#8B4513"; // Brown
      this.ctx.fillRect(x, y, width, height);

      // Platform highlight
      this.ctx.fillStyle = "#A0522D";
      this.ctx.fillRect(x, y, width, 4);

      // Platform border
      this.ctx.strokeStyle = "#654321";
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x, y, width, height);
    });
  }

  drawBalls() {
    // Sort balls by Y position for proper layering
    const sortedBalls = [...this.balls].sort((a, b) => a.y - b.y);

    sortedBalls.forEach((ball) => {
      const x = ball.x * this.camera.scale;
      const y = ball.y * this.camera.scale;
      const radius = 8 * this.camera.scale;

      // Ball shadow
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      this.ctx.beginPath();
      this.ctx.ellipse(
        x + 2,
        y + radius + 2,
        radius * 0.8,
        radius * 0.4,
        0,
        0,
        Math.PI * 2
      );
      this.ctx.fill();

      // Ball
      this.ctx.fillStyle = ball.color;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.fill();

      // Ball highlight
      const gradient = this.ctx.createRadialGradient(
        x - radius * 0.3,
        y - radius * 0.3,
        0,
        x,
        y,
        radius
      );
      gradient.addColorStop(0, "rgba(255, 255, 255, 0.6)");
      gradient.addColorStop(0.4, "rgba(255, 255, 255, 0.2)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0.2)");

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.fill();

      // Ball border
      this.ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.stroke();

      // Player name (small text)
      if (ball.username) {
        this.ctx.fillStyle = "#000";
        this.ctx.font = `${Math.max(8, 10 * this.camera.scale)}px Arial`;
        this.ctx.textAlign = "center";
        this.ctx.fillText(ball.username, x, y - radius - 5);
      }
    });
  }

  drawFinishLine() {
    const finishY = (1200 - 50) * this.camera.scale; // Near bottom
    const width = this.canvas.width;
    const height = 30 * this.camera.scale;

    // Checkered pattern
    const squareSize = 15 * this.camera.scale;

    for (let x = 0; x < width; x += squareSize) {
      for (let y = 0; y < height; y += squareSize) {
        const isWhite =
          (Math.floor(x / squareSize) + Math.floor(y / squareSize)) % 2 === 0;
        this.ctx.fillStyle = isWhite ? "#FFF" : "#000";
        this.ctx.fillRect(x, finishY + y, squareSize, squareSize);
      }
    }

    // Finish line text
    this.ctx.fillStyle = "#FF0000";
    this.ctx.font = `bold ${Math.max(12, 16 * this.camera.scale)}px Arial`;
    this.ctx.textAlign = "center";
    this.ctx.fillText("🏁 ФИНИШ", this.canvas.width / 2, finishY - 10);
  }

  drawUI() {
    // Ball count by player
    const playerStats = this.getBallCountByPlayer();

    this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    this.ctx.fillRect(10, 10, 200, playerStats.length * 20 + 10);

    this.ctx.fillStyle = "#FFF";
    this.ctx.font = "12px Arial";
    this.ctx.textAlign = "left";

    playerStats.forEach((player, index) => {
      this.ctx.fillText(
        `${player.username}: ${player.count} 🎱`,
        15,
        30 + index * 20
      );
    });
  }

  getBallCountByPlayer() {
    const playerCounts = {};

    this.balls.forEach((ball) => {
      if (!playerCounts[ball.username]) {
        playerCounts[ball.username] = 0;
      }
      playerCounts[ball.username]++;
    });

    return Object.entries(playerCounts)
      .map(([username, count]) => ({ username, count }))
      .sort((a, b) => b.count - a.count);
  }

  destroy() {
    this.stopRenderLoop();
  }
}

// Make GameRenderer available globally
window.GameRenderer = GameRenderer;
