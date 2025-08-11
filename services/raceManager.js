const gameSessionCache = require('./gameSessionCache');
const Race = require('../models/Race');
const RacePrize = require('../models/RacePrize');

/**
 * 比赛管理器 - 负责自动创建和管理比赛周期
 * 特性：
 * 1. 每4小时自动开始新比赛
 * 2. 自动结算上一轮比赛
 * 3. 管理比赛状态和奖励分发
 */
class RaceManager {
    constructor() {
        this.currentRace = null;
        this.raceHistory = [];
        this.raceTimer = null;

        // 比赛配置
        this.config = {
            raceDuration: 4 * 60 * 60 * 1000,    // 4小时（毫秒）
            raceInterval: 4 * 60 * 60 * 1000,    // 4小时间隔
            autoStartDelay: 5000,                 // 服务器启动后5秒开始第一场比赛
            prizeCleanupInterval: 60 * 60 * 1000  // 1小时清理一次过期奖励
        };

        console.log('RaceManager initialized');

        // 服务器启动后延迟恢复数据并启动比赛
        setTimeout(() => {
            this.initializeFromDatabase();
        }, this.config.autoStartDelay);
    }

    /**
     * 从数据库初始化/恢复比赛数据
     */
    async initializeFromDatabase() {
        try {
            console.log('🔄 Initializing race manager from database...');

            // 查找当前活跃的比赛
            const activeRace = await Race.getCurrentRace();

            if (activeRace) {
                const now = Date.now();
                const raceEndTime = new Date(activeRace.endTime).getTime();

                // 检查比赛是否还在进行中
                if (now < raceEndTime) {
                    console.log(`📥 Found active race: ${activeRace.raceId}`);

                    // 恢复当前比赛状态
                    this.currentRace = {
                        raceId: activeRace.raceId,
                        startTime: new Date(activeRace.startTime).getTime(),
                        endTime: raceEndTime,
                        status: 'active',
                        dbId: activeRace._id
                    };

                    // 恢复缓存管理器的数据
                    await gameSessionCache.restoreFromDatabase(activeRace.raceId);

                    // 计算剩余时间并设置结束定时器
                    const remainingTime = raceEndTime - now;
                    setTimeout(() => {
                        this.endRaceById(activeRace.raceId);
                    }, remainingTime);

                    console.log(`✅ Restored active race: ${activeRace.raceId}`);
                    console.log(`⏰ Remaining time: ${Math.round(remainingTime / 1000 / 60)} minutes`);

                    // 启动定时器系统
                    this.startRaceTimer();
                } else {
                    console.log(`⏰ Active race ${activeRace.raceId} has expired, ending it...`);
                    // 比赛已过期，立即结束
                    await this.endRaceById(activeRace.raceId);
                    // 然后开始新比赛
                    this.startFirstRace();
                }
            } else {
                console.log('🆕 No active race found, starting first race...');
                this.startFirstRace();
            }

        } catch (error) {
            console.error('❌ Error initializing from database:', error);
            // 如果数据库恢复失败，直接开始新比赛
            console.log('🔄 Fallback: Starting first race...');
            this.startFirstRace();
        }
    }

    /**
     * 启动第一场比赛
     */
    startFirstRace() {
        console.log('Starting first race...');
        this.startNewRace();
        this.startRaceTimer();
    }

    /**
     * 启动比赛定时器系统（仅用作备份，正常情况下race结束会立即开始下一个）
     */
    startRaceTimer() {
        // 防止重复设置定时器
        if (this.raceTimer) {
            clearInterval(this.raceTimer);
        }

        // 设置备份定时器，防止race意外中断导致无法自动开始下一个
        // 这个定时器应该很少被触发，因为正常情况下race结束会立即开始下一个
        this.raceTimer = setInterval(() => {
            // 检查是否真的需要开始新race
            if (!this.currentRace || this.getCurrentRace().remainingTime <= 0) {
                console.log('🔄 Backup timer triggered - starting new race...');
                this.startNewRace();
            }
        }, this.config.raceInterval);

        console.log(`🔄 Backup race timer started - checks every ${this.config.raceInterval / 1000 / 60 / 60} hours`);
    }

