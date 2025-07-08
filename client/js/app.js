class BallRaceApp {
  constructor() {
    this.socket = null;
    this.gameState = {
      currentScreen: "main",
      playerBalls: 0,
      currentGame: null,
      players: [],
    };
    this.playerData = null;
    this.gameData = null;
    this.isAdmin = false;
    this.hasJoinedLobby = false;
    this.gameRenderer = null;
    this.gameTimer = null;

    this.init();
  }

  async init() {
    try {
      // Инициализация Telegram Web App
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();

        // Получаем данные пользователя
        const initData = window.Telegram.WebApp.initDataUnsafe;
        this.playerData = {
          id: initData.user?.id || Math.random().toString(36).substr(2, 9),
          username:
            initData.user?.username || initData.user?.first_name || "Player",
          firstName: initData.user?.first_name || "Unknown",
          isAdmin: initData.user?.id === 123456789, // Замени на свой Telegram ID
        };

        this.isAdmin = this.playerData.isAdmin;
      } else {
        // Режим разработки
        this.playerData = {
          id: "dev_admin",
          username: "Admin",
          firstName: "Admin",
          isAdmin: true, // В режиме разработки всегда админ
        };
        this.isAdmin = true;
      }

      // Добавляем админ-панель если пользователь админ
      if (this.isAdmin) {
        // Ждем загрузки DOM
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", () => {
            this.createAdminPanel();
          });
        } else {
          this.createAdminPanel();
        }
      }

      await this.connectToServer();
      this.setupEventListeners();
      this.showScreen("main");
    } catch (error) {
      console.error("Initialization error:", error);
      this.showError("Ошибка инициализации приложения");
    }
  }

  createAdminPanel() {
    const mainScreen = document.getElementById("mainScreen");

    if (!mainScreen) {
      console.error("Main screen not found");
      return;
    }

    // Создаем админ-панель
    const adminPanel = document.createElement("div");
    adminPanel.className = "admin-section";
    adminPanel.innerHTML = `
      <div class="admin-card">
        <h3>🔧 Админ-панель</h3>
        <div class="admin-controls">
          <button id="force-start-btn" class="btn btn-danger">
            🚀 Начать игру сейчас!
          </button>
          <button id="reset-game-btn" class="btn btn-warning">
            🔄 Сбросить игру
          </button>
        </div>
        <div class="admin-info">
          <p><strong>Статус:</strong> <span id="admin-status">Готов</span></p>
          <p><strong>Игроков:</strong> <span id="admin-players">0</span></p>
        </div>
      </div>
    `;

    // Вставляем админ-панель после лобби
    const lobbySection = mainScreen.querySelector(".lobby-section");
    if (lobbySection) {
      lobbySection.insertAdjacentElement("afterend", adminPanel);
    } else {
      mainScreen.appendChild(adminPanel);
    }

    // Добавляем обработчики событий
    const forceStartBtn = document.getElementById("force-start-btn");
    const resetGameBtn = document.getElementById("reset-game-btn");

    if (forceStartBtn) {
      forceStartBtn.addEventListener("click", () => {
        this.forceStartGame();
      });
    }

    if (resetGameBtn) {
      resetGameBtn.addEventListener("click", () => {
        this.resetGame();
      });
    }
  }

  forceStartGame() {
    if (this.socket && this.isAdmin) {
      // Отправляем команду на сервер для принудительного старта
      this.socket.emit("admin:forceStart", {
        adminId: this.playerData.id,
      });

      // Обновляем статус в админ-панели
      const statusElement = document.getElementById("admin-status");
      if (statusElement) {
        statusElement.textContent = "Запуск игры...";
        statusElement.style.color = "var(--warning-color)";
      }

      // Отключаем кнопку на время
      const forceBtn = document.getElementById("force-start-btn");
      if (forceBtn) {
        forceBtn.disabled = true;
        forceBtn.textContent = "⏳ Запуск...";

        setTimeout(() => {
          forceBtn.disabled = false;
          forceBtn.textContent = "🚀 Начать игру сейчас!";
        }, 3000);
      }
    }
  }

  resetGame() {
    if (this.socket && this.isAdmin) {
      this.socket.emit("admin:resetGame", {
        adminId: this.playerData.id,
      });

      const statusElement = document.getElementById("admin-status");
      if (statusElement) {
        statusElement.textContent = "Сброс игры...";
        statusElement.style.color = "var(--danger-color)";
      }
    }
  }

  async connectToServer() {
    try {
      this.socket = io();

      this.socket.on("connect", () => {
        console.log("Connected to server");
        // Не присоединяемся к лобби автоматически, только после покупки
      });

      this.socket.on("disconnect", () => {
        console.log("Disconnected from server");
        this.showError("Соединение потеряно. Переподключение...");
      });

      this.socket.on("lobby-update", (data) => {
        console.log("Lobby update received:", data);
        this.updateLobby(data);

        // Обновляем админ-панель если она есть
        if (this.isAdmin) {
          const playersElement = document.getElementById("admin-players");
          if (playersElement) {
            playersElement.textContent = data.totalPlayers;
          }
        }
      });

      this.socket.on("next-game-time", (nextGameTime) => {
        console.log("Next game time received:", nextGameTime);
        this.updateGameTimer(nextGameTime);
      });

      this.socket.on("game-started", (data) => {
        this.startGame(data);

        if (this.isAdmin) {
          const statusElement = document.getElementById("admin-status");
          if (statusElement) {
            statusElement.textContent = "Игра запущена";
            statusElement.style.color = "var(--success-color)";
          }
        }
      });

      this.socket.on("game-ended", (data) => {
        this.endGame(data);

        if (this.isAdmin) {
          const statusElement = document.getElementById("admin-status");
          if (statusElement) {
            statusElement.textContent = "Игра окончена";
            statusElement.style.color = "var(--primary-color)";
          }
        }
      });

      this.socket.on("game-state", (data) => {
        this.updateGameState(data);
      });

      // Админ-события
      this.socket.on("admin:gameForceStarted", () => {
        if (this.isAdmin) {
          const statusElement = document.getElementById("admin-status");
          if (statusElement) {
            statusElement.textContent = "Игра принудительно запущена";
            statusElement.style.color = "var(--success-color)";
          }
        }
      });

      this.socket.on("admin:gameReset", () => {
        if (this.isAdmin) {
          const statusElement = document.getElementById("admin-status");
          if (statusElement) {
            statusElement.textContent = "Игра сброшена";
            statusElement.style.color = "var(--primary-color)";
          }

          // Перезагружаем лобби
          this.showScreen("lobby");
        }
      });

      this.socket.on("admin:error", (data) => {
        if (this.isAdmin) {
          this.showError(`Админ ошибка: ${data.message}`);
        }
      });
    } catch (error) {
      console.error("Socket connection error:", error);
      this.showError("Ошибка подключения к серверу");
    }
  }

  setupEventListeners() {
    // Ball count slider
    const ballCountSlider = document.getElementById("ballCount");
    const ballCountDisplay = document.getElementById("ballCountDisplay");

    ballCountSlider.addEventListener("input", (e) => {
      ballCountDisplay.textContent = e.target.value;
    });

    // Buy balls button
    document.getElementById("buyBallsBtn").addEventListener("click", () => {
      this.buyBalls();
    });

    // Game controls
    document.getElementById("backToLobbyBtn").addEventListener("click", () => {
      this.showScreen("main");
    });

    document.getElementById("newGameBtn").addEventListener("click", () => {
      this.showScreen("main");
    });

    // Share button (if exists)
    const shareBtn = document.getElementById("shareResultBtn");
    if (shareBtn) {
      shareBtn.addEventListener("click", () => {
        this.shareGame();
      });
    }

    // Back to main button (if exists)
    const backToMainBtn = document.getElementById("backToMainBtn");
    if (backToMainBtn) {
      backToMainBtn.addEventListener("click", () => {
        this.showScreen("main");
      });
    }
  }

  // Game methods
  startGame(gameData) {
    console.log("Game started:", gameData);

    // Initialize game renderer
    if (!this.gameRenderer) {
      this.gameRenderer = new GameRenderer("gameCanvas");
    }

    this.gameRenderer.initGame(gameData);

    // Show game screen
    this.showScreen("game");

    // Update UI
    const gameStatus = document.getElementById("gameStatus");
    if (gameStatus) {
      gameStatus.textContent = "Игра началась!";
    }

    // Clear any existing timer
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
    }

    // Start game timer
    this.startGameTimeCounter(gameData.startTime);
  }

  endGame(gameData) {
    console.log("Game ended:", gameData);

    // Stop renderer
    if (this.gameRenderer) {
      this.gameRenderer.stopRenderLoop();
    }

    // Clear game timer
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
    }

    // Show results
    this.showGameResults(gameData);
  }

  updateGameState(gameData) {
    if (this.gameRenderer) {
      this.gameRenderer.updateGame(gameData);
    }
  }

  startGameTimeCounter(startTime) {
    const gameTimeElement = document.getElementById("gameTime");
    if (!gameTimeElement) return;

    this.gameTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      gameTimeElement.textContent = `${minutes}:${seconds
        .toString()
        .padStart(2, "0")}`;
    }, 1000);
  }

  showGameResults(gameData) {
    const resultsScreen = document.getElementById("resultsScreen");
    const winnerCard = document.getElementById("winnerCard");
    const winnerInfo = document.getElementById("winnerInfo");
    const resultsList = document.getElementById("resultsList");

    if (!resultsScreen || !winnerCard || !winnerInfo || !resultsList) {
      console.error("Results screen elements not found");
      return;
    }

    // Show winner
    if (gameData.winner) {
      winnerInfo.innerHTML = `
        <h4>🏆 ${gameData.winner.playerName}</h4>
        <p>Время: ${(
          (gameData.winner.finishTime - gameData.startTime) /
          1000
        ).toFixed(2)}с</p>
      `;
    } else {
      winnerInfo.innerHTML = `
        <h4>⏰ Время вышло</h4>
        <p>Никто не добрался до финиша</p>
      `;
    }

    // Show all results
    if (gameData.results && gameData.results.length > 0) {
      resultsList.innerHTML = gameData.results
        .map(
          (result, index) => `
        <div class="result-item">
          <span class="position">${index + 1}</span>
          <span class="player-name">${result.playerName}</span>
          <span class="result-status">
            ${
              result.finished
                ? `✅ ${(
                    (result.finishTime - gameData.startTime) /
                    1000
                  ).toFixed(2)}с`
                : "❌ Не финишировал"
            }
          </span>
        </div>
      `
        )
        .join("");
    } else {
      resultsList.innerHTML = "<p>Нет данных о результатах</p>";
    }

    // Show results screen
    this.showScreen("results");
  }

  showScreen(screenName) {
    // Hide all screens
    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.remove("active");
    });

    // Show target screen - для main экрана не скрываем, он всегда активен
    if (screenName === "main") {
      document.getElementById("mainScreen").classList.add("active");
    } else {
      document.getElementById(screenName + "Screen").classList.add("active");
    }
    this.gameState.currentScreen = screenName;
  }

  updateLobby(data) {
    document.getElementById("playerCount").textContent = data.totalPlayers;

    const playerList = document.getElementById("playerList");

    if (data.totalPlayers === 0) {
      playerList.innerHTML = `
        <div class="empty-lobby">
          <p>👥 Ожидание игроков...</p>
          <p>Купите шарики, чтобы присоединиться к игре!</p>
        </div>
      `;
    } else {
      playerList.innerHTML = "";
      data.players.forEach((player) => {
        const playerElement = document.createElement("div");
        playerElement.className = "player-item";
        playerElement.innerHTML = `
          <span class="player-name">${player.username}</span>
          <span class="player-balls">${player.ballCount} 🎱</span>
        `;
        playerList.appendChild(playerElement);
      });
    }
  }

  updateGameTimer(nextGameTime) {
    const updateTimer = () => {
      const now = Date.now();
      const timeLeft = Math.max(0, nextGameTime - now);

      if (timeLeft === 0) {
        document.getElementById("gameTimer").textContent =
          "⚡ Игра начинается!";
        document.getElementById("gameTimer").classList.add("pulse");
        return;
      }

      const minutes = Math.floor(timeLeft / 60000);
      const seconds = Math.floor((timeLeft % 60000) / 1000);

      document.getElementById("gameTimer").textContent = `${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

      setTimeout(updateTimer, 1000);
    };

    updateTimer();
  }

  startGameTimerUpdate() {
    // Fetch game info every 30 seconds
    const fetchGameInfo = async () => {
      try {
        const response = await fetch("/api/game-info");
        const data = await response.json();
        this.updateGameTimer(data.nextGameTime);
      } catch (error) {
        console.error("Failed to fetch game info:", error);
      }
    };

    fetchGameInfo();
    setInterval(fetchGameInfo, 30000);
  }

  async buyBalls() {
    const ballCount = parseInt(document.getElementById("ballCount").value);
    const buyButton = document.getElementById("buyBallsBtn");

    buyButton.classList.add("loading");
    buyButton.disabled = true;

    try {
      if (window.Telegram?.WebApp) {
        // Use Telegram Stars for payment
        await this.processTelegramStarsPayment(ballCount);
      } else {
        // Simulate payment for development
        await this.simulatePayment(ballCount);
      }
    } catch (error) {
      console.error("Payment failed:", error);
      this.showNotification("Ошибка оплаты", "error");
    } finally {
      buyButton.classList.remove("loading");
      buyButton.disabled = false;
    }
  }

  async processTelegramStarsPayment(ballCount) {
    const tg = window.Telegram.WebApp;

    // TODO: Implement actual Telegram Stars payment
    // For now, simulate the payment process
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate payment success
        this.completePurchase(ballCount);
        resolve();
      }, 2000);
    });
  }

  async simulatePayment(ballCount) {
    const response = await fetch("/api/buy-balls", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: this.playerData.id,
        username: this.playerData.username,
        ballCount: ballCount,
        paymentData: { simulated: true },
      }),
    });

    const result = await response.json();

    if (result.success) {
      this.completePurchase(ballCount);
    } else {
      throw new Error(result.error);
    }
  }

  completePurchase(ballCount) {
    this.gameState.playerBalls += ballCount;
    this.showNotification(`Куплено ${ballCount} шариков! 🎱`, "success");

    // Update UI
    document.getElementById("ballCount").value = 10;
    document.getElementById("ballCountDisplay").textContent = "10";

    // Update player ball count display
    const playerBallCount = document.getElementById("playerBallCount");
    if (playerBallCount) {
      playerBallCount.textContent = this.gameState.playerBalls;
    }

    // Join lobby after first purchase
    if (!this.hasJoinedLobby) {
      this.joinLobby();
      this.hasJoinedLobby = true;

      // Показываем уведомление о присоединении к лобби
      setTimeout(() => {
        this.showNotification("🎮 Вы присоединились к лобби!", "success");
      }, 1000);
    }
  }

  onGameStarted(gameData) {
    console.log("Game started:", gameData);
    this.gameState.currentGame = gameData;
    this.showScreen("game");
    this.showNotification("Игра началась! 🏁", "success");

    // Initialize game renderer
    if (window.GameRenderer) {
      window.gameRenderer = new GameRenderer("gameCanvas");
      window.gameRenderer.initGame(gameData);
    }
  }

  onGameUpdate(gameData) {
    if (window.gameRenderer) {
      window.gameRenderer.updateGame(gameData);
    }

    // Update game time
    const gameTime = Math.floor(gameData.gameTime / 1000);
    const minutes = Math.floor(gameTime / 60);
    const seconds = gameTime % 60;
    document.getElementById("gameTime").textContent = `${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

    // Update total balls count
    document.getElementById(
      "totalBalls"
    ).textContent = `Всего шариков: ${gameData.balls.length}`;
  }

  onGameEnded(resultData) {
    console.log("Game ended:", resultData);
    this.gameState.currentGame = null;

    // Show results
    document.getElementById("winnerName").textContent =
      resultData.winner.username;
    this.showScreen("results");

    // Show celebration
    this.showNotification(
      `🏆 Победитель: ${resultData.winner.username}!`,
      "success"
    );

    // Show main button for Telegram
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.MainButton.show();
    }
  }

  shareGame() {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      const message = `🏁 Присоединяйся к Ball Race! Многопользовательская гонка шариков в Telegram!`;

      tg.sendData(
        JSON.stringify({
          action: "share_game",
          message: message,
        })
      );
    } else {
      // Fallback for development
      if (navigator.share) {
        navigator.share({
          title: "Ball Race",
          text: "Присоединяйся к Ball Race!",
          url: window.location.href,
        });
      }
    }
  }

  showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  showError(message) {
    this.showNotification(message, "error");
    console.error("App Error:", message);
  }

  joinLobby() {
    if (this.socket && this.playerData) {
      this.socket.emit("join-lobby", {
        userId: this.playerData.id,
        username: this.playerData.username,
      });
    }
  }
}

// Initialize app when page loads
document.addEventListener("DOMContentLoaded", () => {
  window.ballRaceApp = new BallRaceApp();
});
