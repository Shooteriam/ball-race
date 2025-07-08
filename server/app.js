const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Game state
const gameState = {
  currentGame: null,
  lobby: new Map(), // userId -> playerData
  games: [], // история игр
  gameTimer: null,
  nextGameTime: null,
};

// Game settings
const GAME_SETTINGS = {
  MAX_PLAYERS: 20,
  GAME_INTERVAL: 5 * 60 * 1000, // 5 minutes
  BALL_PRICE: 50, // Telegram Stars
  MAX_BALLS_PER_PLAYER: 50,
  GAME_DURATION: 60 * 1000, // 60 seconds max
  WORLD_WIDTH: 800,
  WORLD_HEIGHT: 1200,
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../client")));

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/index.html"));
});

app.get("/api/game-info", (req, res) => {
  const nextGameTime = gameState.nextGameTime || Date.now() + 10000; // 10 seconds for testing

  res.json({
    nextGameTime,
    playersInLobby: gameState.lobby.size,
    maxPlayers: GAME_SETTINGS.MAX_PLAYERS,
    ballPrice: GAME_SETTINGS.BALL_PRICE,
    maxBalls: GAME_SETTINGS.MAX_BALLS_PER_PLAYER,
    gameInterval: GAME_SETTINGS.GAME_INTERVAL,
  });
});

// Telegram Stars payment endpoint
app.post("/api/buy-balls", async (req, res) => {
  const { userId, ballCount, paymentData } = req.body;

  try {
    // TODO: Verify Telegram Stars payment
    // const isPaymentValid = await verifyTelegramStarsPayment(paymentData);

    // For now, simulate successful payment
    const isPaymentValid = true;

    if (isPaymentValid && ballCount <= GAME_SETTINGS.MAX_BALLS_PER_PLAYER) {
      // Add player to lobby or update their ball count
      const playerData = gameState.lobby.get(userId) || {
        userId,
        username: req.body.username || "Player",
        balls: [],
      };

      // Add balls
      for (let i = 0; i < ballCount; i++) {
        playerData.balls.push({
          id: `${userId}_${Date.now()}_${i}`,
          color: getRandomBallColor(),
          position: { x: Math.random() * 400 + 200, y: 50 },
          velocity: { x: (Math.random() - 0.5) * 4, y: 0 },
        });
      }

      gameState.lobby.set(userId, playerData);

      // Notify all clients about lobby update
      broadcastLobbyUpdate();

      res.json({ success: true, ballCount: playerData.balls.length });
    } else {
      res
        .status(400)
        .json({ success: false, error: "Invalid payment or too many balls" });
    }
  } catch (error) {
    console.error("Payment error:", error);
    res
      .status(500)
      .json({ success: false, error: "Payment processing failed" });
  }
});

// Socket.io connections
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-lobby", (userData) => {
    socket.userId = userData.userId;
    socket.username = userData.username;

    // Add player to lobby
    const playerData = {
      userId: userData.userId,
      username: userData.username,
      balls: [],
      isAdmin: isAdmin(userData.userId),
    };

    gameState.lobby.set(userData.userId, playerData);

    console.log(
      `Player joined lobby: ${userData.username} (Admin: ${playerData.isAdmin})`
    );

    // Send current lobby state
    broadcastLobbyUpdate();

    // Send next game time
    socket.emit("next-game-time", gameState.nextGameTime);
  });

  // Admin: force start game
  socket.on("admin:forceStart", (data) => {
    const playerData = gameState.lobby.get(socket.userId);

    if (!playerData || !playerData.isAdmin) {
      socket.emit("admin:error", { message: "Нет прав администратора" });
      return;
    }

    console.log(`Admin ${playerData.username} forced game start`);

    // Check if there are players with balls
    const playersWithBalls = Array.from(gameState.lobby.values()).filter(
      (p) => p.balls.length > 0
    );

    if (playersWithBalls.length === 0) {
      socket.emit("admin:error", {
        message: "Нет игроков с шариками для старта игры",
      });
      return;
    }

    // Start game immediately
    startGame();

    // Notify admin
    socket.emit("admin:gameForceStarted");

    console.log(
      `Game force started by admin. Players: ${playersWithBalls.length}`
    );
  });

  // Admin: reset game
  socket.on("admin:resetGame", (data) => {
    const playerData = gameState.lobby.get(socket.userId);

    if (!playerData || !playerData.isAdmin) {
      socket.emit("admin:error", { message: "Нет прав администратора" });
      return;
    }

    console.log(`Admin ${playerData.username} reset game`);

    // Reset game
    resetGame();

    // Notify all clients
    io.emit("admin:gameReset");
    broadcastLobbyUpdate();

    console.log("Game reset by admin");
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    if (socket.userId) {
      gameState.lobby.delete(socket.userId);
      broadcastLobbyUpdate();
    }
  });
});

