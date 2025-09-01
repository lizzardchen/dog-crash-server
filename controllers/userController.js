const User = require('../models/User');
const GameSession = require('../models/GameSession');
const { validationResult } = require('express-validator');
const gameSessionCache = require('../services/gameSessionCache');

class UserController {
    /**
     * 获取或创建用户信息
     * GET /api/user/:userId
     */
    static async getUserInfo(req, res) {
        try {
            const { userId } = req.params;

            // 验证userId格式
            if (!userId || userId.length < 8 || userId.length > 50) {
                return res.status(400).json({
                    error: 'Invalid user ID format',
                    message: 'User ID must be between 10 and 50 characters'
                });
            }

            // 查找或创建用户
            const user = await User.findOrCreate(userId);

            // 获取用户排名
            const rank = await User.getUserRank(userId);

            // 返回用户信息
            res.status(200).json({
                success: true,
                data: {
                    userId: user.userId,
                    username: user.userId,
                    balance: user.balance,
                    totalFlights: user.totalFlights,
                    flightsWon: user.flightsWon,
                    highestMultiplier: user.highestMultiplier,
                    highestBetAmount: user.highestBetAmount,
                    highestWinAmount: user.highestWinAmount,
                    winRate: user.winRate,
                    netProfit: user.netProfit,
                    rank: rank,
                    settings: user.settings,
                    createdAt: user.createdAt,
                    lastLoginAt: user.lastLoginAt
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error in getUserInfo:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to get user information',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * 更新用户记录
     * POST /api/user/:userId/record
     */
    static async updateUserRecord(req, res) {
        try {
            const { userId } = req.params;
            const { betAmount, multiplier, winAmount, isWin, sessionId, gameDuration, isFreeMode, money } = req.body;

            // 验证已在路由中间件中处理

            // 查找用户
            const user = await User.findOne({ userId });
            if (!user) {
                return res.status(404).json({
                    error: 'User Not Found',
                    message: 'User does not exist',
                    timestamp: new Date().toISOString()
                });
            }

            // 检查余额是否足够（仅在非免费模式下检查）
            if (!isFreeMode && !user.hasEnoughBalance(betAmount)) {
                return res.status(400).json({
                    error: 'Insufficient Balance',
                    message: `Insufficient balance. Current balance: ${user.balance}, Required: ${betAmount}`,
                    data: {
                        currentBalance: user.balance,
                        requiredAmount: betAmount
                    },
                    timestamp: new Date().toISOString()
                });
            }

            // 更新游戏统计
            await user.updateGameStats(betAmount, multiplier, winAmount, isWin, money);

            // 添加游戏会话到内存缓存（后台异步保存到数据库）
            const sessionData = {
                sessionId: sessionId || `${userId}_${Date.now()}`,
                userId,
                betAmount,
                crashMultiplier: multiplier,
                cashOutMultiplier: isWin ? multiplier : 0,
                isWin,
                winAmount: winAmount || 0,
                profit: isWin ? (winAmount - betAmount) : -betAmount,
                gameDuration: gameDuration || 0,
                isFreeMode: isFreeMode || false
            };

            const cachedSession = gameSessionCache.addSession(sessionData);

            res.status(200).json({
                success: true,
                data: {
                    userId: user.userId,
                    balance: user.balance,
                    money: user.money,
                    totalFlights: user.totalFlights,
                    flightsWon: user.flightsWon,
                    highestMultiplier: user.highestMultiplier,
                    winRate: user.winRate,
                    netProfit: user.netProfit,
                    sessionId: cachedSession.id
                },
                message: 'User record updated successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error in updateUserRecord:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to update user record',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * 更新用户设置
     * PUT /api/user/:userId/settings
     */
    static async updateUserSettings(req, res) {
        try {
            const { userId } = req.params;
            const { soundEnabled, musicEnabled, language, autoCashOut } = req.body;

            const user = await User.findOne({ userId });
            if (!user) {
                return res.status(404).json({
                    error: 'User Not Found',
                    message: 'User does not exist'
                });
            }

            // 更新设置
            if (soundEnabled !== undefined) {
                user.settings.soundEnabled = soundEnabled;
            }
            if (musicEnabled !== undefined) {
                user.settings.musicEnabled = musicEnabled;
            }
            if (language && ['zh', 'en'].includes(language)) {
                user.settings.language = language;
            }
            if (autoCashOut) {
                user.settings.autoCashOut = {
                    enabled: autoCashOut.enabled || false,
                    multiplier: Math.max(1.01, Math.min(1000, autoCashOut.multiplier || 2.0)),
                    totalBets: autoCashOut.totalBets || -1
                };
            }

            user.lastSyncTime = new Date();
            await user.save();

            res.status(200).json({
                success: true,
                data: {
                    settings: user.settings
                },
                message: 'User settings updated successfully'
            });

        } catch (error) {
            console.error('Error in updateUserSettings:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to update user settings'
            });
        }
    }

    /**
     * 获取用户游戏历史
     * GET /api/user/:userId/history
     */
    static async getUserHistory(req, res) {
        try {
            const { userId } = req.params;
            const { limit = 50, offset = 0 } = req.query;

            const user = await User.findOne({ userId });
            if (!user) {
                return res.status(404).json({
                    error: 'User Not Found',
                    message: 'User does not exist'
                });
            }

            // 从内存缓存获取用户历史，如果缓存中没有足够数据则从数据库补充
            let history = gameSessionCache.getUserSessions(userId, parseInt(limit));

            // 如果缓存中的记录不足，从数据库获取补充
            if (history.length < parseInt(limit)) {
                const dbHistory = await GameSession.getUserHistory(userId, parseInt(limit) - history.length);
                history = [...history, ...dbHistory];
            }

            // 从缓存获取实时统计
            const globalStats = gameSessionCache.getGlobalStats();
            const stats = {
                totalSessions: user.totalFlights,
                winRate: user.winRate,
                totalBetAmount: globalStats.totalBetAmount,
                avgMultiplier: globalStats.avgMultiplier
            };

            res.status(200).json({
                success: true,
                data: {
                    history,
                    stats,
                    pagination: {
                        limit: parseInt(limit),
                        offset: parseInt(offset),
                        total: history.length
                    }
                }
            });

        } catch (error) {
            console.error('Error in getUserHistory:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to get user history'
            });
        }
    }

    /**
     * 获取排行榜
     * GET /api/user/leaderboard
     */
    static async getLeaderboard(req, res) {
        try {
            const { limit = 10 } = req.query;

            const leaderboard = await User.getLeaderboard(parseInt(limit));

            res.status(200).json({
                success: true,
                data: {
                    leaderboard: leaderboard.map((user, index) => ({
                        rank: index + 1,
                        userId: user.userId,
                        username: user.userId,
                        highestMultiplier: user.highestMultiplier,
                        highestWinAmount: user.highestWinAmount,
                        flightsWon: user.flightsWon,
                        totalFlights: user.totalFlights,
                        winRate: user.totalFlights > 0 ? Math.round((user.flightsWon / user.totalFlights) * 100) : 0,
                        createdAt: user.createdAt
                    }))
                }
            });

        } catch (error) {
            console.error('Error in getLeaderboard:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to get leaderboard'
            });
        }
    }

    /**
     * 删除用户（软删除）
     * DELETE /api/user/:userId
     */
    static async deleteUser(req, res) {
        try {
            const { userId } = req.params;

            const user = await User.findOne({ userId });
            if (!user) {
                return res.status(404).json({
                    error: 'User Not Found',
                    message: 'User does not exist'
                });
            }

            // 软删除：标记为非活跃
            user.isActive = false;
            user.lastSyncTime = new Date();
            await user.save();

            res.status(200).json({
                success: true,
                message: 'User deleted successfully'
            });

        } catch (error) {
            console.error('Error in deleteUser:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to delete user'
            });
        }
    }
}

module.exports = UserController;