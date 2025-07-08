// Простой тест конфигурации
console.log('🔧 Тестируем конфигурацию...');

try {
  const config = require('./config');
  console.log('✅ Модуль config загружен успешно');
  
  console.log('\n📋 Основная информация:');
  console.log(`Название: ${config.app.name}`);
  console.log(`Версия: ${config.app.version}`);
  console.log(`Порт: ${config.server.port}`);
  console.log(`Среда: ${config.server.environment}`);
  
  console.log('\n🎮 Игровые настройки:');
  console.log(`Цена шара: ${config.game.settings.ballPrice}`);
  console.log(`Макс. игроков: ${config.game.settings.maxPlayers}`);
  console.log(`Интервал игры: ${config.getGameInterval()}ms`);
  
  console.log('\n👥 Админы:');
  console.log(`IDs: ${config.admins.ids.join(', ')}`);
  
  console.log('\n✅ Все проверки пройдены успешно!');
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
}
