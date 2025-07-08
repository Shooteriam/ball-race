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

// Game mechanics and physics constants
const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 1200;
const GRAVITY = 0.3;
const BALL_RADIUS = 12;
const FINISH_LINE_Y = WORLD_HEIGHT - 100;

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

// Generate obstacles for the game
function generateObstacles() {
  const obstacles = [];

  // Add horizontal platforms with gaps
  for (let level = 1; level <= 8; level++) {
    const y = 150 + level * 120;
    const numPlatforms = 2 + Math.floor(Math.random() * 2);

    for (let i = 0; i < numPlatforms; i++) {
      const width = 80 + Math.random() * 100;
      const spacing = WORLD_WIDTH / (numPlatforms + 1);
      const x = i * spacing + (spacing - width) / 2 + Math.random() * 60 - 30;

      obstacles.push({
        id: `platform_${level}_${i}`,
        type: "platform",
        x: Math.max(0, Math.min(WORLD_WIDTH - width, x)),
        y: y,
        width: width,
        height: 20,
        color: "#4f46e5",
      });
    }
  }

  // Add some moving obstacles
  for (let i = 0; i < 3; i++) {
    obstacles.push({
      id: `moving_${i}`,
      type: "moving",
      x: 100 + i * 200,
      y: 300 + i * 200,
      width: 60,
      height: 20,
      color: "#dc2626",
      velocity: {
        x: (Math.random() > 0.5 ? 1 : -1) * (1 + Math.random()),
        y: 0,
      },
      range: { min: 50, max: WORLD_WIDTH - 110 },
    });
  }

  // Add finish line
  obstacles.push({
    id: "finish_line",
    type: "finish",
    x: 0,
    y: FINISH_LINE_Y,
    width: WORLD_WIDTH,
    height: 10,
    color: "#10b981",
  });

  return obstacles;
}

// Physics simulation
function simulatePhysics(balls, obstacles, deltaTime) {
  balls.forEach((ball) => {
    // Apply gravity
    ball.velocity.y += GRAVITY * deltaTime;

    // Update position
    ball.position.x += ball.velocity.x * deltaTime;
    ball.position.y += ball.velocity.y * deltaTime;

    // Check wall collisions
    if (ball.position.x <= BALL_RADIUS) {
      ball.position.x = BALL_RADIUS;
      ball.velocity.x = Math.abs(ball.velocity.x) * 0.7;
    } else if (ball.position.x >= WORLD_WIDTH - BALL_RADIUS) {
      ball.position.x = WORLD_WIDTH - BALL_RADIUS;
      ball.velocity.x = -Math.abs(ball.velocity.x) * 0.7;
    }

    // Check obstacle collisions
    obstacles.forEach((obstacle) => {
      if (obstacle.type === "finish") {
        // Check if ball reached finish line
        if (ball.position.y + BALL_RADIUS >= obstacle.y && !ball.finished) {
          ball.finished = true;
          ball.finishTime = Date.now();
        }
      } else {
        checkBallObstacleCollision(ball, obstacle);
      }
    });

    // Prevent balls from going too far down
    if (ball.position.y > WORLD_HEIGHT + 100) {
      ball.position.y = WORLD_HEIGHT + 100;
      ball.velocity.y = 0;
    }
  });
}

// Check collision between ball and obstacle
function checkBallObstacleCollision(ball, obstacle) {
  const ballLeft = ball.position.x - BALL_RADIUS;
  const ballRight = ball.position.x + BALL_RADIUS;
  const ballTop = ball.position.y - BALL_RADIUS;
  const ballBottom = ball.position.y + BALL_RADIUS;

  const obstacleLeft = obstacle.x;
  const obstacleRight = obstacle.x + obstacle.width;
  const obstacleTop = obstacle.y;
  const obstacleBottom = obstacle.y + obstacle.height;

  if (
    ballRight > obstacleLeft &&
    ballLeft < obstacleRight &&
    ballBottom > obstacleTop &&
    ballTop < obstacleBottom
  ) {
    // Determine collision side
    const overlapLeft = ballRight - obstacleLeft;
    const overlapRight = obstacleRight - ballLeft;
    const overlapTop = ballBottom - obstacleTop;
    const overlapBottom = obstacleBottom - ballTop;

    const minOverlap = Math.min(
      overlapLeft,
      overlapRight,
      overlapTop,
      overlapBottom
    );

    if (minOverlap === overlapTop) {
      // Ball hit from top
      ball.position.y = obstacleTop - BALL_RADIUS;
      ball.velocity.y = -Math.abs(ball.velocity.y) * 0.6;
    } else if (minOverlap === overlapBottom) {
      // Ball hit from bottom
      ball.position.y = obstacleBottom + BALL_RADIUS;
      ball.velocity.y = Math.abs(ball.velocity.y) * 0.6;
    } else if (minOverlap === overlapLeft) {
      // Ball hit from left
      ball.position.x = obstacleLeft - BALL_RADIUS;
      ball.velocity.x = -Math.abs(ball.velocity.x) * 0.7;
    } else {
      // Ball hit from right
      ball.position.x = obstacleRight + BALL_RADIUS;
      ball.velocity.x = Math.abs(ball.velocity.x) * 0.7;
    }
  }
}

