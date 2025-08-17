const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://dogcrash:5hRPJyResaF75MPh@124.223.21.118:27017/dogcrash', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            // 连接池配置
            maxPoolSize: 10, // 最大连接数
            minPoolSize: 5,  // 最小连接数
            maxIdleTimeMS: 30000, // 连接空闲时间
            // 重连配置
            serverSelectionTimeoutMS: 5000, // 服务器选择超时
            socketTimeoutMS: 45000, // Socket超时
            connectTimeoutMS: 10000, // 连接超时
            heartbeatFrequencyMS: 10000, // 心跳频率
            // 缓冲配置
            bufferCommands: false, // 禁用命令缓冲
        });

        console.log(`MongoDB Connected: ${conn.connection.host}`);

        // 监听连接事件
        mongoose.connection.on('connected', () => {
            console.log('Mongoose connected to MongoDB');
        });

        mongoose.connection.on('error', (err) => {
            console.error('Mongoose connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('Mongoose disconnected from MongoDB');
            // 自动重连机制
            setTimeout(() => {
                console.log('Attempting to reconnect to MongoDB...');
                mongoose.connect(process.env.MONGODB_URI || 'mongodb://dogcrash:5hRPJyResaF75MPh@124.223.21.118:27017/dogcrash');
            }, 5000); // 5秒后重连
        });

        // 优雅关闭数据库连接
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            console.log('MongoDB connection closed due to app termination');
            process.exit(0);
        });

    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        process.exit(1);
    }
};

module.exports = connectDB;