// Helper functions
function loadAdminIds() {
  try {
    const adminConfigPath = path.join(__dirname, "../admin-config.txt");
    if (fs.existsSync(adminConfigPath)) {
      const content = fs.readFileSync(adminConfigPath, "utf8");
      const ids = content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));
      return ids;
    }
  } catch (error) {
    console.warn("Could not load admin config:", error.message);
  }
  return ["dev_admin", "123456789"]; // Fallback defaults
}

function isAdmin(userId) {
  const adminIds = loadAdminIds();
  return adminIds.includes(userId.toString());
}

function resetGame() {
  // Stop all timers
  if (gameState.gameTimer) {
    clearInterval(gameState.gameTimer);
    gameState.gameTimer = null;
  }

  // Reset game state
  gameState.currentGame = null;
  gameState.games = [];

  // Reset balls for all players but keep them in lobby
  gameState.lobby.forEach((player) => {
    player.balls = [];
  });

  // Start new game timer
  startGameTimer();
}

function startGameTimer() {
  // Stop existing timer
  if (gameState.gameTimer) {
    clearInterval(gameState.gameTimer);
  }

  gameState.nextGameTime = Date.now() + GAME_SETTINGS.GAME_INTERVAL;

  gameState.gameTimer = setInterval(() => {
    const timeLeft = Math.max(0, gameState.nextGameTime - Date.now());

    if (timeLeft <= 0) {
      clearInterval(gameState.gameTimer);
      gameState.gameTimer = null;

      // Check if there are players with balls
      const playersWithBalls = Array.from(gameState.lobby.values()).filter(
        (p) => p.balls.length > 0
      );

      if (playersWithBalls.length > 0) {
        startGame();
      } else {
        // If no players, start new timer
        startGameTimer();
      }
    } else {
      // Send timer update
      io.emit("next-game-time", gameState.nextGameTime);
    }
  }, 1000);

  // Send initial timer
  io.emit("next-game-time", gameState.nextGameTime);
}

function broadcastLobbyUpdate() {
  const lobbyData = {
    players: Array.from(gameState.lobby.values()).map((p) => ({
      username: p.username,
      ballCount: p.balls.length,
    })),
    totalPlayers: gameState.lobby.size,
  };

  io.emit("lobby-update", lobbyData);
}

