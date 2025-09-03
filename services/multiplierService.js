const path = require('path');
const fs = require('fs');

// 加载 MultiplierConfig
let multiplierConfig;
try {
    const configPath = path.join(__dirname, '../config/multiplierConfig.json');
    multiplierConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('MultiplierConfig loaded from file');
} catch (error) {
    console.error('Failed to load MultiplierConfig:', error);
    multiplierConfig = null;
}

/**
 * 生成崩盘倍数（使用配置文件）
 * @returns {number} 生成的崩盘倍数
 */
function generateCrashMultiplier() {
    if (!multiplierConfig || !multiplierConfig.crashConfig) {
        // 降级到简单实现
        return 1.0 + Math.random() * 9.0;
    }

    const random = Math.random();
    let cumulativeProbability = 0;

    for (const config of multiplierConfig.crashConfig) {
        cumulativeProbability += config.probability;
        if (random <= cumulativeProbability) {
            const range = config.maxMultiplier - config.minMultiplier;
            const multiplier = config.minMultiplier + Math.random() * range;
            return Math.round(multiplier * 100) / 100; // 保留两位小数
        }
    }

    // 如果没有匹配到，返回最后一个配置的随机值
    const lastConfig = multiplierConfig.crashConfig[multiplierConfig.crashConfig.length - 1];
    const range = lastConfig.maxMultiplier - lastConfig.minMultiplier;
    const multiplier = lastConfig.minMultiplier + Math.random() * range;
    return Math.round(multiplier * 100) / 100;
}

/**
 * 获取当前的multiplier配置
 * @returns {object|null} multiplier配置对象
 */
function getMultiplierConfig() {
    return multiplierConfig;
}

/**
 * 重新加载multiplier配置
 * @returns {boolean} 是否加载成功
 */
function reloadMultiplierConfig() {
    try {
        const configPath = path.join(__dirname, '../config/multiplierConfig.json');
        multiplierConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log('MultiplierConfig reloaded from file');
        return true;
    } catch (error) {
        console.error('Failed to reload MultiplierConfig:', error);
        return false;
    }
}

module.exports = {
    generateCrashMultiplier,
    getMultiplierConfig,
    reloadMultiplierConfig
};