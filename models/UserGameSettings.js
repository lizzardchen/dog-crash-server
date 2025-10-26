const mongoose = require('mongoose');

const userGameSettingsSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true,
        minlength: 8,
        maxlength: 50
    },
    // 下一局下注金额
    nextBetAmount: {
        type: Number,
        required: true,
        default: 10,
        min: 1,
        max: 999999999
    },
    // 下一局爆率设置
    nextCrashMultiplier: {
        type: Number,
        required: true,
        default: 0, // 0表示使用随机爆率
        min: 0,
        max: 1000
    }
}, {
    timestamps: true, // 自动添加createdAt和updatedAt
    versionKey: false // 移除__v字段
});

// 索引
userGameSettingsSchema.index({ userId: 1 }, { unique: true });

// 静态方法：查找或创建用户游戏设置
userGameSettingsSchema.statics.findOrCreate = async function (userId) {
    try {
        let settings = await this.findOne({ userId });

        if (!settings) {
            settings = new this({
                userId,
                nextBetAmount: 10,
                nextCrashMultiplier: 0
            });
            await settings.save();
        }

        return settings;
    } catch (error) {
        console.error('Error in findOrCreate UserGameSettings:', error);
        throw error;
    }
};

// 实例方法：更新设置
userGameSettingsSchema.methods.updateSettings = async function (betAmount, crashMultiplier) {
    try {
        if (betAmount !== undefined) {
            this.nextBetAmount = betAmount;
        }
        if (crashMultiplier !== undefined) {
            this.nextCrashMultiplier = crashMultiplier;
        }

        await this.save();
        return this;
    } catch (error) {
        console.error('Error updating UserGameSettings:', error);
        throw error;
    }
};

// 实例方法：重置为默认设置
userGameSettingsSchema.methods.resetToDefault = async function () {
    try {
        this.nextBetAmount = 10;
        this.nextCrashMultiplier = 0;

        await this.save();
        return this;
    } catch (error) {
        console.error('Error resetting UserGameSettings:', error);
        throw error;
    }
};

// 验证中间件
userGameSettingsSchema.pre('save', function (next) {
    // 确保下注金额在合理范围内
    if (this.nextBetAmount < 1) {
        this.nextBetAmount = 1;
    } else if (this.nextBetAmount > 999999999) {
        this.nextBetAmount = 999999999;
    }

    // 确保爆率在合理范围内
    if (this.nextCrashMultiplier < 0) {
        this.nextCrashMultiplier = 0;
    } else if (this.nextCrashMultiplier > 1000) {
        this.nextCrashMultiplier = 1000;
    }

    next();
});

// 转换为JSON时的格式化
userGameSettingsSchema.methods.toJSON = function () {
    const obj = this.toObject();
    return {
        userId: obj.userId,
        nextBetAmount: obj.nextBetAmount,
        nextCrashMultiplier: obj.nextCrashMultiplier
    };
};

const UserGameSettings = mongoose.model('UserGameSettings', userGameSettingsSchema);

module.exports = UserGameSettings;