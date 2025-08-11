const { validationResult } = require('express-validator');

/**
 * 处理验证错误的中间件
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        const formattedErrors = errors.array().map(error => ({
            field: error.param,
            message: error.msg,
            value: error.value,
            location: error.location
        }));
        
        return res.status(400).json({
            error: 'Validation Error',
            message: 'Request validation failed',
            details: formattedErrors,
            timestamp: new Date().toISOString()
        });
    }
    
    next();
};

/**
 * 请求速率限制中间件
 */
const rateLimit = require('express-rate-limit');

const createRateLimit = (options = {}) => {
    const defaultOptions = {
        windowMs: 15 * 60 * 1000, // 15分钟
        max: 100, // 每个IP最多100个请求
        message: {
            error: 'Too Many Requests',
            message: 'Too many requests from this IP, please try again later.',
            retryAfter: Math.ceil(options.windowMs / 1000 / 60) || 15
        },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            res.status(429).json({
                ...defaultOptions.message,
                timestamp: new Date().toISOString()
            });
        }
    };
    
    return rateLimit({ ...defaultOptions, ...options });
};

/**
 * API速率限制
 */
const apiRateLimit = createRateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100 // 每个IP最多100个请求
});

/**
 * 严格的速率限制（用于敏感操作）
 */
const strictRateLimit = createRateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 20 // 每个IP最多20个请求
});

/**
 * 用户操作速率限制
 */
const userActionRateLimit = createRateLimit({
    windowMs: 1 * 60 * 1000, // 1分钟
    max: 30, // 每分钟最多30个请求
    keyGenerator: (req, res) => {
        // 根据用户ID和IP进行限制，支持IPv6
        const rateLimit = require('express-rate-limit');
        const ip = rateLimit.ipKeyGenerator(req, res);
        return `${req.params.userId || 'anonymous'}_${ip}`;
    }
});

/**
 * 请求大小限制中间件
 */
const requestSizeLimit = (maxSize = '10mb') => {
    return (req, res, next) => {
        const contentLength = req.get('Content-Length');
        const maxSizeBytes = parseSize(maxSize);
        
        if (contentLength && parseInt(contentLength) > maxSizeBytes) {
            return res.status(413).json({
                error: 'Request Too Large',
                message: `Request size exceeds limit of ${maxSize}`,
                timestamp: new Date().toISOString()
            });
        }
        
        next();
    };
};

/**
 * 解析大小字符串为字节数
 */
function parseSize(sizeStr) {
    const units = {
        'b': 1,
        'kb': 1024,
        'mb': 1024 * 1024,
        'gb': 1024 * 1024 * 1024
    };
    
    const match = sizeStr.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
    if (!match) return 0;
    
    const size = parseFloat(match[1]);
    const unit = match[2] || 'b';
    
    return size * units[unit];
}

/**
 * 安全头中间件
 */
const securityHeaders = (req, res, next) => {
    // 防止点击劫持
    res.setHeader('X-Frame-Options', 'DENY');
    
    // 防止MIME类型嗅探
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // XSS保护
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // 推荐HTTPS
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    
    // 控制引用信息
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    next();
};

/**
 * 请求日志中间件
 */
const requestLogger = (req, res, next) => {
    const start = Date.now();
    
    // 记录请求开始
    console.log(`→ ${req.method} ${req.originalUrl} - ${req.ip} - ${new Date().toISOString()}`);
    
    // 监听响应结束
    res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        const statusEmoji = status >= 400 ? '❌' : status >= 300 ? '⚠️' : '✅';
        
        console.log(`← ${statusEmoji} ${status} ${req.method} ${req.originalUrl} - ${duration}ms`);
    });
    
    next();
};

module.exports = {
    handleValidationErrors,
    apiRateLimit,
    strictRateLimit,
    userActionRateLimit,
    requestSizeLimit,
    securityHeaders,
    requestLogger
};