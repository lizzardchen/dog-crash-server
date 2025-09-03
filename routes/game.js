const express = require('express');
const { body, query, validationResult } = require('express-validator');
const GameSession = require('../models/GameSession');
const gameSessionCache = require('../services/gameSessionCache');
const gameCountdownManager = require('../services/gameCountdownManager');
const { generateCrashMultiplier, getMultiplierConfig } = require('../services/multiplierService');

const router = express.Router();



/**
 * @route   GET /api/game/multiplier-config
 * @desc    获取倍率配置（客户端初始化时调用）
 * @access  Public
 */
router.get('/multiplier-config', (req, res) => {
    try {
        const multiplierConfig = getMultiplierConfig();
        if (!multiplierConfig) {
            return res.status(500).json({
                error: 'Configuration Error',
                message: 'Multiplier configuration not available',
                timestamp: new Date().toISOString()
            });
        }

        res.status(200).json({
            success: true,
            data: multiplierConfig,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting multiplier config:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get multiplier configuration',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @route   GET /api/game/crash-multiplier
 * @desc    获取新游戏的崩盘倍数
 * @access  Public
 */
router.get('/crash-multiplier', (req, res) => {
    try {
        const crashMultiplier = generateCrashMultiplier();

        console.log(`Generated crash multiplier: ${crashMultiplier}x`);

        res.status(200).json({
            success: true,
            data: {
                crashMultiplier: crashMultiplier,
                timestamp: Date.now()
            }
        });
    } catch (error) {
        console.error('Error generating crash multiplier:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to generate crash multiplier',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @route   GET /api/game/stats
 * @desc    获取游戏统计信息
 * @access  Public
 */
router.get('/stats', async (req, res) => {
    try {
        // 从内存缓存获取实时统计
        const stats = gameSessionCache.getGlobalStats();
        const recentCrashes = gameSessionCache.getRecentCrashes(10);

        res.status(200).json({
            success: true,
            data: {
                stats: {
                    totalSessions: stats.totalSessions,
                    winRate: parseFloat(stats.winRate),
                    totalBetAmount: parseFloat(stats.totalBetAmount),
                    totalWinAmount: parseFloat(stats.totalWinAmount),
                    avgMultiplier: parseFloat(stats.avgMultiplier),
                    maxMultiplier: parseFloat(stats.maxMultiplier)
                },
                recentCrashes: recentCrashes.map(crash => ({
                    multiplier: crash.multiplier,
                    timestamp: crash.timestamp,
                    isWin: crash.isWin
                })),
                cacheInfo: {
                    cacheSize: stats.cacheSize,
                    pendingSaves: stats.pendingSaves
                }
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error in getGameStats:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get game statistics'
        });
    }
});

/**
 * @route   GET /api/game/history
 * @desc    获取全局游戏历史
 * @access  Public
 */
router.get('/history', [
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100')
], async (req, res) => {
    try {
        const { limit = 20 } = req.query;

        // 首先从内存缓存获取最新的记录
        let history = gameSessionCache.getRecentCrashes(parseInt(limit));

        // 如果缓存中记录不足，从数据库补充
        if (history.length < parseInt(limit)) {
            const dbHistory = await GameSession.find({})
                .sort({ createdAt: -1 })
                .limit(parseInt(limit) - history.length)
                .select('crashMultiplier gameStartTime gameDuration isWin')
                .lean();

            const dbHistoryFormatted = dbHistory.map(game => ({
                multiplier: game.crashMultiplier,
                timestamp: game.gameStartTime.getTime(),
                duration: game.gameDuration,
                isWin: game.isWin
            }));

            history = [...history, ...dbHistoryFormatted];
        }

        res.status(200).json({
            success: true,
            data: {
                history: history.map(game => ({
                    multiplier: game.multiplier,
                    timestamp: game.timestamp,
                    duration: game.duration || 0,
                    result: game.isWin ? 'win' : 'crash'
                }))
            }
        });

    } catch (error) {
        console.error('Error in getGameHistory:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get game history'
        });
    }
});

/**
 * @route   GET /api/game/cache-status
 * @desc    获取缓存状态（调试用）
 * @access  Public
 */
router.get('/cache-status', (req, res) => {
    try {
        const cacheStatus = gameSessionCache.getCacheStatus();
        const globalStats = gameSessionCache.getGlobalStats();

        res.status(200).json({
            success: true,
            data: {
                ...cacheStatus,
                stats: globalStats
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting cache status:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get cache status'
        });
    }
});

/**
 * @route   GET /api/game/config
 * @desc    获取游戏配置
 * @access  Public
 */
router.get('/config', (req, res) => {
    const config = require('../config/server');

    res.status(200).json({
        success: true,
        data: {
            game: config.game,
            version: '1.0.0',
            features: {
                autoCashOut: true,
                leaderboard: true,
                gameHistory: true,
                userStats: true,
                memoryCache: true,
                countdown: true
            }
        }
    });
});

/**
 * @route   GET /api/game/countdown
 * @desc    获取当前详细倒计时状态（状态：下注/游戏，剩余时间，配置时间，爆率设置）
 * @access  Public
 */
router.get('/countdown', (req, res) => {
    try {
        const countdownStatus = gameCountdownManager.getCountdownStatus();
        const config = gameCountdownManager.getConfig();
        let finalCrashMultiplier = config.fixedCrashMultiplier;
        if (finalCrashMultiplier <= 0) {
            finalCrashMultiplier = gameCountdownManager.getCurrentGameCrashMultiplier();
        }

        // 简化返回数据，包含核心信息、配置时间和爆率设置
        const simplifiedStatus = {
            phase: countdownStatus.phase, // 'betting', 'waiting' 或 'gaming'
            remainingTime: countdownStatus.remainingTime, // 剩余毫秒数
            remainingSeconds: countdownStatus.remainingSeconds, // 剩余秒数
            isCountingDown: countdownStatus.isCountingDown, // 是否正在倒计时
            gameId: countdownStatus.gameId, // 当前游戏ID
            round: countdownStatus.round, // 当前轮次
            bettingCountdown: config.bettingCountdown, // 下注间隔时间（毫秒）
            waitingCountdown: config.waitingCountdown, // 等待游戏开始间隔时间（毫秒）
            gameCountdown: config.gameCountdown, // 游戏间隔时间（毫秒）
            fixedCrashMultiplier: finalCrashMultiplier // 当前设置的爆率值（<=0表示随机爆率）
        };

        res.status(200).json({
            success: true,
            data: simplifiedStatus,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error getting countdown status:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get countdown status',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @route   GET /api/game/countdown/config
 * @desc    获取游戏倒计时配置信息
 * @access  Public
 */
router.get('/countdown/config', (req, res) => {
    try {
        const config = gameCountdownManager.getConfig();
        
        res.status(200).json({
            success: true,
            data: {
                bettingCountdown: config.bettingCountdown,
                waitingCountdown: config.waitingCountdown,
                gameCountdown: config.gameCountdown,
                fixedCrashMultiplier: config.fixedCrashMultiplier
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting countdown config:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get countdown config',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @route   PUT /api/game/countdown/config
 * @desc    设置下注时间、等待时间、游戏时间和爆率值
 * @access  Public
 */
router.put('/countdown/config', [
    body('bettingCountdown')
        .optional()
        .isInt({ min: 5000, max: 1800000 })
        .withMessage('下注倒计时必须在5秒-30分钟之间（毫秒）'),
    body('waitingCountdown')
        .optional()
        .isInt({ min: 1000, max: 60000 })
        .withMessage('等待倒计时必须在1秒-1分钟之间（毫秒）'),
    body('gameCountdown')
        .optional()
        .isInt({ min: 5000, max: 1800000 })
        .withMessage('游戏倒计时必须在5秒-30分钟之间（毫秒）'),
    body('crashMultiplier')
        .optional()
        .isFloat({ min: 0.0, max: 1000.0 })
        .withMessage('爆率值必须在0.0-1000.0之间（0表示随机爆率）')
], (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: '参数验证失败',
                message: '配置参数无效',
                details: errors.array(),
                timestamp: new Date().toISOString()
            });
        }

        const { bettingCountdown, waitingCountdown, gameCountdown, crashMultiplier } = req.body;

        // 更新倒计时配置
        const updateConfig = {};
        if (bettingCountdown !== undefined) updateConfig.bettingCountdown = bettingCountdown;
        if (waitingCountdown !== undefined) updateConfig.waitingCountdown = waitingCountdown;
        if (gameCountdown !== undefined) updateConfig.gameCountdown = gameCountdown;

        if (Object.keys(updateConfig).length > 0) {
            gameCountdownManager.updateConfig(updateConfig);
        }

        // 处理爆率值设置
        let finalCrashMultiplier;
        if (crashMultiplier !== undefined) {
            if (crashMultiplier <= 0) {
                // 如果设置为0或负数，生成随机爆率并更新到config中
                // finalCrashMultiplier = generateCrashMultiplier();
                gameCountdownManager.updateConfig({ fixedCrashMultiplier: 0 });
                console.log(`固定爆率值已设置为: 0x`);
            } else {
                // 设置固定爆率值
                finalCrashMultiplier = crashMultiplier;
                gameCountdownManager.updateConfig({ fixedCrashMultiplier: crashMultiplier });
                console.log(`固定爆率值已设置为: ${crashMultiplier}x`);
            }
        } else {
            // 如果没有提供crashMultiplier参数，检查当前config中的值
            const currentConfig = gameCountdownManager.getConfig();
            if (currentConfig.fixedCrashMultiplier <= 0) {
                // 当前设置为随机爆率，生成新的随机爆率
                // finalCrashMultiplier = generateCrashMultiplier();
                gameCountdownManager.updateConfig({ fixedCrashMultiplier: 0 });
                console.log(`当前为随机爆率，已将爆率值设置为: 0x`);
            }
        }

        const newConfig = gameCountdownManager.getConfig();

        // 返回更新后的配置信息
        const responseData = {
            bettingCountdown: newConfig.bettingCountdown,
            waitingCountdown: newConfig.waitingCountdown,
            gameCountdown: newConfig.gameCountdown,
            fixedCrashMultiplier: newConfig.fixedCrashMultiplier
        };

        res.status(200).json({
            success: true,
            message: '倒计时配置更新成功',
            data: responseData,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error updating countdown config:', error);

        if (error.message.includes('must be between')) {
            res.status(400).json({
                success: false,
                error: '配置错误',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                error: '内部服务器错误',
                message: '更新倒计时配置失败',
                timestamp: new Date().toISOString()
            });
        }
    }
});



module.exports = router;