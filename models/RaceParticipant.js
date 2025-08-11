const mongoose = require('mongoose');

// 参赛者数据模式 - 只保存Top1000
const raceParticipantSchema = new mongoose.Schema({
    raceId: {
        type: String,
        required: true,
        index: true
    },
    userId: {
        type: String,
        required: true
    },
    // 统计数据
    totalBetAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    totalWinAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    netProfit: {
        type: Number,
        default: 0
    },
    contributionToPool: {
        type: Number,
        default: 0,
        min: 0
    },
    sessionCount: {
        type: Number,
        default: 0,
        min: 0
    },
    // 排名信息
    rank: {
        type: Number,
        required: true,
        min: 1,
        max: 1000
    },
    lastUpdateTime: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    versionKey: false
});

// 复合索引 - 确保每个比赛中每个用户只有一条记录
raceParticipantSchema.index({ raceId: 1, userId: 1 }, { unique: true });

// 索引 - 按比赛和排名查询
raceParticipantSchema.index({ raceId: 1, rank: 1 });

// 索引 - 按比赛和净收益查询
raceParticipantSchema.index({ raceId: 1, netProfit: -1 });

// 静态方法 - 获取比赛Top1000排行榜
raceParticipantSchema.statics.getLeaderboard = async function(raceId, limit = 1000) {
    return this.find({ raceId })
        .sort({ rank: 1 })
        .limit(limit)
        .lean();
};

// 静态方法 - 获取用户在比赛中的排名
raceParticipantSchema.statics.getUserRank = async function(raceId, userId) {
    return this.findOne({ raceId, userId }).lean();
};

// 静态方法 - 批量更新参与者数据（带重试机制）
raceParticipantSchema.statics.batchUpsert = async function(raceId, participants, retryCount = 0) {
    if (!participants || participants.length === 0) return;
    
    const operations = participants.map(participant => ({
        updateOne: {
            filter: { raceId, userId: participant.userId },
            update: {
                $set: {
                    totalBetAmount: participant.totalBetAmount,
                    totalWinAmount: participant.totalWinAmount,
                    netProfit: participant.netProfit,
                    contributionToPool: participant.contributionToPool,
                    sessionCount: participant.sessionCount,
                    rank: participant.rank,
                    lastUpdateTime: new Date()
                }
            },
            upsert: true
        }
    }));
    
    try {
        return await this.bulkWrite(operations, { ordered: false });
    } catch (error) {
        const isConnectionError = (
            error.message.includes('connection') && error.message.includes('closed')
        ) || (
            error.errorLabels && error.errorLabels.has('ResetPool')
        ) || (
            error.name === 'MongoNetworkError' || 
            error.name === 'MongoServerSelectionError'
        );
        
        if (isConnectionError && retryCount < 3) {
            const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
            console.log(`MongoDB connection error, retrying batch upsert in ${delay}ms (attempt ${retryCount + 1}/3) for race ${raceId}`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.batchUpsert(raceId, participants, retryCount + 1);
        } else {
            if (isConnectionError) {
                console.error(`MongoDB bulk write failed after 3 retries for race ${raceId}:`, error.message);
            }
            throw error;
        }
    }
};

// 静态方法 - 清理比赛数据
raceParticipantSchema.statics.clearRaceData = async function(raceId) {
    return this.deleteMany({ raceId });
};

const RaceParticipant = mongoose.model('RaceParticipant', raceParticipantSchema);

module.exports = RaceParticipant;