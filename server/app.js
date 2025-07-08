const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
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
  statistics: {
    totalGames: 0,
    totalPlayers: 0,
    totalBallsSold: 0
  }
};

// Game settings from environment variables
const GAME_SETTINGS = {
  MAX_PLAYERS: parseInt(process.env.MAX_PLAYERS) || 20,
  GAME_INTERVAL: parseInt(process.env.GAME_INTERVAL) || 120000, // 2 минуты по умолчанию
  BALL_PRICE: parseInt(process.env.BALL_PRICE) || 50,
  MAX_BALLS_PER_PLAYER: parseInt(process.env.MAX_BALLS_PER_PLAYER) || 50,
  GAME_DURATION: 60 * 1000, // 60 seconds max
  WORLD_WIDTH: 800,
  WORLD_HEIGHT: 1200,
};

// Game mechanics and physics constants
const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 1200;
const GRAVITY = 0.5; // Увеличена гравитация для более быстрого падения
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
  const { userId, ballCount, paymentData, initData } = req.body;

  try {
    // Validate Telegram WebApp data
    if (process.env.NODE_ENV === 'production' && initData) {
      const isValidData = validateTelegramWebAppData(initData, process.env.TELEGRAM_BOT_TOKEN);
      if (!isValidData) {
        return res.status(400).json({ success: false, error: "Invalid Telegram data" });
      }
    }

    // Verify Telegram Stars payment
    const paymentResult = await verifyTelegramStarsPayment(paymentData, userId);
    
    if (!paymentResult.success) {
      return res.status(400).json({ success: false, error: paymentResult.error || "Payment verification failed" });
    }

    // Validate ball count
    if (ballCount <= 0 || ballCount > GAME_SETTINGS.MAX_BALLS_PER_PLAYER) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid ball count (max: ${GAME_SETTINGS.MAX_BALLS_PER_PLAYER})` 
      });
    }

    // Calculate expected payment amount
    const expectedAmount = ballCount * GAME_SETTINGS.BALL_PRICE;
    if (paymentResult.amount < expectedAmount) {
      return res.status(400).json({ 
        success: false, 
        error: "Insufficient payment amount" 
      });
    }

    // Get or create player data
    let playerData = gameState.lobby.get(userId);
    if (!playerData) {
      playerData = {
        userId,
        username: req.body.username || "Player",
        balls: [],
        isAdmin: isAdmin(userId),
        totalBallsPurchased: 0,
        totalStarsSpent: 0
      };
      gameState.lobby.set(userId, playerData);
    }

    // Check if player already has max balls
    if (playerData.balls.length + ballCount > GAME_SETTINGS.MAX_BALLS_PER_PLAYER) {
      return res.status(400).json({ 
        success: false, 
        error: `Would exceed maximum balls per player (${GAME_SETTINGS.MAX_BALLS_PER_PLAYER})` 
      });
    }

    // Add balls with improved positioning
    const startX = 100;
    const endX = WORLD_WIDTH - 100;
    const spacing = (endX - startX) / Math.max(1, ballCount - 1);

    for (let i = 0; i < ballCount; i++) {
      const x = ballCount === 1 ? WORLD_WIDTH / 2 : startX + (i * spacing);
      playerData.balls.push({
        id: `${userId}_${Date.now()}_${i}`,
        color: getRandomBallColor(),
        position: { 
          x: x + (Math.random() - 0.5) * 50, // Добавляем небольшой разброс
          y: 20 + Math.random() * 30 
        },
        velocity: { x: (Math.random() - 0.5) * 2, y: 0 },
      });
    }

    // Update statistics
    playerData.totalBallsPurchased += ballCount;
    playerData.totalStarsSpent += expectedAmount;
    gameState.statistics.totalBallsSold += ballCount;

    // Notify all clients about lobby update
    broadcastLobbyUpdate();

    console.log(`Player ${playerData.username} purchased ${ballCount} balls for ${expectedAmount} stars`);

    res.json({ 
      success: true, 
      ballCount: playerData.balls.length,
      totalSpent: playerData.totalStarsSpent,
      message: `Successfully purchased ${ballCount} balls!`
    });

  } catch (error) {
    console.error("Payment error:", error);
    res.status(500).json({ success: false, error: "Payment processing failed" });
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

  // Buy balls via socket
  socket.on("buy-balls", (data) => {
    const { ballCount } = data;

    if (!socket.userId) {
      socket.emit("error", { message: "Не авторизован" });
      return;
    }

    if (ballCount <= 0 || ballCount > GAME_SETTINGS.MAX_BALLS_PER_PLAYER) {
      socket.emit("error", {
        message: `Неверное количество шариков (макс: ${GAME_SETTINGS.MAX_BALLS_PER_PLAYER})`,
      });
      return;
    }

    // Get or create player data
    let playerData = gameState.lobby.get(socket.userId);
    if (!playerData) {
      playerData = {
        userId: socket.userId,
        username: socket.username || "Player",
        balls: [],
        isAdmin: isAdmin(socket.userId),
      };
      gameState.lobby.set(socket.userId, playerData);
    }

    // Add balls
    for (let i = 0; i < ballCount; i++) {
      playerData.balls.push({
        id: `${socket.userId}_${Date.now()}_${i}`,
        color: getRandomBallColor(),
        position: { x: Math.random() * 400 + 200, y: 50 },
        velocity: { x: (Math.random() - 0.5) * 4, y: 0 },
      });
    }

    console.log(
      `Player ${playerData.username} bought ${ballCount} balls (total: ${playerData.balls.length})`
    );

    // Send updated player stats
    socket.emit("player-stats", {
      ballCount: playerData.balls.length,
      totalBalls: playerData.balls.length,
    });

    // Update lobby for all players
    broadcastLobbyUpdate();
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

  // Start game request
  socket.on("start-game", () => {
    const playerData = gameState.lobby.get(socket.userId);

    if (!playerData) {
      socket.emit("error", { message: "Игрок не найден в лобби" });
      return;
    }

    if (playerData.balls.length === 0) {
      socket.emit("error", { message: "У вас нет шариков для игры" });
      return;
    }

    console.log(`Player ${playerData.username} requested game start`);

    // For now, only admin can start the game manually
    // Regular players will wait for the automatic timer
    if (playerData.isAdmin) {
      startGame();
    } else {
      socket.emit("info", {
        message: "Ожидание других игроков или таймера...",
      });
    }
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
    const adminIdsEnv = process.env.ADMIN_IDS;
    if (adminIdsEnv) {
      return adminIdsEnv.split(',').map(id => id.trim());
    }
    
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

// Telegram WebApp data validation
function validateTelegramWebAppData(initData, botToken) {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');
    
    // Sort parameters
    const dataCheckArray = [];
    for (const [key, value] of urlParams.entries()) {
      dataCheckArray.push(`${key}=${value}`);
    }
    dataCheckArray.sort();
    
    const dataCheckString = dataCheckArray.join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    
    return calculatedHash === hash;
  } catch (error) {
    console.error('Telegram validation error:', error);
    return false;
  }
}

// Verify Telegram Stars payment
async function verifyTelegramStarsPayment(paymentData, userId) {
  try {
    // TODO: Implement actual Telegram Stars verification
    // For now, we'll simulate validation
    if (process.env.NODE_ENV === 'development') {
      return { success: true, amount: paymentData.amount || GAME_SETTINGS.BALL_PRICE };
    }
    
    // Real implementation would check with Telegram API
    // const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/verifyStarPayment`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ payment_id: paymentData.payment_id, user_id: userId })
    // });
    
    return { success: true, amount: paymentData.amount || GAME_SETTINGS.BALL_PRICE };
  } catch (error) {
    console.error('Payment verification failed:', error);
    return { success: false, error: 'Payment verification failed' };
  }
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

  // Add horizontal platforms with strategically placed gaps
  for (let level = 1; level <= 6; level++) {
    const y = 120 + level * 150; // Увеличиваем расстояние между уровнями
    const numPlatforms = Math.random() > 0.3 ? 2 : 3; // Чаще 2 платформы

    // Create gaps that aren't too wide or too narrow
    const totalWidth = WORLD_WIDTH - 100; // Leave margins
    const gapSize = 120 + Math.random() * 80; // Gap size 120-200px
    const platformWidth = (totalWidth - gapSize) / numPlatforms;

    for (let i = 0; i < numPlatforms; i++) {
      const x = 50 + i * (platformWidth + gapSize / (numPlatforms - 1));
      
      obstacles.push({
        id: `platform_${level}_${i}`,
        type: "platform",
        x: x,
        y: y,
        width: platformWidth,
        height: 20,
        color: "#4f46e5",
      });
    }
  }

  // Add fewer but more strategic moving obstacles
  for (let i = 0; i < 2; i++) {
    const y = 250 + i * 300;
    obstacles.push({
      id: `moving_${i}`,
      type: "moving",
      x: 100 + i * 300,
      y: y,
      width: 80,
      height: 20,
      color: "#dc2626",
      velocity: {
        x: (Math.random() > 0.5 ? 1 : -1) * (0.8 + Math.random() * 0.7), // Slower movement
        y: 0,
      },
      range: { min: 50, max: WORLD_WIDTH - 130 },
    });
  }

  // Add some static obstacles for variety
  for (let i = 0; i < 3; i++) {
    const y = 200 + i * 200;
    const x = 200 + Math.random() * 400;
    obstacles.push({
      id: `static_${i}`,
      type: "platform",
      x: x,
      y: y,
      width: 60 + Math.random() * 40,
      height: 15,
      color: "#7c3aed",
    });
  }

  // Add finish line
  obstacles.push({
    id: "finish_line",
    type: "finish",
    x: 0,
    y: FINISH_LINE_Y,
    width: WORLD_WIDTH,
    height: 15,
    color: "#10b981",
  });

  return obstacles;
}

