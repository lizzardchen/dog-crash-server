const express = require('express');
const { param, query, body } = require('express-validator');
const raceManager = require('../services/raceManager');
const gameSessionCache = require('../services/gameSessionCache');
const RacePrize = require('../models/RacePrize');
const User = require('../models/User');

const router = express.Router();

/**
 * @route   GET /api/race/current
 * @desc    获取当前比赛信息
 * @access  Public
 */
router.get('/current', (req, res) => {
    try {
        const currentRace = raceManager.getCurrentRace();

        if (!currentRace) {
            return res.status(200).json({
                success: true,
                data: {
                    hasActiveRace: false,
                    message: 'No active race at the moment'
                },
                timestamp: new Date().toISOString()
            });
        }

        // 获取奖池信息
        const prizePool = gameSessionCache.calculateRacePrizePool(currentRace.raceId);

        res.status(200).json({
            success: true,
            data: {
                hasActiveRace: true,
                race: {
                    raceId: currentRace.raceId,
                    startTime: currentRace.startTime,
                    endTime: currentRace.endTime,
                    remainingTime: currentRace.remainingTime,
                    status: currentRace.status,
                    prizePool: prizePool
                }
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error getting current race:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get current race information'
        });
    }
});

/**
 * @route   GET /api/race/:raceId/leaderboard
 * @desc    获取比赛排行榜
 * @access  Public
 */
router.get('/:raceId/leaderboard', [
    param('raceId')
        .notEmpty()
        .withMessage('Race ID is required'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    query('userId')
        .optional()
        .notEmpty()
        .withMessage('User ID cannot be empty')
], (req, res) => {
    try {
        const { raceId } = req.params;
        const { limit = 10, userId } = req.query;

        if (userId) {
            // 获取包含用户信息的排行榜
            const leaderboardData = gameSessionCache.getRaceLeaderboardWithUser(
                raceId,
                userId,
                parseInt(limit)
            );

            res.status(200).json({
                success: true,
                data: {
                    raceId: raceId,
                    topLeaderboard: leaderboardData.topLeaderboard,
                    userInfo: {
                        rank: leaderboardData.userRank,
                        displayRank: leaderboardData.userDisplayRank,
                        netProfit: leaderboardData.userNetProfit,
                        sessionCount: leaderboardData.userSessionCount,
                        contribution: leaderboardData.userContribution
                    },
                    totalParticipants: leaderboardData.totalParticipants
                },
                timestamp: new Date().toISOString()
            });
        } else {
            // 只获取排行榜
            const leaderboard = gameSessionCache.getRaceLeaderboard(raceId, parseInt(limit));

            res.status(200).json({
                success: true,
                data: {
                    raceId: raceId,
                    leaderboard: leaderboard,
                    totalShown: leaderboard.length
                },
                timestamp: new Date().toISOString()
            });
        }

    } catch (error) {
        console.error('Error getting race leaderboard:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get race leaderboard'
        });
    }
});

/**
 * @route   GET /api/race/:raceId/user/:userId
 * @desc    获取用户在比赛中的详细信息
 * @access  Public
 */
router.get('/:raceId/raceuser/:userId', [
    param('raceId')
        .notEmpty()
        .withMessage('Race ID is required'),
    param('userId')
        .notEmpty()
        .withMessage('User ID is required')
], (req, res) => {
    try {
        const { raceId, userId } = req.params;

        const userData = gameSessionCache.getUserRaceData(raceId, userId);

        res.status(200).json({
            success: true,
            data: {
                raceId: raceId,
                userId: userId,
                ...userData
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error getting user race data:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get user race data'
        });
    }
});

/**
 * @route   GET /api/race/history
 * @desc    获取比赛历史
 * @access  Public
 */
router.get('/history', [
    query('limit')
        .optional()
        .isInt({ min: 1, max: 20 })
        .withMessage('Limit must be between 1 and 20')
], async (req, res) => {
    try {
        const { limit = 5 } = req.query;

        const history = await raceManager.getRaceHistory(parseInt(limit));

        res.status(200).json({
            success: true,
            data: {
                history: history,
                count: history.length
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error getting race history:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get race history'
        });
    }
});

/**
 * @route   GET /api/race/stats
 * @desc    获取比赛系统统计信息
 * @access  Public
 */
router.get('/stats', (req, res) => {
    try {
        const stats = raceManager.getRaceStats();

        res.status(200).json({
            success: true,
            data: stats,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error getting race stats:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get race statistics'
        });
    }
});

/**
 * @route   GET /api/race/prizes/user/:userId
 * @desc    获取用户的待领取奖励列表
 * @access  Public
 */
router.get('/prizes/user/:userId', [
    param('userId')
        .notEmpty()
        .withMessage('User ID is required'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage('Limit must be between 1 and 50')
], async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 20 } = req.query;

        // 安全检查：确保userId是有效的
        if (!userId || typeof userId !== 'string' || userId.trim() === '') {
            return res.status(400).json({
                error: 'Invalid User ID',
                message: 'User ID must be provided and cannot be empty'
            });
        }

        // 获取待领取奖励 - 如果用户没有参与比赛，返回空数组
        const pendingPrizes = await RacePrize.getUserPendingPrizes(userId, parseInt(limit)) || [];

        // 计算总待领取金额
        const totalPendingAmount = pendingPrizes.reduce((sum, prize) => sum + prize.prizeAmount, 0);

        res.status(200).json({
            success: true,
            data: {
                userId: userId,
                pendingPrizes: pendingPrizes,
                totalPendingAmount: totalPendingAmount,
                count: pendingPrizes.length
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error getting user pending prizes:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get user pending prizes'
        });
    }
});

/**
 * @route   POST /api/race/prizes/:prizeId/claim
 * @desc    领取奖励
 * @access  Public
 */
router.post('/prizes/:prizeId/claim', [
    param('prizeId')
        .isMongoId()
        .withMessage('Valid prize ID is required'),
    body('userId')
        .notEmpty()
        .withMessage('User ID is required')
], async (req, res) => {
    try {
        const { prizeId } = req.params;
        const { userId } = req.body;

        // 查找奖励记录
        const prize = await RacePrize.findById(prizeId);

        if (!prize) {
            return res.status(404).json({
                error: 'Prize Not Found',
                message: 'The specified prize does not exist'
            });
        }

        // 验证奖励归属
        if (prize.userId !== userId) {
            return res.status(403).json({
                error: 'Access Denied',
                message: 'This prize does not belong to the specified user'
            });
        }

        // 检查奖励状态
        if (prize.status !== 'pending') {
            return res.status(400).json({
                error: 'Prize Not Available',
                message: `Prize is ${prize.status} and cannot be claimed`
            });
        }

        // 奖励永不过期，直接领取

        // 领取奖励
        await prize.claim();

        // 增加用户余额
        const user = await User.findOne({ userId });
        if (user) {
            user.balance += prize.prizeAmount;
            await user.save();
            console.log(`💰 User ${userId} balance updated: +${prize.prizeAmount}, new balance: ${user.balance}`);
        } else {
            console.warn(`⚠️ User ${userId} not found when trying to add balance`);
        }

        console.log(`🎁 Prize claimed: ${userId} received ${prize.prizeAmount} coins from race ${prize.raceId}`);

        res.status(200).json({
            success: true,
            data: {
                prizeId: prize._id,
                userId: userId,
                raceId: prize.raceId,
                rank: prize.rank,
                prizeAmount: prize.prizeAmount,
                claimedAt: prize.claimedAt,
                message: `Successfully claimed ${prize.prizeAmount} coins!`
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error claiming prize:', error);


        if (error.message.includes('claimed')) {
            return res.status(400).json({
                error: 'Prize Already Claimed',
                message: error.message
            });
        }

        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to claim prize'
        });
    }
});

/**
 * @route   GET /api/race/prizes/user/:userId/history
 * @desc    获取用户奖励历史
 * @access  Public
 */
router.get('/prizes/user/:userId/history', [
    param('userId')
        .notEmpty()
        .withMessage('User ID is required'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage('Limit must be between 1 and 50')
], async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 20 } = req.query;

        // 安全检查：确保userId是有效的
        if (!userId || typeof userId !== 'string' || userId.trim() === '') {
            return res.status(400).json({
                error: 'Invalid User ID',
                message: 'User ID must be provided and cannot be empty'
            });
        }

        // 获取奖励历史 - 如果用户没有参与比赛，返回空数组
        const prizeHistory = await RacePrize.getUserPrizeHistory(userId, parseInt(limit)) || [];

        // 统计信息
        const stats = {
            totalPrizes: prizeHistory.length,
            totalEarned: prizeHistory.filter(p => p.status === 'claimed').reduce((sum, p) => sum + p.prizeAmount, 0),
            totalPending: prizeHistory.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.prizeAmount, 0),
            claimedCount: prizeHistory.filter(p => p.status === 'claimed').length,
            pendingCount: prizeHistory.filter(p => p.status === 'pending').length
        };

        res.status(200).json({
            success: true,
            data: {
                userId: userId,
                prizeHistory: prizeHistory,
                stats: stats
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error getting user prize history:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get user prize history'
        });
    }
});

/**
 * @route   GET /api/race/prizes/stats
 * @desc    获取系统奖励统计信息
 * @access  Public
 */
router.get('/prizes/stats', [
    query('raceId')
        .optional()
        .notEmpty()
        .withMessage('Race ID cannot be empty if provided')
], async (req, res) => {
    try {
        const { raceId } = req.query;

        // 获取奖励统计
        const stats = await RacePrize.getPrizeStats(raceId);

        res.status(200).json({
            success: true,
            data: {
                raceId: raceId || 'all',
                stats: stats
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error getting prize stats:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get prize statistics'
        });
    }
});

/**
 * @route   GET /api/race/prizes/race/:raceId
 * @desc    获取指定比赛的所有奖励记录
 * @access  Public
 */
router.get('/prizes/race/:raceId', [
    param('raceId')
        .notEmpty()
        .withMessage('Race ID is required')
], async (req, res) => {
    try {
        const { raceId } = req.params;

        // 获取比赛奖励记录
        const racePrizes = await RacePrize.getRacePrizes(raceId);

        // 统计信息
        const stats = {
            totalPrizes: racePrizes.length,
            totalAmount: racePrizes.reduce((sum, p) => sum + p.prizeAmount, 0),
            claimedAmount: racePrizes.filter(p => p.status === 'claimed').reduce((sum, p) => sum + p.prizeAmount, 0),
            pendingAmount: racePrizes.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.prizeAmount, 0)
        };

        res.status(200).json({
            success: true,
            data: {
                raceId: raceId,
                prizes: racePrizes,
                stats: stats
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error getting race prizes:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get race prizes'
        });
    }
});

module.exports = router;