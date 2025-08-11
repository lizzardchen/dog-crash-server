require('dotenv').config();

const config = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    mongoUri: process.env.MONGODB_URI || 'mongodb://dogcrash:5hRPJyResaF75MPh@124.223.21.118:27017/dogcrash',

    // CORS 配置
    cors: {
        origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:7456', 'http://127.0.0.1:7456'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    },

    // API 配置
    api: {
        prefix: '/api',
        version: 'v1'
    },

    // 游戏配置
    game: {
        initialBalance: 1000,
        minBet: 1,
        maxBet: 10000,
        maxHistoryCount: 100
    },

    // 安全配置
    security: {
        rateLimit: {
            windowMs: 15 * 60 * 1000, // 15分钟
            max: 100 // 限制每个IP每15分钟最多100个请求
        }
    }
};

module.exports = config;