// Physics simulation
function simulatePhysics(balls, obstacles, deltaTime) {
  balls.forEach((ball) => {
    // Apply gravity
    ball.velocity.y += GRAVITY * deltaTime;

    // Add slight air resistance
    ball.velocity.x *= 0.999;
    ball.velocity.y *= 0.9995;

    // Update position
    ball.position.x += ball.velocity.x * deltaTime;
    ball.position.y += ball.velocity.y * deltaTime;

    // Check wall collisions with improved bouncing
    if (ball.position.x <= BALL_RADIUS) {
      ball.position.x = BALL_RADIUS;
      ball.velocity.x = Math.abs(ball.velocity.x) * 0.6; // Reduced bounce
    } else if (ball.position.x >= WORLD_WIDTH - BALL_RADIUS) {
      ball.position.x = WORLD_WIDTH - BALL_RADIUS;
      ball.velocity.x = -Math.abs(ball.velocity.x) * 0.6; // Reduced bounce
    }

    // Check obstacle collisions
    obstacles.forEach((obstacle) => {
      if (obstacle.type === "finish") {
        // Check if ball reached finish line
        if (ball.position.y + BALL_RADIUS >= obstacle.y && !ball.finished) {
          ball.finished = true;
          ball.finishTime = Date.now();
          console.log(`Ball ${ball.id} finished! Player: ${ball.playerName}`);
        }
      } else {
        checkBallObstacleCollision(ball, obstacle);
      }
    });

    // Prevent balls from going too far down
    if (ball.position.y > WORLD_HEIGHT + 200) {
      ball.position.y = WORLD_HEIGHT + 200;
      ball.velocity.y = 0;
      if (!ball.finished) {
        ball.finished = true;
        ball.finishTime = Date.now() + 60000; // Penalty time for falling off
      }
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
  const timerMinutes = Math.floor(GAME_SETTINGS.GAME_INTERVAL / (60 * 1000));
  const timerSeconds = Math.floor(
    (GAME_SETTINGS.GAME_INTERVAL % (60 * 1000)) / 1000
  );

  console.log(`🚀 Ball Race server running on port ${PORT}`);
  console.log(`📱 Client available at http://localhost:${PORT}`);
  console.log(`⏰ Game timer interval: ${timerMinutes}m ${timerSeconds}s`);
  console.log(`🎯 Max players: ${GAME_SETTINGS.MAX_PLAYERS}`);
  console.log(`💰 Ball price: ${GAME_SETTINGS.BALL_PRICE} stars`);
  console.log(`🔄 Starting game timer...`);

  startGameTimer();
});

module.exports = app;