    /**
     * 开始新比赛
     */
    async startNewRace() {
        try {
            const now = new Date();
            const raceId = this.generateRaceId(now.getTime());

            console.log(`\n🏁 Starting new race: ${raceId}`);

            // 如果有当前比赛，先结束它
            if (this.currentRace) {
                await this.endCurrentRace();
            }

            // 在数据库中创建新比赛记录
            const raceDoc = new Race({
                raceId: raceId,
                startTime: now,
                endTime: new Date(now.getTime() + this.config.raceDuration),
                status: 'active',
                createdBy: 'system'
            });

            await raceDoc.save();

            // 更新内存中的当前比赛引用
            this.currentRace = {
                raceId: raceId,
                startTime: now.getTime(),
                endTime: now.getTime() + this.config.raceDuration,
                status: 'active',
                dbId: raceDoc._id
            };

            // 设置当前比赛到缓存管理器
            gameSessionCache.setCurrentRace(raceId);

            // 设置这轮比赛的结束定时器
            setTimeout(() => {
                this.endRaceById(raceId);
            }, this.config.raceDuration);

            console.log(`✅ Race ${raceId} started successfully`);
            console.log(`📅 Duration: ${this.config.raceDuration / 1000 / 60 / 60} hours`);
            console.log(`⏰ Will end at: ${new Date(this.currentRace.endTime).toLocaleString()}`);

        } catch (error) {
            console.error('Error starting new race:', error);
        }
    }

    /**
     * 结束当前比赛
     */
    async endCurrentRace() {
        if (!this.currentRace) {
            console.log('No current race to end');
            return;
        }

        await this.endRaceById(this.currentRace.raceId);
    }

    /**
     * 结束指定比赛
     */
    async endRaceById(raceId) {
        try {
            console.log(`\n Ending race: ${raceId}`);

            // 获取比赛最终数据
            const finalData = await gameSessionCache.finalizeRace(raceId);

            if (finalData) {
                const { leaderboard, prizePool } = finalData;

                console.log(`📊 Race ${raceId} Results:`);
                console.log(`   Participants: ${leaderboard.length}`);
                console.log(`   Prize Pool: ${prizePool.totalPool} coins`);
                console.log(`   Contributed: ${prizePool.contributedAmount} coins`);

                // 计算奖励分配
                const prizeDistribution = gameSessionCache.calculatePrizeDistribution(raceId);

                if (prizeDistribution.distributions.length > 0) {
                    console.log(`💰 Prize Distribution:`);
                    prizeDistribution.distributions.forEach(prize => {
                        console.log(`   Rank ${prize.rank}: ${prize.userId} - ${prize.prizeAmount} coins`);
                    });

                    // 实际发放奖励到用户账户
                    await this.distributePrizes(raceId, prizeDistribution.distributions, leaderboard, prizePool);
                } else {
                    console.log(`❌ No prizes distributed (no contributions)`);
                }

                // 更新数据库中的比赛记录
                const raceDoc = await Race.findOne({ raceId: raceId });
                if (raceDoc) {
                    await raceDoc.complete({
                        leaderboard: leaderboard,
                        prizePool: prizePool,
                        prizeDistribution: prizeDistribution.distributions
                    });

                    console.log(`💾 Race ${raceId} data saved to database`);
                }

                console.log(`✅ Race ${raceId} ended successfully`);
            }

            // 清理当前比赛引用
            if (this.currentRace && this.currentRace.raceId === raceId) {
                this.currentRace = null;
            }

            // 立即开始下一个比赛
            console.log('🚀 Starting next race immediately...');
            this.startNewRace();

        } catch (error) {
            console.error(`Error ending race ${raceId}:`, error);
        }
    }

