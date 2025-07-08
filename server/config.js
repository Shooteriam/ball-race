const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor() {
    this.config = null;
    this.loadConfig();
  }

  loadConfig() {
    try {
      // Load main config file
      const configPath = path.join(__dirname, '../config.json');
      const configData = fs.readFileSync(configPath, 'utf8');
      this.config = JSON.parse(configData);

      // Override with environment variables if they exist
      this.loadEnvironmentOverrides();

      console.log('✅ Configuration loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load configuration:', error.message);
      process.exit(1);
    }
  }

  loadEnvironmentOverrides() {
    // Server settings
    if (process.env.PORT) {
      this.config.server.port = parseInt(process.env.PORT);
    }
    if (process.env.NODE_ENV) {
      this.config.server.environment = process.env.NODE_ENV;
    }

    // Telegram settings
    if (process.env.TELEGRAM_BOT_TOKEN) {
      this.config.telegram.botToken = process.env.TELEGRAM_BOT_TOKEN;
    }
    if (process.env.TELEGRAM_WEBHOOK_SECRET) {
      this.config.telegram.webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    }

    // Game settings
    if (process.env.GAME_INTERVAL) {
      this.config.game.settings.gameInterval = parseInt(process.env.GAME_INTERVAL);
    }
    if (process.env.BALL_PRICE) {
      this.config.game.settings.ballPrice = parseInt(process.env.BALL_PRICE);
    }
    if (process.env.MAX_BALLS_PER_PLAYER) {
      this.config.game.settings.maxBallsPerPlayer = parseInt(process.env.MAX_BALLS_PER_PLAYER);
    }
    if (process.env.MAX_PLAYERS) {
      this.config.game.settings.maxPlayers = parseInt(process.env.MAX_PLAYERS);
    }

    // Admin IDs
    if (process.env.ADMIN_IDS) {
      this.config.admins.ids = process.env.ADMIN_IDS.split(',').map(id => id.trim());
    }
  }

  get(path) {
    return this.getNestedValue(this.config, path);
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  // Convenience getters for commonly used config values
  get app() {
    return this.config.app;
  }

  get server() {
    return this.config.server;
  }

  get telegram() {
    return this.config.telegram;
  }

  get game() {
    return this.config.game;
  }

  get admins() {
    return this.config.admins;
  }

  get ui() {
    return this.config.ui;
  }

  get isDevelopment() {
    return this.config.server.environment === 'development';
  }

  get isProduction() {
    return this.config.server.environment === 'production';
  }

  get developmentSettings() {
    return this.config.development;
  }

  get productionSettings() {
    return this.config.production;
  }

  // Check if user is admin
  isAdmin(userId) {
    return this.config.admins.ids.includes(userId.toString());
  }

  // Get current environment settings
  getCurrentEnvironmentSettings() {
    return this.isDevelopment ? this.developmentSettings : this.productionSettings;
  }

  // Get game interval based on environment
  getGameInterval() {
    const envSettings = this.getCurrentEnvironmentSettings();
    if (this.isDevelopment && envSettings.fastGameTimer) {
      return envSettings.testGameInterval;
    }
    return this.config.game.settings.gameInterval;
  }

  // Print current configuration (for debugging)
  printConfig() {
    console.log('\n📋 Current Configuration:');
    console.log('========================');
    console.log(`🌍 Environment: ${this.config.server.environment}`);
    console.log(`🚪 Port: ${this.config.server.port}`);
    console.log(`⏰ Game Interval: ${this.getGameInterval()}ms`);
    console.log(`💰 Ball Price: ${this.config.game.settings.ballPrice} stars`);
    console.log(`🎱 Max Balls: ${this.config.game.settings.maxBallsPerPlayer}`);
    console.log(`👥 Max Players: ${this.config.game.settings.maxPlayers}`);
    console.log(`🔧 Admins: ${this.config.admins.ids.join(', ')}`);
    console.log('========================\n');
  }
}

// Export singleton instance
const configManager = new ConfigManager();
module.exports = configManager;