function getRandomBallColor() {
  const colors = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#96CEB4",
    "#FFEAA7",
    "#DDA0DD",
    "#98D8C8",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

function startGame() {
  if (gameState.lobby.size === 0) {
    console.log("No players in lobby, skipping game");
    return;
  }

  console.log(`Starting game with ${gameState.lobby.size} players`);

  const game = {
    id: Date.now(),
    players: Array.from(gameState.lobby.values()),
    startTime: Date.now(),
    status: "running",
    obstacles: generateObstacles(),
    winner: null,
  };

  gameState.currentGame = game;
  gameState.lobby.clear();

  // Notify all clients game started
  io.emit("game-started", {
    gameId: game.id,
    players: game.players.map((p) => ({
      username: p.username,
      ballCount: p.balls.length,
    })),
    obstacles: game.obstacles,
  });

  // Start physics simulation
  startPhysicsSimulation(game);

  // Start new timer for next game
  startGameTimer();
}

function generateObstacles() {
  const obstacles = [];
  const obstacleCount = 15;

  for (let i = 0; i < obstacleCount; i++) {
    obstacles.push({
      id: i,
      x: Math.random() * (GAME_SETTINGS.WORLD_WIDTH - 100),
      y: 200 + i * 60,
      width: 80 + Math.random() * 120,
      height: 20,
      type: "platform",
    });
  }

  return obstacles;
}

function startPhysicsSimulation(game) {
  const gameLoop = setInterval(() => {
    if (!gameState.currentGame || gameState.currentGame.status !== "running") {
      clearInterval(gameLoop);
      return;
    }

    // Update ball physics
    updateBallPhysics(game);

    // Check for winner
    const winner = checkForWinner(game);
    if (winner) {
      endGame(game, winner);
      clearInterval(gameLoop);
    }

    // Send game state to clients
    io.emit("game-update", {
      balls: getAllBallPositions(game),
      gameTime: Date.now() - game.startTime,
    });
  }, 1000 / 60); // 60 FPS
}

function updateBallPhysics(game) {
  const gravity = 0.5;
  const bounceReduction = 0.7;

  game.players.forEach((player) => {
    player.balls.forEach((ball) => {
      // Apply gravity
      ball.velocity.y += gravity;

      // Update position
      ball.position.x += ball.velocity.x;
      ball.position.y += ball.velocity.y;

      // Collision with walls
      if (
        ball.position.x <= 10 ||
        ball.position.x >= GAME_SETTINGS.WORLD_WIDTH - 10
      ) {
        ball.velocity.x *= -bounceReduction;
        ball.position.x = Math.max(
          10,
          Math.min(GAME_SETTINGS.WORLD_WIDTH - 10, ball.position.x)
        );
      }

      // Collision with obstacles
      game.obstacles.forEach((obstacle) => {
        if (checkBallObstacleCollision(ball, obstacle)) {
          ball.velocity.y *= -bounceReduction;
          ball.velocity.x += (Math.random() - 0.5) * 2; // Add some randomness
        }
      });
    });
  });
}

function checkBallObstacleCollision(ball, obstacle) {
  return (
    ball.position.x >= obstacle.x &&
    ball.position.x <= obstacle.x + obstacle.width &&
    ball.position.y >= obstacle.y &&
    ball.position.y <= obstacle.y + obstacle.height
  );
}

function getAllBallPositions(game) {
  const balls = [];
  game.players.forEach((player) => {
    player.balls.forEach((ball) => {
      balls.push({
        id: ball.id,
        username: player.username,
        x: ball.position.x,
        y: ball.position.y,
        color: ball.color,
      });
    });
  });
  return balls;
}

function checkForWinner(game) {
  for (const player of game.players) {
    for (const ball of player.balls) {
      if (ball.position.y >= GAME_SETTINGS.WORLD_HEIGHT - 50) {
        return { player, ball };
      }
    }
  }
  return null;
}

function endGame(game, winner) {
  game.status = "finished";
  game.winner = winner;
  gameState.games.push(game);
  gameState.currentGame = null;

  console.log(`Game ended! Winner: ${winner.player.username}`);

  // Notify clients
  io.emit("game-ended", {
    winner: {
      username: winner.player.username,
      ballId: winner.ball.id,
    },
    gameId: game.id,
  });

  // TODO: Send Telegram gift to winner
  // await sendTelegramGift(winner.player.userId);
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Ball Race server running on port ${PORT}`);
  console.log(`📱 Client available at http://localhost:${PORT}`);
  startGameTimer();
});

module.exports = app;