    /**
     * 分发奖励到用户账户 - 创建奖励记录供用户领取
     */
    async distributePrizes(raceId, distributions, leaderboard, prizePool) {
        if (!distributions || distributions.length === 0) {
            console.log('No prizes to distribute');
            return;
        }

        try {
            // 获取比赛信息
            const raceDoc = await Race.findOne({ raceId: raceId });
            if (!raceDoc) {
                console.error(`Race ${raceId} not found in database`);
                return;
            }

            // 创建用户表现数据的映射
            const userDataMap = new Map();
            leaderboard.forEach(user => {
                userDataMap.set(user.userId, user);
            });

            // 为每个获奖者创建奖励记录
            const prizeRecords = [];

            for (const prize of distributions) {
                const userData = userDataMap.get(prize.userId);
                if (!userData) {
                    console.warn(`User data not found for ${prize.userId}, skipping prize creation`);
                    continue;
                }

                const prizeRecord = {
                    raceId: raceId,
                    userId: prize.userId,
                    rank: prize.rank,
                    prizeAmount: prize.prizeAmount,
                    percentage: prize.percentage,
                    status: 'pending',

                    // 比赛信息
                    raceStartTime: raceDoc.startTime,
                    raceEndTime: raceDoc.endTime,

                    // 用户比赛表现快照
                    userNetProfit: userData.netProfit || 0,
                    userSessionCount: userData.sessionCount || 0,
                    userTotalBetAmount: userData.totalBetAmount || 0,
                    userTotalWinAmount: userData.totalWinAmount || 0,

                    createdBy: 'system'
                };

                prizeRecords.push(prizeRecord);
                console.log(`💸 Created prize record for ${prize.userId} (Rank ${prize.rank}): ${prize.prizeAmount} coins`);
            }

            // 批量创建奖励记录
            if (prizeRecords.length > 0) {
                const createdCount = await RacePrize.batchCreatePrizes(prizeRecords);
                console.log(`✅ Successfully created ${createdCount} prize records for race ${raceId}`);

                // 打印奖励汇总
                const totalPrizes = prizeRecords.reduce((sum, p) => sum + p.prizeAmount, 0);
                console.log(`💰 Total prizes created: ${totalPrizes} coins for ${prizeRecords.length} winners`);
                console.log(`🎁 Prizes are permanently available for claim`);
            }

        } catch (error) {
            console.error(`Failed to distribute prizes for race ${raceId}:`, error);

            // 如果批量创建失败，尝试逐个创建
            console.log('Attempting individual prize creation as fallback...');
            for (const prize of distributions) {
                try {
                    const userData = leaderboard.find(u => u.userId === prize.userId);
                    if (!userData) continue;

                    const racePrize = new RacePrize({
                        raceId: raceId,
                        userId: prize.userId,
                        rank: prize.rank,
                        prizeAmount: prize.prizeAmount,
                        percentage: prize.percentage,
                        raceStartTime: raceDoc.startTime,
                        raceEndTime: raceDoc.endTime,
                        userNetProfit: userData.netProfit || 0,
                        userSessionCount: userData.sessionCount || 0,
                        userTotalBetAmount: userData.totalBetAmount || 0,
                        userTotalWinAmount: userData.totalWinAmount || 0
                    });

                    await racePrize.save();
                    console.log(`✅ Individual prize created for ${prize.userId}`);

                } catch (individualError) {
                    console.error(`Failed to create individual prize for ${prize.userId}:`, individualError);
                }
            }
        }
    }

    /**
     * 生成比赛ID
     */
    generateRaceId(timestamp) {
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        const second = String(date.getSeconds()).padStart(2, '0');

        return `race_${year}${month}${day}${hour}${minute}${second}`;
    }

    /**
     * 获取当前比赛信息
     */
    getCurrentRace() {
        if (!this.currentRace) {
            return null;
        }

        const now = Date.now();
        const remainingTime = Math.max(0, this.currentRace.endTime - now);

        return {
            ...this.currentRace,
            remainingTime: remainingTime,
            isActive: remainingTime > 0
        };
    }

    /**
     * 获取比赛历史
     */
    async getRaceHistory(limit = 5) {
        try {
            return await Race.getRaceHistory(limit);
        } catch (error) {
            console.error('Error getting race history from database:', error);
            return [];
        }
    }

    /**
     * 获取比赛状态统计
     */
    getRaceStats() {
        const currentRace = this.getCurrentRace();

        return {
            currentRace: currentRace,
            raceHistory: this.raceHistory.length,
            nextRaceIn: currentRace ? currentRace.remainingTime : 0,
            systemStatus: 'running'
        };
    }
}

// 单例模式
const raceManager = new RaceManager();

module.exports = raceManager;