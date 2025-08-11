const config = require('../config/server');

const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // 记录错误日志
    console.error('Error Details:', {
        message: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
    });

    // Mongoose 验证错误
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message).join(', ');
        error = {
            statusCode: 400,
            message: `Validation Error: ${message}`
        };
    }

    // Mongoose 重复键错误
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        const value = err.keyValue[field];
        error = {
            statusCode: 400,
            message: `Duplicate field value: ${field} = ${value}. Please use another value.`
        };
    }

    // Mongoose 无效 ObjectId 错误
    if (err.name === 'CastError') {
        error = {
            statusCode: 400,
            message: 'Invalid ID format'
        };
    }

    // JWT 错误
    if (err.name === 'JsonWebTokenError') {
        error = {
            statusCode: 401,
            message: 'Invalid token'
        };
    }

    // JWT 过期错误
    if (err.name === 'TokenExpiredError') {
        error = {
            statusCode: 401,
            message: 'Token expired'
        };
    }

    // 默认错误
    const statusCode = error.statusCode || err.statusCode || 500;
    const message = error.message || 'Internal Server Error';

    // 构建错误响应
    const errorResponse = {
        error: statusCode === 500 ? 'Internal Server Error' : 'Request Error',
        message: message,
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        method: req.method
    };

    // 在开发环境中包含错误堆栈
    if (config.nodeEnv === 'development') {
        errorResponse.stack = err.stack;
        errorResponse.details = error;
    }

    // 如果是服务器错误，不暴露详细信息给客户端
    if (statusCode === 500 && config.nodeEnv === 'production') {
        errorResponse.message = 'Something went wrong on our end. Please try again later.';
    }

    res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;