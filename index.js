const mineflayer = require('mineflayer');
const TelegramBot = require('node-telegram-bot-api');

// --- НАСТРОЙКИ (Твои данные вставлены) ---
const token = '8217526436:AAHLCjnk4Q0YzuaqLCYDeVuUwonuJg6i4js'; 
const adminId = 8119723042; 
const serverHost = 'funtime.su';
const serverPort = 25565;

// Инициализация Telegram бота
const botTg = new TelegramBot(token, { polling: true });

// Хранилище активных ботов: { 'Ник': объектБота }
const activeBots = {};

console.log('🤖 Telegram бот запущен и ждет команд...');

// --- ЛОГИКА TELEGRAM ---

botTg.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // 1. Проверка безопасности: слушаем только ТЕБЯ
    if (chatId !== adminId) return;
    if (!text) return;

    // 2. Команда: /add Ник Пароль
    if (text.startsWith('/add ')) {
        const args = text.split(' ');
        // Ожидаем: /add Ник Пароль
        if (args.length < 3) {
            botTg.sendMessage(chatId, '⚠️ Ошибка. Пиши так: `/add Ник Пароль`', { parse_mode: 'Markdown' });
            return;
        }
        const nickname = args[1];
        const password = args[2];

        if (activeBots[nickname]) {
            botTg.sendMessage(chatId, `⚠️ Бот ${nickname} уже в игре!`);
            return;
        }

        startMineBot(nickname, password);
    }

    // 3. Команда: /kill Ник (выключить конкретного бота)
    else if (text.startsWith('/kill ')) {
        const nickname = text.split(' ')[1];
        if (activeBots[nickname]) {
            activeBots[nickname].quit();
            // Удаление происходит в событии 'end', но подстрахуемся
            botTg.sendMessage(chatId, `💀 Отключаю ${nickname}...`);
        } else {
            botTg.sendMessage(chatId, `Бот ${nickname} не найден.`);
        }
    }

    // 4. Команда: /chat Ник Текст (отправить сообщение или команду от лица бота)
    else if (text.startsWith('/chat ')) {
        // Пример: /chat Steve /home
        const args = text.split(' ');
        const nickname = args[1];
        const message = args.slice(2).join(' '); // Собираем остальной текст

        if (activeBots[nickname]) {
            activeBots[nickname].chat(message);
            botTg.sendMessage(chatId, `📤 [${nickname}] отправлено: ${message}`);
        } else {
            botTg.sendMessage(chatId, `Бот ${nickname} не найден. Сначала добавь его через /add`);
        }
    }

    // 5. Команда: /list (кто сейчас онлайн)
    else if (text === '/list') {
        const nicks = Object.keys(activeBots);
        if (nicks.length === 0) {
            botTg.sendMessage(chatId, 'Список пуст. Добавь ботов через /add');
        } else {
            botTg.sendMessage(chatId, `🟢 Онлайн боты (${nicks.length}):\n${nicks.join('\n')}`);
        }
    }
    
    else {
        botTg.sendMessage(chatId, 
            "🎮 **Панель управления MC Bot**\n\n" +
            "1️⃣ `/add Ник Пароль` — Запустить бота\n" +
            "2️⃣ `/chat Ник Сообщение` — Написать в чат (или команду /home)\n" +
            "3️⃣ `/kill Ник` — Выключить бота\n" +
            "4️⃣ `/list` — Список ботов", 
            { parse_mode: 'Markdown' }
        );
    }
});

// --- ЛОГИКА MINECRAFT ---

function startMineBot(username, password) {
    botTg.sendMessage(adminId, `⏳ Запускаю ${username} на FunTime...`);

    const bot = mineflayer.createBot({
        host: serverHost,
        port: serverPort,
        username: username,
        version: false // Авто-версия (обычно 1.12.2 - 1.20)
    });

    activeBots[username] = bot;

    // Когда бот зашел на сервер
    bot.on('spawn', () => {
        // Используем once, чтобы сработало только при первом заходе, а не после смерти
        bot.once('spawn', () => {
            botTg.sendMessage(adminId, `✅ ${username} в лобби! Пробую логин...`);
            
            // Задержка перед вводом пароля (чтобы сервер не кикнул за спам)
            setTimeout(() => {
                bot.chat(`/login ${password}`);
                bot.chat(`/register ${password} ${password}`);
            }, 2000);
        });
    });

    // Пересылка сообщений из игры в ТГ
    bot.on('message', (jsonMsg) => {
        const msg = jsonMsg.toString();
        
        // FunTime очень спамит в чат. Фильтруем только важное.
        // Если хочешь видеть ВСЁ, убери условие if.
        if (
            msg.includes('-> я') || // ЛС
            msg.includes('телепортац') || // Запросы тп
            msg.toLowerCase().includes('капч') || // Просьба ввести капчу
            msg.includes('!') // Глобальный чат (может быть много спама)
        ) {
            // Ограничиваем длину сообщения, чтобы Телеграм не ругался
            if (msg.length < 200) {
               // botTg.sendMessage(adminId, `💬 [${username}]: ${msg}`); 
               // Я закомментировал строку выше, чтобы не спамило. Раскомментируй, если нужно читать чат.
            }
        }
        
        // Логируем в консоль ПК всё равно
        console.log(`[${username}] ${msg}`);
    });

    bot.on('kicked', (reason) => {
        const reasonText = JSON.stringify(reason);
        botTg.sendMessage(adminId, `❌ ${username} кикнут. Причина: ${reasonText}`);
        delete activeBots[username];
    });

    bot.on('error', (err) => {
        console.log(`Ошибка ${username}:`, err);
        // Не спамим ошибками в ТГ, просто удаляем из списка
        if (activeBots[username]) delete activeBots[username];
    });

    bot.on('end', () => {
        console.log(`${username} отключился.`);
        delete activeBots[username];
    });
}
