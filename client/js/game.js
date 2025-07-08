// Game Renderer for Ball Race
console.log("GameRenderer script loaded");

class GameRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");
    this.gameData = null;
    this.obstacles = [];
    this.balls = [];
    this.animationId = null;
    this.winner = null;
    this.playerBalls = []; // Track player's own balls

    // Camera settings with improved controls
    this.camera = {
      x: 0,
      y: 0,
      scale: 1,
      mode: 'follow', // 'follow', 'top', 'finish'
      targetY: 0,
      smoothing: 0.1
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
    const containerRect = container.getBoundingClientRect();
    
    // Calculate optimal canvas size for better visibility
    const maxWidth = Math.min(containerRect.width - 20, 600);
    const aspectRatio = 1.5; // Height to width ratio
    
    this.canvas.width = maxWidth;
    this.canvas.height = maxWidth * aspectRatio;
    
    // Ensure canvas doesn't exceed viewport height
    const maxHeight = window.innerHeight * 0.7; // 70% of viewport height
    if (this.canvas.height > maxHeight) {
      this.canvas.height = maxHeight;
      this.canvas.width = maxHeight / aspectRatio;
    }

    // Update camera scale based on canvas size
    this.camera.scale = this.canvas.width / 800; // 800 is world width
    
    // Set CSS to center the canvas
    this.canvas.style.display = 'block';
    this.canvas.style.margin = '0 auto';
    this.canvas.style.borderRadius = '12px';
    this.canvas.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.3)';
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
    
    // Update player balls for camera tracking
    if (window.app && window.app.playerData) {
      this.playerBalls = this.balls.filter(ball => ball.playerId === window.app.playerData.id);
    }
  }

  startRenderLoop() {
    const render = () => {
      this.updateCamera();
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
      const y = (obstacle.y + this.camera.y) * this.camera.scale;
      const width = obstacle.width * this.camera.scale;
      const height = obstacle.height * this.camera.scale;

      // Skip if obstacle is outside visible area
      if (y > this.canvas.height + height || y < -height) return;

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
        this.ctx.fillText("🏁 FINISH", this.canvas.width / 2, Math.max(y - 10, 20));
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
      const y = ((ball.position?.y || ball.y || 0) + this.camera.y) * this.camera.scale;
      const radius = 12 * this.camera.scale;

      // Skip if ball is outside visible area
      if (y < -radius || y > this.canvas.height + radius) return;

      // Highlight player's own balls
      const isPlayerBall = window.app && ball.playerId === window.app.playerData.id;

      // Draw ball shadow
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
      this.ctx.beginPath();
      this.ctx.ellipse(x + 3, y + 3, radius * 0.8, radius * 0.4, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Draw ball with gradient
      const gradient = this.ctx.createRadialGradient(
        x - radius * 0.3, y - radius * 0.3, 0,
        x, y, radius
      );
      gradient.addColorStop(0, ball.color || this.colors.ball);
      gradient.addColorStop(0.7, ball.color || this.colors.ball);
      gradient.addColorStop(1, this.darkenColor(ball.color || this.colors.ball, 0.3));
      
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.fill();

      // Highlight player's own balls
      if (isPlayerBall) {
        this.ctx.strokeStyle = "#ffffff";
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      }

      // Add highlight
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      this.ctx.beginPath();
      this.ctx.arc(
        x - radius * 0.4,
        y - radius * 0.4,
        radius * 0.25,
        0,
        Math.PI * 2
      );
      this.ctx.fill();

      // Player name (optimized for mobile)
      if ((ball.playerName || ball.username) && radius > 8) {
        const fontSize = Math.max(8, 10 * this.camera.scale);
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = `bold ${fontSize}px Inter`;
        this.ctx.textAlign = "center";
        this.ctx.strokeStyle = "#000000";
        this.ctx.lineWidth = 2;
        
        const name = (ball.playerName || ball.username).substring(0, 8); // Limit name length
        this.ctx.strokeText(name, x, y - radius - 5);
        this.ctx.fillText(name, x, y - radius - 5);
      }

      // Draw winner indicator with animation
      if (this.winner && ball.id === this.winner.ballId) {
        const time = Date.now() * 0.005;
        const pulseScale = 1 + Math.sin(time) * 0.1;
        
        this.ctx.strokeStyle = "#fbbf24";
        this.ctx.lineWidth = 3 * this.camera.scale;
        this.ctx.beginPath();
        this.ctx.arc(x, y, (radius + 8) * pulseScale, 0, Math.PI * 2);
        this.ctx.stroke();

        // Winner crown with glow
        this.ctx.shadowColor = "#fbbf24";
        this.ctx.shadowBlur = 10;
        this.ctx.fillStyle = "#fbbf24";
        this.ctx.font = `${Math.max(16, 20 * this.camera.scale)}px Inter`;
        this.ctx.textAlign = "center";
        this.ctx.fillText("👑", x, y - radius - 25);
        this.ctx.shadowBlur = 0;
      }
    });
  }

  // Helper function to darken colors
  darkenColor(color, amount) {
    const hex = color.replace('#', '');
    const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - amount * 255);
    const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - amount * 255);
    const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - amount * 255);
    return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
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

  setCameraMode(mode) {
    this.camera.mode = mode;
    
    switch(mode) {
      case 'top':
        this.camera.targetY = 0;
        break;
      case 'finish':
        this.camera.targetY = -(1200 - this.canvas.height / this.camera.scale); // Bottom of world
        break;
      case 'follow':
        // Will be set dynamically in updateCamera
        break;
    }
  }

  updateCamera() {
    if (this.camera.mode === 'follow' && this.playerBalls.length > 0) {
      // Follow player's balls
      let avgY = 0;
      this.playerBalls.forEach(ball => {
        avgY += ball.y;
      });
      avgY /= this.playerBalls.length;
      
      // Center camera on average position
      this.camera.targetY = -(avgY - this.canvas.height / (2 * this.camera.scale));
    }

    // Smooth camera movement
    this.camera.y += (this.camera.targetY - this.camera.y) * this.camera.smoothing;
    
    // Clamp camera to world bounds
    const maxY = 0;
    const minY = -(1200 - this.canvas.height / this.camera.scale);
    this.camera.y = Math.max(minY, Math.min(maxY, this.camera.y));
  }
}

// Make GameRenderer available globally
window.GameRenderer = GameRenderer;
console.log("GameRenderer class exported to window");
