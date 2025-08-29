const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const connectDB = require('./config/database');
const config = require('./config/server');

// 路由导入
const userRoutes = require('./routes/user');
const gameRoutes = require('./routes/game');
const raceRoutes = require('./routes/race');

// 中间件导入
const errorHandler = require('./middleware/errorHandler');
const validation = require('./middleware/validation');
const customBodyParser = require('./middleware/bodyParser');

// 服务导入
const raceManager = require('./services/raceManager');
const gameCountdownManager = require('./services/gameCountdownManager');

const app = express();

// 连接数据库
connectDB();

// 基础中间件
app.use(helmet()); // 安全头
app.use(cors(config.cors)); // CORS
app.use(morgan('combined')); // 日志

// 标准body解析中间件
app.use(express.json({ limit: '10mb' })); // JSON解析
app.use(express.urlencoded({ extended: true })); // URL编码解析

// 自定义body解析中间件（处理数据类型转换）
app.use(customBodyParser);

// 设置CSP头部以允许内联脚本
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "script-src 'self' 'unsafe-inline'; object-src 'none';");
    next();
});

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 健康检查端点
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.nodeEnv,
        version: '1.0.0'
    });
});

// API路由
app.use(`${config.api.prefix}/user`, userRoutes);
app.use(`${config.api.prefix}/game`, gameRoutes);
app.use(`${config.api.prefix}/race`, raceRoutes);

// 404处理
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
    });
});

// 错误处理中间件
app.use(errorHandler);

// 启动服务器
const PORT = config.port;
const server = app.listen(PORT, () => {
    console.log(`🚀 Dog Crash Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${config.nodeEnv}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🎮 API endpoint: http://localhost:${PORT}${config.api.prefix}`);
    
    // 初始化游戏倒计时管理器
    try {
        gameCountdownManager.initialize();
        console.log('⏰ Game Countdown Manager initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize Game Countdown Manager:', error);
    }
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    
    // 清理游戏倒计时管理器
    try {
        gameCountdownManager.cleanup();
        console.log('⏰ Game Countdown Manager cleaned up');
    } catch (error) {
        console.error('❌ Error cleaning up Game Countdown Manager:', error);
    }
    
    server.close(() => {
        console.log('Process terminated');
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    
    // 清理游戏倒计时管理器
    try {
        gameCountdownManager.cleanup();
        console.log('⏰ Game Countdown Manager cleaned up');
    } catch (error) {
        console.error('❌ Error cleaning up Game Countdown Manager:', error);
    }
    
    server.close(() => {
        console.log('Process terminated');
    });
});

module.exports = app;