// Update moving obstacles
function updateMovingObstacles(obstacles, deltaTime) {
  obstacles.forEach((obstacle) => {
    if (obstacle.type === "moving") {
      obstacle.x += obstacle.velocity.x * deltaTime;

      if (
        obstacle.x <= obstacle.range.min ||
        obstacle.x >= obstacle.range.max
      ) {
        obstacle.velocity.x *= -1;
        obstacle.x = Math.max(
          obstacle.range.min,
          Math.min(obstacle.range.max, obstacle.x)
        );
      }
    }
  });
}

// Physics simulation loop
function startPhysicsSimulation(game) {
  let lastTime = Date.now();
  const SIMULATION_INTERVAL = 16; // ~60 FPS

  // Initialize all balls at starting positions
  const allBalls = [];
  game.players.forEach((player) => {
    player.balls.forEach((ball, index) => {
      allBalls.push({
        ...ball,
        playerId: player.userId,
        playerName: player.username,
        position: {
          x: 100 + Math.random() * 600, // Random starting X position
          y: 50 + index * 5, // Slight Y offset for multiple balls
        },
        velocity: {
          x: (Math.random() - 0.5) * 2, // Small random horizontal velocity
          y: 0,
        },
        finished: false,
        finishTime: null,
      });
    });
  });

  game.balls = allBalls;

  const simulationInterval = setInterval(() => {
    const currentTime = Date.now();
    const deltaTime = Math.min((currentTime - lastTime) / 16.67, 2); // Cap deltaTime to prevent large jumps
    lastTime = currentTime;

    // Update moving obstacles
    updateMovingObstacles(game.obstacles, deltaTime);

    // Simulate physics for all balls
    simulatePhysics(game.balls, game.obstacles, deltaTime);

    // Check for winners
    const finishedBalls = game.balls.filter((ball) => ball.finished);

    if (finishedBalls.length > 0 && !game.winner) {
      // Sort by finish time to find the winner
      finishedBalls.sort((a, b) => a.finishTime - b.finishTime);
      game.winner = {
        ballId: finishedBalls[0].id,
        playerId: finishedBalls[0].playerId,
        playerName: finishedBalls[0].playerName,
        finishTime: finishedBalls[0].finishTime,
      };

      console.log(`Game ${game.id} winner: ${game.winner.playerName}`);

      // End game after 3 seconds to show results
      setTimeout(() => {
        endGame(game);
        clearInterval(simulationInterval);
      }, 3000);
    }

    // Send game state to all clients
    io.emit("game-state", {
      gameId: game.id,
      balls: game.balls,
      obstacles: game.obstacles,
      winner: game.winner,
      timeElapsed: currentTime - game.startTime,
    });

    // End game after 60 seconds if no winner
    if (currentTime - game.startTime > 60000 && !game.winner) {
      console.log(`Game ${game.id} timed out`);
      endGame(game);
      clearInterval(simulationInterval);
    }
  }, SIMULATION_INTERVAL);

  game.simulationInterval = simulationInterval;
}

// End game and show results
function endGame(game) {
  game.status = "finished";
  game.endTime = Date.now();

  // Calculate final results
  const results = game.balls
    .map((ball) => ({
      ballId: ball.id,
      playerId: ball.playerId,
      playerName: ball.playerName,
      finished: ball.finished,
      finishTime: ball.finishTime,
      finalPosition: ball.position,
    }))
    .sort((a, b) => {
      if (a.finished && !b.finished) return -1;
      if (!a.finished && b.finished) return 1;
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      return b.finalPosition.y - a.finalPosition.y; // Further down = better if not finished
    });

  // Store game in history
  gameState.games.push({
    id: game.id,
    startTime: game.startTime,
    endTime: game.endTime,
    winner: game.winner,
    results: results,
    playerCount: game.players.length,
  });

  // Limit history to last 10 games
  if (gameState.games.length > 10) {
    gameState.games = gameState.games.slice(-10);
  }

  // Notify clients
  io.emit("game-ended", {
    gameId: game.id,
    winner: game.winner,
    results: results,
  });

  gameState.currentGame = null;
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Ball Race server running on port ${PORT}`);
  console.log(`📱 Client available at http://localhost:${PORT}`);
  startGameTimer();
});

module.exports = app;
