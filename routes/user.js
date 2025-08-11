const express = require('express');
const { body, param, query } = require('express-validator');
const UserController = require('../controllers/userController');

const router = express.Router();

// 验证中间件
const validateUserId = [
    param('userId')
        .isLength({ min: 10, max: 50 })
        .withMessage('User ID must be between 10 and 50 characters')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('User ID can only contain letters, numbers, underscores, and hyphens')
];

const validateUserRecord = [
    body('betAmount')
        .isNumeric()
        .withMessage('Bet amount must be a number')
        .isFloat({ min: 1, max: 1000000 })
        .withMessage('Bet amount must be between 1 and 1,000,000'),
    
    body('multiplier')
        .isNumeric()
        .withMessage('Multiplier must be a number')
        .isFloat({ min: 1.0, max: 1000 })
        .withMessage('Multiplier must be between 1.0 and 1000'),
    
    body('winAmount')
        .optional()
        .isNumeric()
        .withMessage('Win amount must be a number')
        .isFloat({ min: 0 })
        .withMessage('Win amount must be non-negative'),
    
    body('isWin')
        .isBoolean()
        .withMessage('isWin must be a boolean'),
    
    body('sessionId')
        .optional()
        .isLength({ min: 10, max: 100 })
        .withMessage('Session ID must be between 10 and 100 characters'),
    
    body('gameDuration')
        .optional()
        .isNumeric()
        .withMessage('Game duration must be a number')
        .isInt({ min: 0, max: 300000 })
        .withMessage('Game duration must be between 0 and 300,000 milliseconds'),
    
    body('isFreeMode')
        .optional()
        .isBoolean()
        .withMessage('isFreeMode must be a boolean')
];

const validateUserSettings = [
    body('soundEnabled')
        .optional()
        .isBoolean()
        .withMessage('soundEnabled must be a boolean'),
    
    body('musicEnabled')
        .optional()
        .isBoolean()
        .withMessage('musicEnabled must be a boolean'),
    
    body('language')
        .optional()
        .isIn(['zh', 'en'])
        .withMessage('language must be either "zh" or "en"'),
    
    body('autoCashOut.enabled')
        .optional()
        .isBoolean()
        .withMessage('autoCashOut.enabled must be a boolean'),
    
    body('autoCashOut.multiplier')
        .optional()
        .isFloat({ min: 1.01, max: 1000 })
        .withMessage('autoCashOut.multiplier must be between 1.01 and 1000'),
    
    body('autoCashOut.totalBets')
        .optional()
        .isInt({ min: -1 })
        .withMessage('autoCashOut.totalBets must be -1 (infinite) or a positive integer')
];

const validatePagination = [
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    
    query('offset')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Offset must be non-negative')
];

// 用户路由
/**
 * @route   GET /api/user/:userId
 * @desc    获取或创建用户信息
 * @access  Public
 */
router.get('/:userId', validateUserId, UserController.getUserInfo);

/**
 * @route   POST /api/user/:userId/record
 * @desc    更新用户游戏记录
 * @access  Public
 */
router.post('/:userId/record', [...validateUserId, ...validateUserRecord], UserController.updateUserRecord);

/**
 * @route   PUT /api/user/:userId/settings
 * @desc    更新用户设置
 * @access  Public
 */
router.put('/:userId/settings', [...validateUserId, ...validateUserSettings], UserController.updateUserSettings);

/**
 * @route   GET /api/user/:userId/history
 * @desc    获取用户游戏历史
 * @access  Public
 */
router.get('/:userId/history', [...validateUserId, ...validatePagination], UserController.getUserHistory);

/**
 * @route   GET /api/user/leaderboard
 * @desc    获取排行榜
 * @access  Public
 */
router.get('/leaderboard', [
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100')
], UserController.getLeaderboard);

/**
 * @route   DELETE /api/user/:userId
 * @desc    删除用户（软删除）
 * @access  Public
 */
router.delete('/:userId', validateUserId, UserController.deleteUser);

module.exports = router;