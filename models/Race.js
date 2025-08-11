const mongoose = require('mongoose');

// 奖励分配记录子模式
const prizeDistributionSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    rank: {
        type: Number,
        required: true,
        min: 1
    },
    prizeAmount: {
        type: Number,
        required: true,
        min: 0
    },
    percentage: {
        type: Number,
        required: true,
        min: 0,
        max: 1
    },
    distributedAt: {
        type: Date,
        default: Date.now
    }
});

// 简化的比赛数据模式 - 只记录基本信息
const raceSchema = new mongoose.Schema({
    raceId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    startTime: {
        type: Date,
        required: true,
        index: true
    },
    endTime: {
        type: Date,
        required: true
    },
    actualEndTime: {
        type: Date // 实际结束时间
    },
    status: {
        type: String,
        enum: ['pending', 'active', 'completed', 'cancelled'],
        default: 'pending',
        index: true
    },
    // 最终奖池信息（比赛结束时写入）
    finalPrizePool: {
        type: Number,
        default: 0,
        min: 0
    },
    finalContribution: {
        type: Number,
        default: 0,
        min: 0
    },
    // 参与者统计（比赛结束时写入）
    totalParticipants: {
        type: Number,
        default: 0,
        min: 0
    },
    // 系统信息
    createdBy: {
        type: String,
        default: 'system'
    },
    finalizedAt: Date
}, {
    timestamps: true,
    versionKey: false
});

// 索引
raceSchema.index({ raceId: 1 }, { unique: true });
raceSchema.index({ startTime: -1 });
raceSchema.index({ status: 1 });
raceSchema.index({ 'prizePool.totalPool': -1 });

// 虚拟字段 - 比赛时长
raceSchema.virtual('duration').get(function() {
    if (this.actualEndTime && this.startTime) {
        return this.actualEndTime - this.startTime;
    }
    return this.endTime - this.startTime;
});

// 实例方法 - 开始比赛
raceSchema.methods.start = function() {
    this.status = 'active';
    this.startTime = new Date();
    return this.save();
};

// 实例方法 - 结束比赛
raceSchema.methods.complete = function(prizePool, participantCount) {
    this.status = 'completed';
    this.actualEndTime = new Date();
    this.finalizedAt = new Date();
    
    if (prizePool) {
        this.finalPrizePool = prizePool.totalPool;
        this.finalContribution = prizePool.contributedAmount;
    }
    
    this.totalParticipants = participantCount || 0;
    
    return this.save();
};

// 静态方法 - 获取当前活跃比赛
raceSchema.statics.getCurrentRace = async function() {
    return this.findOne({ status: 'active' }).sort({ startTime: -1 });
};

// 静态方法 - 获取比赛历史
raceSchema.statics.getRaceHistory = async function(limit = 10) {
    return this.find({ status: 'completed' })
        .sort({ startTime: -1 })
        .limit(limit)
        .select('raceId startTime endTime finalPrizePool totalParticipants')
        .lean();
};

// 预处理中间件
raceSchema.pre('save', function(next) {
    // 确保数值不为负数
    if (this.finalPrizePool < 0) {
        this.finalPrizePool = 0;
    }
    if (this.totalParticipants < 0) {
        this.totalParticipants = 0;
    }
    
    next();
});

// 确保返回的JSON格式正确
raceSchema.methods.toJSON = function() {
    const raceObject = this.toObject();
    
    // 添加虚拟字段
    raceObject.duration = this.duration;
    
    return raceObject;
};

const Race = mongoose.model('Race', raceSchema);

module.exports = Race;