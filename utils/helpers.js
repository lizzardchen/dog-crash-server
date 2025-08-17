const { v4: uuidv4 } = require('uuid');

/**
 * 生成唯一ID
 */
const generateUUID = () => {
    return uuidv4();
};

/**
 * 生成用户ID（时间戳 + 随机字符串）
 */
const generateUserId = () => {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 12);
    return `${timestamp}_${randomStr}`;
};

/**
 * 生成会话ID
 */
const generateSessionId = (userId = null) => {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    const prefix = userId ? `${userId.substring(0, 8)}_` : '';
    return `${prefix}${timestamp}_${randomStr}`;
};

/**
 * 格式化数字为短文本（如：1000 -> 1K, 1000000 -> 1M）
 */
const formatNumber = (num) => {
    if (num >= 1000000000) {
        return (num / 1000000000).toFixed(1) + 'B';
    }
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
};

/**
 * 验证用户ID格式
 */
const isValidUserId = (userId) => {
    if (!userId || typeof userId !== 'string') return false;
    if (userId.length < 5 || userId.length > 50) return false;
    return /^[a-zA-Z0-9_-]+$/.test(userId);
};

/**
 * 验证倍数值
 */
const isValidMultiplier = (multiplier) => {
    const num = parseFloat(multiplier);
    return !isNaN(num) && num >= 1.0 && num <= 1000;
};

/**
 * 验证下注金额
 */
const isValidBetAmount = (amount, minBet = 0, maxBet = 1000000) => {
    const num = parseFloat(amount);
    return !isNaN(num) && num >= minBet && num <= maxBet;
};

/**
 * 计算胜率百分比
 */
const calculateWinRate = (wins, total) => {
    if (total === 0) return 0;
    return Math.round((wins / total) * 100);
};

/**
 * 格式化时间为可读字符串
 */
const formatDuration = (milliseconds) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
};

/**
 * 延迟执行函数
 */
const delay = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * 安全的JSON解析
 */
const safeJsonParse = (jsonString, defaultValue = null) => {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        return defaultValue;
    }
};

/**
 * 深度克隆对象
 */
const deepClone = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (typeof obj === 'object') {
        const cloned = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = deepClone(obj[key]);
            }
        }
        return cloned;
    }
};

/**
 * 获取随机数（指定范围）
 */
const getRandomNumber = (min, max) => {
    return Math.random() * (max - min) + min;
};

/**
 * 获取随机整数（指定范围）
 */
const getRandomInt = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * 数组去重
 */
const uniqueArray = (arr) => {
    return [...new Set(arr)];
};

/**
 * 检查对象是否为空
 */
const isEmpty = (obj) => {
    if (obj == null) return true;
    if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0;
    return Object.keys(obj).length === 0;
};

/**
 * 限制数字在指定范围内
 */
const clamp = (num, min, max) => {
    return Math.min(Math.max(num, min), max);
};

/**
 * 生成崩盘倍数（简单算法）
 */
const generateCrashMultiplier = () => {
    const random = Math.random();

    // 基于概率的崩盘倍数生成
    if (random < 0.5) {
        // 50% 概率：1.0x - 3.0x
        return 1.0 + Math.random() * 2.0;
    } else if (random < 0.8) {
        // 30% 概率：3.0x - 5.0x
        return 3.0 + Math.random() * 2.0;
    } else if (random < 0.95) {
        // 15% 概率：5.0x - 10.0x
        return 5.0 + Math.random() * 5.0;
    } else {
        // 5% 概率：10.0x - 100.0x
        return 10.0 + Math.random() * 90.0;
    }
};

/**
 * 验证游戏会话数据
 */
const validateGameSession = (sessionData) => {
    const { userId, betAmount, multiplier, isWin } = sessionData;

    if (!isValidUserId(userId)) {
        return { valid: false, error: 'Invalid user ID' };
    }

    if (!isValidBetAmount(betAmount)) {
        return { valid: false, error: 'Invalid bet amount' };
    }

    if (!isValidMultiplier(multiplier)) {
        return { valid: false, error: 'Invalid multiplier' };
    }

    if (typeof isWin !== 'boolean') {
        return { valid: false, error: 'Invalid win status' };
    }

    return { valid: true };
};

/**
 * 格式化API响应
 */
const formatApiResponse = (success, data = null, message = null, error = null) => {
    const response = {
        success,
        timestamp: new Date().toISOString()
    };

    if (data !== null) response.data = data;
    if (message !== null) response.message = message;
    if (error !== null) response.error = error;

    return response;
};

module.exports = {
    generateUUID,
    generateUserId,
    generateSessionId,
    formatNumber,
    isValidUserId,
    isValidMultiplier,
    isValidBetAmount,
    calculateWinRate,
    formatDuration,
    delay,
    safeJsonParse,
    deepClone,
    getRandomNumber,
    getRandomInt,
    uniqueArray,
    isEmpty,
    clamp,
    generateCrashMultiplier,
    validateGameSession,
    formatApiResponse
};