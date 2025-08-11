const mongoose = require('mongoose');

const gameSessionSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    raceId: {
        type: String,
        required: true,
        index: true
    },
    userId: {
        type: String,
        required: true,
        index: true
    },
    // 游戏数据
    betAmount: {
        type: Number,
        required: true,
        min: 1
    },
    crashMultiplier: {
        type: Number,
        required: true,
        min: 1.0
    },
    cashOutMultiplier: {
        type: Number,
        default: 0, // 0表示没有提现（崩盘了）
        min: 0
    },
    // 结果
    isWin: {
        type: Boolean,
        required: true
    },
    profit: {
        type: Number,
        required: true // 正数为盈利，负数为亏损
    },
    // 时间戳
    gameStartTime: {
        type: Date,
        required: true
    },
    gameEndTime: {
        type: Date,
        required: true
    },
    gameDuration: {
        type: Number, // 游戏持续时间（毫秒）
        required: true
    },
    // 状态
    isProcessed: {
        type: Boolean,
        default: true
    },
    // 附加信息
    isFreeMode: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    versionKey: false
});

// 索引
gameSessionSchema.index({ userId: 1, createdAt: -1 });
gameSessionSchema.index({ sessionId: 1 }, { unique: true });
gameSessionSchema.index({ raceId: 1, userId: 1 }); // 比赛相关索引
gameSessionSchema.index({ raceId: 1, createdAt: -1 }); // 按比赛时间查询
gameSessionSchema.index({ gameStartTime: -1 });
gameSessionSchema.index({ crashMultiplier: -1 });
gameSessionSchema.index({ isWin: 1 });

// 静态方法 - 获取用户游戏历史
gameSessionSchema.statics.getUserHistory = async function(userId, limit = 50) {
    return this.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('sessionId betAmount crashMultiplier cashOutMultiplier isWin profit gameStartTime gameDuration isFreeMode')
        .lean();
};

// 静态方法 - 获取游戏统计
gameSessionSchema.statics.getGameStats = async function(userId = null) {
    const matchStage = userId ? { userId } : {};
    
    const stats = await this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null,
                totalGames: { $sum: 1 },
                totalWins: { $sum: { $cond: ['$isWin', 1, 0] } },
                totalLosses: { $sum: { $cond: ['$isWin', 0, 1] } },
                totalProfit: { $sum: '$profit' },
                averageBet: { $avg: '$betAmount' },
                highestMultiplier: { $max: '$crashMultiplier' },
                averageGameDuration: { $avg: '$gameDuration' }
            }
        }
    ]);
    
    if (stats.length === 0) {
        return {
            totalGames: 0,
            totalWins: 0,
            totalLosses: 0,
            winRate: 0,
            totalProfit: 0,
            averageBet: 0,
            highestMultiplier: 1.0,
            averageGameDuration: 0
        };
    }
    
    const result = stats[0];
    result.winRate = result.totalGames > 0 ? Math.round((result.totalWins / result.totalGames) * 100) : 0;
    delete result._id;
    
    return result;
};

// 静态方法 - 获取最近的崩盘记录
gameSessionSchema.statics.getRecentCrashes = async function(limit = 10) {
    return this.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('crashMultiplier gameStartTime')
        .lean();
};

const GameSession = mongoose.model('GameSession', gameSessionSchema);

module.exports = GameSession;