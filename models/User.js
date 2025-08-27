const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true,
        minlength: 8,
        maxlength: 50
    },
    username: {
        type: String,
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 20,
        default: function () {
            return `Player_${(this.userId || '').substring(0, 8)}`;
        }
    },
    balance: {
        type: Number,
        required: true,
        default: 1000,
        min: 0,
        max: 999999999
    },
    // 游戏统计
    totalFlights: {
        type: Number,
        default: 0,
        min: 0
    },
    flightsWon: {
        type: Number,
        default: 0,
        min: 0
    },
    // 最高记录
    highestMultiplier: {
        type: Number,
        default: 1.0,
        min: 1.0
    },
    highestBetAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    highestWinAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    // 时间戳
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLoginAt: {
        type: Date,
        default: Date.now
    },
    lastSyncTime: {
        type: Date,
        default: Date.now
    },
    // 用户状态
    isActive: {
        type: Boolean,
        default: true
    },
    // 游戏设置
    settings: {
        soundEnabled: {
            type: Boolean,
            default: true
        },
        musicEnabled: {
            type: Boolean,
            default: true
        },
        language: {
            type: String,
            enum: ['zh', 'en'],
            default: 'zh'
        },
        autoCashOut: {
            enabled: {
                type: Boolean,
                default: false
            },
            multiplier: {
                type: Number,
                default: 2.0,
                min: 1.01,
                max: 1000
            },
            totalBets: {
                type: Number,
                default: -1 // -1表示无限
            }
        }
    }
}, {
    timestamps: true, // 自动添加createdAt和updatedAt
    versionKey: false // 移除__v字段
});

// 索引
userSchema.index({ userId: 1 }, { unique: true });
userSchema.index({ lastLoginAt: -1 });
userSchema.index({ highestMultiplier: -1 });
userSchema.index({ isActive: 1 });

// Pre-validate钩子 - 确保余额不会为负数（在验证之前执行）
userSchema.pre('validate', function (next) {
    if (this.balance < 0) {
        console.warn(`Warning: User ${this.userId} balance was negative (${this.balance}), setting to 0`);
        this.balance = 0;
    }
    next();
});

// 虚拟字段 - 胜率
userSchema.virtual('winRate').get(function () {
    if (this.totalFlights === 0) return 0;
    return Math.round((this.flightsWon / this.totalFlights) * 100);
});

// 虚拟字段 - 净收益
userSchema.virtual('netProfit').get(function () {
    return this.balance - 1000; // 假设初始余额为1000
});

// 实例方法 - 更新最后登录时间
userSchema.methods.updateLastLogin = function () {
    this.lastLoginAt = new Date();
    this.lastSyncTime = new Date();
    return this.save();
};

// 实例方法 - 更新游戏统计
userSchema.methods.updateGameStats = function (betAmount, multiplier, winAmount, isWin) {
    this.totalFlights += 1;
    if (isWin) {
        this.flightsWon += 1;
        this.balance += winAmount - betAmount; // 净收益

        // 更新最高记录
        if (multiplier > this.highestMultiplier) {
            this.highestMultiplier = multiplier;
            this.highestBetAmount = betAmount;
            this.highestWinAmount = winAmount;
        }
    } else {
        // 检查余额是否足够，防止余额变成负数
        if (this.balance >= betAmount) {
            this.balance -= betAmount; // 损失
        } else {
            // 如果余额不足，将余额设为0
            this.balance = 0;
        }
    }

    this.lastSyncTime = new Date();
    return this.save();
};

// 实例方法 - 检查余额是否足够
userSchema.methods.hasEnoughBalance = function (amount) {
    return this.balance >= amount;
};

// 静态方法 - 根据userId查找或创建用户
userSchema.statics.findOrCreate = async function (userId) {
    try {
        // 使用findOneAndUpdate的upsert选项，原子性地查找或创建用户
        const user = await this.findOneAndUpdate(
            { userId },
            {
                $setOnInsert: {
                    userId,
                    username: userId,
                    balance: 1000,
                    totalFlights: 0,
                    flightsWon: 0,
                    highestMultiplier: 1,
                    highestBetAmount: 0,
                    highestWinAmount: 0,
                    isActive: true,
                    createdAt: new Date()
                },
                $set: {
                    lastLoginAt: new Date(),
                    lastSyncTime: new Date()
                }
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
            }
        );

        console.log(`User handled: ${userId}`);
        return user;

    } catch (error) {
        // 如果是重复键错误，重试查找
        if (error.code === 11000) {
            console.log(`Duplicate key detected for user ${userId}, retrying...`);
            const user = await this.findOne({ userId });
            if (user) {
                await user.updateLastLogin();
                return user;
            }
        }
        throw error;
    }
};

// 静态方法 - 获取排行榜
userSchema.statics.getLeaderboard = async function (limit = 10) {
    return this.find({ isActive: true })
        .sort({ highestMultiplier: -1, highestWinAmount: -1 })
        .limit(limit)
        .select('userId username highestMultiplier highestWinAmount flightsWon totalFlights createdAt')
        .lean();
};

// 静态方法 - 获取用户排名
userSchema.statics.getUserRank = async function (userId) {
    const user = await this.findOne({ userId });
    if (!user) return null;

    const rank = await this.countDocuments({
        isActive: true,
        $or: [
            { highestMultiplier: { $gt: user.highestMultiplier } },
            {
                highestMultiplier: user.highestMultiplier,
                highestWinAmount: { $gt: user.highestWinAmount }
            }
        ]
    });

    return rank + 1;
};

// 预处理中间件
userSchema.pre('save', function (next) {
    // 确保余额不为负数
    if (this.balance < 0) {
        this.balance = 0;
    }

    // 确保统计数据不为负数
    if (this.flightsWon > this.totalFlights) {
        this.flightsWon = this.totalFlights;
    }

    next();
});

// 确保返回的JSON不包含敏感信息
userSchema.methods.toJSON = function () {
    const userObject = this.toObject();

    // 添加虚拟字段
    userObject.winRate = this.winRate;
    userObject.netProfit = this.netProfit;

    return userObject;
};

const User = mongoose.model('User', userSchema);

module.exports = User;