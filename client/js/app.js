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
      // Make app globally accessible
      window.app = this;
      
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
        // Присоединяемся к лобби сразу при подключении
        this.joinLobby();
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
      this.socket.on("player-stats", (data) => {
        console.log("Player stats received:", data);
        this.gameState.playerBalls = data.ballCount;
        this.updatePlayerBallDisplay();

        // Update profile data if on profile screen
        if (this.gameState.currentScreen === "profile") {
          this.updateProfileData();
        }
      });

      this.socket.on("error", (data) => {
        console.error("Server error:", data);
        this.showNotification(data.message, "error");
      });

      this.socket.on("info", (data) => {
        console.log("Server info:", data);
        this.showNotification(data.message, "info");
      });
    } catch (error) {
      console.error("Socket connection error:", error);
      this.showError("Ошибка подключения к серверу");
    }
  }

  setupEventListeners() {
    // Ball count controls
    const ballCountInput = document.getElementById("ballCount");
    const totalCostElement = document.getElementById("totalCost");

    // Counter buttons
    document.querySelectorAll('.counter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const change = parseInt(btn.dataset.change);
        const currentValue = parseInt(ballCountInput.value);
        const newValue = Math.max(1, Math.min(50, currentValue + change));
        ballCountInput.value = newValue;
        this.updateTotalCost();
      });
    });

    // Quick select buttons
    document.querySelectorAll('.quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const value = parseInt(btn.dataset.value);
        ballCountInput.value = value;
        this.updateTotalCost();
        
        // Visual feedback
        document.querySelectorAll('.quick-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        setTimeout(() => btn.classList.remove('active'), 300);
      });
    });

    // Manual input
    ballCountInput.addEventListener('input', () => {
      this.updateTotalCost();
    });

    // Initial cost update
    this.updateTotalCost();

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

    // Camera controls
    const followBallBtn = document.getElementById("followBallBtn");
    const topViewBtn = document.getElementById("topViewBtn");
    const finishViewBtn = document.getElementById("finishViewBtn");

    if (followBallBtn) {
      followBallBtn.addEventListener("click", () => {
        if (this.gameRenderer) {
          this.gameRenderer.setCameraMode('follow');
        }
      });
    }

    if (topViewBtn) {
      topViewBtn.addEventListener("click", () => {
        if (this.gameRenderer) {
          this.gameRenderer.setCameraMode('top');
        }
      });
    }

    if (finishViewBtn) {
      finishViewBtn.addEventListener("click", () => {
        if (this.gameRenderer) {
          this.gameRenderer.setCameraMode('finish');
        }
      });
    }

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

    // Start game button
    document.getElementById("startGameBtn").addEventListener("click", () => {
      this.requestStartGame();
    });

    // Tab navigation
    document.querySelectorAll(".tab-button").forEach((button) => {
      button.addEventListener("click", () => {
        const tabName = button.dataset.tab;
        this.switchTab(tabName);
      });
    });
  }

  // Game methods
  startGame(gameData) {
    console.log("Game started:", gameData);

    // Initialize game renderer
    if (!this.gameRenderer) {
      if (typeof GameRenderer !== "undefined") {
        this.gameRenderer = new GameRenderer("gameCanvas");
      } else {
        console.error("GameRenderer not loaded!");
        this.showNotification("Ошибка загрузки игрового движка", "error");
        return;
      }
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

    // Show target screen
    if (screenName === "main") {
      document.getElementById("mainScreen").classList.add("active");
    } else if (screenName === "profile") {
      document.getElementById("profileScreen").classList.add("active");
      this.updateProfileData();
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

    if (!this.socket || !this.socket.connected) {
      this.showNotification("Нет соединения с сервером", "error");
      return;
    }

    if (ballCount <= 0 || ballCount > 50) {
      this.showNotification("Неверное количество шариков (1-50)", "error");
      return;
    }

    buyButton.classList.add("loading");
    buyButton.disabled = true;
    buyButton.textContent = "💰 Покупка...";

    try {
      // Check if we're in Telegram environment
      if (window.Telegram?.WebApp) {
        await this.processTelegramStarsPayment(ballCount);
      } else {
        // Development mode - use socket for quick testing
        await this.simulateSocketPayment(ballCount);
      }
    } catch (error) {
      console.error("Purchase failed:", error);
      this.showNotification("Ошибка покупки: " + error.message, "error");
    } finally {
      setTimeout(() => {
        buyButton.classList.remove("loading");
        buyButton.disabled = false;
        buyButton.textContent = "✨ Купить шарики";
      }, 1500);
    }
  }

  async processTelegramStarsPayment(ballCount) {
    const tg = window.Telegram.WebApp;
    const totalStars = ballCount * 50; // 50 stars per ball

    return new Promise((resolve, reject) => {
      // Create invoice for Telegram Stars
      const invoice = {
        title: `${ballCount} шариков для Ball Race`,
        description: `Покупка ${ballCount} шариков для участия в гонке`,
        currency: "XTR", // Telegram Stars currency
        prices: [{ label: `${ballCount} шариков`, amount: totalStars }],
        payload: JSON.stringify({
          userId: this.playerData.id,
          ballCount: ballCount,
          timestamp: Date.now()
        })
      };

      // Request payment
      tg.showPopup({
        title: "Покупка шариков",
        message: `Купить ${ballCount} шариков за ${totalStars} ⭐?`,
        buttons: [
          { id: "cancel", type: "cancel", text: "Отмена" },
          { id: "pay", type: "default", text: `Купить за ${totalStars} ⭐` }
        ]
      }, (buttonId) => {
        if (buttonId === "pay") {
          // In real implementation, you would use tg.requestPayment()
          // For now, simulate successful payment
          this.completeTelegramPayment(ballCount, resolve, reject);
        } else {
          reject(new Error("Платеж отменен"));
        }
      });
    });
  }

  async completeTelegramPayment(ballCount, resolve, reject) {
    try {
      // Send payment confirmation to server
      const response = await fetch("/api/buy-balls", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: this.playerData.id,
          username: this.playerData.username,
          ballCount: ballCount,
          paymentData: {
            amount: ballCount * 50,
            currency: "XTR",
            verified: true // In real app, this would come from Telegram
          },
          initData: window.Telegram?.WebApp?.initData || null
        }),
      });

      const result = await response.json();

      if (result.success) {
        this.gameState.playerBalls = result.ballCount;
        this.updatePlayerBallDisplay();
        this.showNotification(result.message || `Куплено ${ballCount} шариков! 🎱`, "success");
        
        // Notify via socket for real-time lobby update
        this.socket.emit("buy-balls", { ballCount });
        
        resolve(result);
      } else {
        reject(new Error(result.error || "Ошибка покупки"));
      }
    } catch (error) {
      reject(error);
    }
  }

  async simulateSocketPayment(ballCount) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error("Нет соединения с сервером"));
        return;
      }

      // Listen for response
      const timeout = setTimeout(() => {
        reject(new Error("Тайм-аут покупки"));
      }, 5000);

      this.socket.once("player-stats", (data) => {
        clearTimeout(timeout);
        this.showNotification(`Куплено ${ballCount} шариков! Всего: ${data.ballCount}`, "success");
        resolve(data);
      });

      this.socket.once("error", (error) => {
        clearTimeout(timeout);
        reject(new Error(error.message || "Ошибка покупки"));
      });

      // Send purchase request
      this.socket.emit("buy-balls", { ballCount });
    });
  }

  updatePlayerBallDisplay() {
    const playerBallElements = document.querySelectorAll("#playerBallCount");
    playerBallElements.forEach(element => {
      if (element) {
        element.textContent = this.gameState.playerBalls;
      }
    });

    // Update start button state
    const startBtn = document.getElementById("startGameBtn");
    if (startBtn) {
      startBtn.disabled = this.gameState.playerBalls === 0;
      if (this.gameState.playerBalls > 0) {
        startBtn.textContent = "🚀 Начать игру";
        startBtn.classList.remove("disabled");
      } else {
        startBtn.textContent = "🚀 Сначала купите шарики";
        startBtn.classList.add("disabled");
      }
    }
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
  }

  onGameStarted(gameData) {
    console.log("Game started:", gameData);
    this.gameState.currentGame = gameData;
    this.startGame(gameData); // Use the main startGame method
    this.showNotification("Игра началась! 🏁", "success");
  }

  onGameUpdate(gameData) {
    if (this.gameRenderer) {
      this.gameRenderer.updateGame(gameData);
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
    // Create notification element
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">
          ${
            type === "success"
              ? "✅"
              : type === "error"
              ? "❌"
              : type === "warning"
              ? "⚠️"
              : "ℹ️"
          }
        </span>
        <span class="notification-message">${message}</span>
      </div>
    `;

    // Add to document
    document.body.appendChild(notification);

    // Show with animation
    setTimeout(() => notification.classList.add("show"), 100);

    // Auto remove after 3 seconds
    setTimeout(() => {
      notification.classList.remove("show");
      setTimeout(() => notification.remove(), 300);
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

  requestStartGame() {
    if (!this.socket || !this.socket.connected) {
      this.showNotification("Нет соединения с сервером", "error");
      return;
    }

    if (this.gameState.playerBalls === 0) {
      this.showNotification("Сначала купите шарики!", "warning");
      return;
    }

    const startBtn = document.getElementById("startGameBtn");
    startBtn.disabled = true;
    startBtn.textContent = "⏳ Запуск...";

    this.socket.emit("start-game");

    setTimeout(() => {
      startBtn.disabled = false;
      startBtn.textContent = "🚀 Начать игру";
    }, 3000);
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll(".tab-button").forEach((btn) => {
      btn.classList.remove("active");
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");

    // Update screens
    if (tabName === "game") {
      this.showScreen("main");
    } else if (tabName === "profile") {
      this.showScreen("profile");
      this.updateProfileData();
    }
  }

  updateProfileData() {
    if (this.playerData) {
      // Update profile info
      const profileName = document.getElementById("profileName");
      const profileUsername = document.getElementById("profileUsername");
      const profileAvatar = document.getElementById("profileAvatar");

      if (profileName)
        profileName.textContent =
          this.playerData.firstName || this.playerData.username;
      if (profileUsername)
        profileUsername.textContent = `@${this.playerData.username}`;
      if (profileAvatar) {
        // Use first letter of name as avatar
        profileAvatar.textContent = (this.playerData.firstName ||
          this.playerData.username)[0].toUpperCase();
      }

      // Update stats
      const totalBallsOwned = document.getElementById("totalBallsOwned");
      if (totalBallsOwned)
        totalBallsOwned.textContent = this.gameState.playerBalls;
    }
  }

  updateTotalCost() {
    const ballCount = parseInt(document.getElementById("ballCount").value) || 1;
    const totalCost = ballCount * 50; // 50 stars per ball from config
    const totalCostElement = document.getElementById("totalCost");
    if (totalCostElement) {
      totalCostElement.textContent = totalCost;
    }
  }
}

// Initialize app when page loads
document.addEventListener("DOMContentLoaded", () => {
  window.ballRaceApp = new BallRaceApp();
});
