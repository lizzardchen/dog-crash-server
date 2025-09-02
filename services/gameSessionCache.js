const GameSession = require('../models/GameSession');
const RaceParticipant = require('../models/RaceParticipant');

/**
 * 游戏会话内存缓存管理器 - 基于比赛周期的存储策略
 * 特性：
 * 1. 按比赛ID分组存储游戏记录
 * 2. 实时计算比赛参与者数据
 * 3. 比赛结束后清空相关数据
 * 4. 后台批量存储到数据库
 */
class GameSessionCache {
    constructor() {
        // 按比赛ID分组的缓存
        this.raceSessions = new Map(); // raceId -> { userSessions: Map, globalSessions: Array }
        this.raceParticipants = new Map(); // raceId -> Map<userId, participantData>

        // 当前活跃比赛ID
        this.currentRaceId = null;

        // 待存储队列
        this.pendingSaves = [];

        // 配置
        this.config = {
            maxCacheSize: 50000,                 // 增加缓存容量以支持比赛
            batchSaveInterval: 30000,            // 批量保存间隔（30秒）
            raceParticipantSyncInterval: 300000, // RaceParticipant同步间隔（5分钟）
            raceCleanupDelay: 600000,            // 比赛结束后10分钟清理数据
            cleanupInterval: 600000,             // 清理任务间隔（10分钟）
            poolContributionRate: 0.01           // 奖池贡献率 1%
        };

        // 启动后台任务
        this.startBackgroundTasks();

        console.log('GameSessionCache initialized with race-based storage strategy');
    }

    /**
     * 设置当前活跃比赛ID
     */
    setCurrentRace(raceId) {
        this.currentRaceId = raceId;

        // 初始化比赛数据结构
        if (!this.raceSessions.has(raceId)) {
            this.raceSessions.set(raceId, {
                userSessions: new Map(),
                globalSessions: []
            });
        }

        if (!this.raceParticipants.has(raceId)) {
            this.raceParticipants.set(raceId, new Map());
        }

        console.log(`Current race set to: ${raceId}`);
    }

    /**
     * 添加游戏会话到缓存（基于比赛）
     */
    addSession(sessionData) {
        // 如果没有设置当前比赛，不处理会话
        if (!this.currentRaceId) {
            console.warn('No current race set, session not cached');
            return null;
        }

        const raceId = this.currentRaceId;
        const session = {
            ...sessionData,
            raceId: raceId,
            timestamp: Date.now(),
            netProfit: (sessionData.winAmount - sessionData.betAmount) > 0 ? (sessionData.winAmount - sessionData.betAmount) : 0,
            id: `${sessionData.userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };

        // 获取或创建比赛数据结构
        const raceData = this.raceSessions.get(raceId);

        // 添加到用户会话缓存
        if (!raceData.userSessions.has(sessionData.userId)) {
            raceData.userSessions.set(sessionData.userId, []);
        }
        raceData.userSessions.get(sessionData.userId).push(session);

        // 添加到全局会话缓存
        raceData.globalSessions.push(session);

        // 更新比赛参与者数据
        this.updateRaceParticipant(raceId, sessionData.userId, session);

        // 添加到待存储队列
        this.pendingSaves.push(session);

        console.log(`Race session cached: ${session.id} for race ${raceId}, net profit: ${session.netProfit}`);
        return session;
    }

    /**
     * 更新比赛参与者统计数据 - 支持Top1000动态维护
     */
    updateRaceParticipant(raceId, userId, session) {
        const participants = this.raceParticipants.get(raceId);

        if (!participants.has(userId)) {
            participants.set(userId, {
                raceId: raceId,
                userId: userId,
                totalBetAmount: 0,
                totalWinAmount: 0,
                netProfit: 0,
                contributionToPool: 0,
                sessionCount: 0,
                lastUpdateTime: Date.now()
            });
        }

        const participant = participants.get(userId);
        participant.totalBetAmount += session.betAmount;
        participant.totalWinAmount += (session.winAmount || 0);
        participant.netProfit += session.netProfit;
        participant.contributionToPool += Math.max(0, session.winAmount || 0) * this.config.poolContributionRate;
        participant.sessionCount += 1;
        participant.lastUpdateTime = Date.now();

        // Top1000动态维护
        this.maintainTop1000(raceId);

        console.log(`Updated participant ${userId} in race ${raceId}: net profit ${participant.netProfit}`);
    }

    /**
     * 从数据库恢复比赛数据（服务器重启时）
     */
    async restoreFromDatabase(raceId) {
        try {
            console.log(`🔄 Restoring race data from database for race: ${raceId}`);

            // 设置当前比赛ID
            this.setCurrentRace(raceId);

            // 1. 恢复Top1000参与者数据
            await this.restoreRaceParticipants(raceId);

            // 2. 恢复最近的GameSession数据（可选，用于缓存热数据）
            await this.restoreRecentGameSessions(raceId);

            console.log(`✅ Successfully restored race data for race: ${raceId}`);

        } catch (error) {
            console.error(`❌ Error restoring race data for ${raceId}:`, error);
            throw error;
        }
    }

    /**
     * 从数据库恢复Top1000参与者数据
     */
    async restoreRaceParticipants(raceId) {
        try {
            // 从RaceParticipant表恢复Top1000数据
            const dbParticipants = await RaceParticipant.getLeaderboard(raceId, 1000);

            if (dbParticipants.length === 0) {
                console.log(`📝 No participant data found for race ${raceId}`);
                return;
            }

            const participants = this.raceParticipants.get(raceId);

            // 将数据库数据加载到内存
            dbParticipants.forEach(participant => {
                participants.set(participant.userId, {
                    raceId: participant.raceId,
                    userId: participant.userId,
                    totalBetAmount: participant.totalBetAmount,
                    totalWinAmount: participant.totalWinAmount,
                    netProfit: participant.netProfit,
                    contributionToPool: participant.contributionToPool,
                    sessionCount: participant.sessionCount,
                    lastUpdateTime: new Date(participant.lastUpdateTime).getTime()
                });
            });

            console.log(`📊 Restored ${dbParticipants.length} participants for race ${raceId}`);

        } catch (error) {
            console.error(`Error restoring race participants for ${raceId}:`, error);
            throw error;
        }
    }

    /**
     * 从数据库恢复最近的GameSession数据（用于缓存热数据）
     */
    async restoreRecentGameSessions(raceId, limit = 1000) {
        try {
            // 恢复最近的GameSession数据到内存缓存
            const recentSessions = await GameSession.find({ raceId })
                .sort({ createdAt: -1 })
                .limit(limit)
                .lean();

            if (recentSessions.length === 0) {
                console.log(`📝 No recent sessions found for race ${raceId}`);
                return;
            }

            const raceData = this.raceSessions.get(raceId);

            // 转换数据格式并加载到内存
            recentSessions.reverse().forEach(session => {
                const sessionData = {
                    id: session.sessionId,
                    sessionId: session.sessionId,
                    raceId: session.raceId,
                    userId: session.userId,
                    betAmount: session.betAmount,
                    winAmount: (session.cashOutMultiplier > 0) ? session.betAmount * session.cashOutMultiplier : 0,
                    crashMultiplier: session.crashMultiplier,
                    isWin: session.isWin,
                    netProfit: session.profit,
                    timestamp: new Date(session.gameStartTime).getTime(),
                    gameDuration: session.gameDuration,
                    isFreeMode: session.isFreeMode || false
                };

                // 添加到用户会话缓存
                if (!raceData.userSessions.has(session.userId)) {
                    raceData.userSessions.set(session.userId, []);
                }
                raceData.userSessions.get(session.userId).push(sessionData);

                // 添加到全局会话缓存
                raceData.globalSessions.push(sessionData);
            });

            console.log(`🎮 Restored ${recentSessions.length} recent game sessions for race ${raceId}`);

        } catch (error) {
            console.error(`Error restoring game sessions for ${raceId}:`, error);
            // 这里不抛出错误，因为GameSession缓存不是关键数据
            console.log(`⚠️  Continuing without GameSession cache for race ${raceId}`);
        }
    }

    /**
     * 维护Top1000排行榜 - 动态插入删除机制
     */
    maintainTop1000(raceId) {
        const participants = this.raceParticipants.get(raceId);
        if (!participants || participants.size <= 1000) {
            return; // 参与者不超过1000，无需维护
        }

        // 转换为数组并按净收益排序
        const sortedParticipants = Array.from(participants.entries())
            .map(([userId, data]) => ({ userId, ...data }))
            .sort((a, b) => {
                if (b.netProfit !== a.netProfit) {
                    return b.netProfit - a.netProfit;
                }
                return a.userId.localeCompare(b.userId);
            });

        // 如果超过1000人，移除排名1001及以后的参与者
        if (sortedParticipants.length > 1000) {
            const participantsToRemove = sortedParticipants.slice(1000);
            participantsToRemove.forEach(participant => {
                participants.delete(participant.userId);
            });

            console.log(`Maintained Top1000: removed ${participantsToRemove.length} participants from race ${raceId}`);
        }
    }

    /**
     * 获取比赛排行榜
     */
    getRaceLeaderboard(raceId, limit = 100) {
        const participants = this.raceParticipants.get(raceId);
        if (!participants) {
            return [];
        }

        // 转换为数组并按contributionToPool排序，contributionToPool相同则按userId排序
        const leaderboard = Array.from(participants.values())
            .sort((a, b) => {
                if (b.contributionToPool !== a.contributionToPool) {
                    return b.contributionToPool - a.contributionToPool;
                }
                return a.userId.localeCompare(b.userId);
            })
            .slice(0, limit)
            .map((participant, index) => ({
                ...participant,
                rank: index + 1
            }));

        return leaderboard;
    }

    /**
     * 获取比赛排行榜（包含指定用户的完整信息）
     */
    getRaceLeaderboardWithUser(raceId, userId, topLimit = 10) {
        const participants = this.raceParticipants.get(raceId);

        // 获取前N名
        const topLeaderboard = this.getRaceLeaderboard(raceId, topLimit);

        // 获取用户数据（包含真实排名，即使在topLimit之外）
        const userData = this.getUserRaceData(raceId, userId);

        return {
            topLeaderboard: topLeaderboard,
            userRank: userData.rank,
            userDisplayRank: userData.displayRank,
            userNetProfit: userData.netProfit,
            userSessionCount: userData.sessionCount,
            userContribution: userData.contributionToPool,
            totalParticipants: userData.totalParticipants
        };
    }

    /**
     * 获取用户在比赛中的排名和数据
     */
    getUserRaceData(raceId, userId) {
        const participants = this.raceParticipants.get(raceId);

        // 如果用户没有游戏记录，创建默认的0贡献记录
        if (!participants || !participants.has(userId)) {
            const allParticipants = participants ? Array.from(participants.values()) : [];

            // 计算该用户在所有参与者中的排名（0贡献用户）
            // 0贡献用户排在所有正贡献用户之后，但按userId排序保持一致性
            const positiveParticipants = allParticipants.filter(p => p.netProfit > 0);
            const zeroParticipants = allParticipants.filter(p => p.netProfit <= 0);

            // 将当前用户加入0贡献组进行排序
            const userDefaultData = {
                raceId: raceId,
                userId: userId,
                totalBetAmount: 0,
                totalWinAmount: 0,
                netProfit: 0,
                contributionToPool: 0,
                sessionCount: 0,
                lastUpdateTime: null
            };

            const allZeroParticipants = [...zeroParticipants, userDefaultData];
            // 0贡献用户按userId排序，保持排名一致性
            allZeroParticipants.sort((a, b) => a.userId.localeCompare(b.userId));

            const userZeroRank = allZeroParticipants.findIndex(p => p.userId === userId) + 1;
            const finalRank = positiveParticipants.length + userZeroRank;
            const totalParticipants = allParticipants.length + 1; // +1是当前用户

            // 如果排名超过1000，给一个1000+的随机排名供客户端显示
            const displayRank = finalRank > 1000 ?
                Math.floor(Math.random() * 9000) + 1001 : // 1001-10000随机
                finalRank;

            return {
                ...userDefaultData,
                rank: finalRank,
                displayRank: displayRank,
                totalParticipants: totalParticipants
            };
        }

        // 用户有游戏记录，计算实际排名
        const userData = participants.get(userId);
        const allParticipants = Array.from(participants.values());

        // 按净收益排序，净收益相同则按userId排序保持一致性
        const sortedParticipants = allParticipants.sort((a, b) => {
            if (b.netProfit !== a.netProfit) {
                return b.netProfit - a.netProfit;
            }
            return a.userId.localeCompare(b.userId);
        });

        const rank = sortedParticipants.findIndex(p => p.userId === userId) + 1;

        // 如果排名超过1000，给一个1000+的随机排名供客户端显示
        const displayRank = rank > 1000 ?
            Math.floor(Math.random() * 9000) + 1001 : // 1001-10000随机
            rank;

        return {
            ...userData,
            rank: rank,
            displayRank: displayRank,
            totalParticipants: allParticipants.length
        };
    }

    /**
     * 计算比赛奖池总额和奖励分配
     */
    calculateRacePrizePool(raceId) {
        const participants = this.raceParticipants.get(raceId);
        if (!participants) {
            return {
                totalPool: 0,
                contributedAmount: 0,
                minGuarantee: 50000,
                shouldDistributePrizes: false,
                participants: 0
            };
        }

        const contributedAmount = Array.from(participants.values())
            .reduce((sum, p) => sum + p.contributionToPool, 0);

        const totalPool = Math.max(contributedAmount, 50000); // 最低保证50000

        // 判断是否应该发放奖励：只有当有实际贡献时才发放
        const shouldDistributePrizes = contributedAmount > 0;

        return {
            totalPool: totalPool,
            contributedAmount: contributedAmount,
            minGuarantee: 50000,
            shouldDistributePrizes: shouldDistributePrizes,
            participants: participants.size
        };
    }

    /**
     * 计算奖励分配
     */
    calculatePrizeDistribution(raceId) {
        const prizePool = this.calculateRacePrizePool(raceId);
        const leaderboard = this.getRaceLeaderboard(raceId, 1000); // 获取所有参与者

        // 如果不应该发放奖励，返回空分配
        if (!prizePool.shouldDistributePrizes || leaderboard.length === 0) {
            return {
                distributions: [],
                totalDistributed: 0,
                prizePool: prizePool
            };
        }

        const distributions = [];
        const totalPool = prizePool.totalPool;

        // 奖励分配规则
        const prizeRules = [
            { rank: 1, percentage: 0.50 },    // 第一名 50%
            { rank: 2, percentage: 0.25 },    // 第二名 25%
            { rank: 3, percentage: 0.11 }     // 第三名 11%
        ];

        let distributedAmount = 0;

        // 分配前三名奖励
        prizeRules.forEach(rule => {
            if (leaderboard.length >= rule.rank) {
                const participant = leaderboard[rule.rank - 1];
                const prizeAmount = Math.floor(totalPool * rule.percentage);

                distributions.push({
                    userId: participant.userId,
                    rank: rule.rank,
                    prizeAmount: prizeAmount,
                    percentage: rule.percentage
                });

                distributedAmount += prizeAmount;
            }
        });

        // 4-10名均分剩余的14%
        const remainingPercentage = 0.14;
        const remainingAmount = Math.floor(totalPool * remainingPercentage);
        const rank4to10 = leaderboard.slice(3, 10); // 第4到第10名

        if (rank4to10.length > 0) {
            const prizePerUser = Math.floor(remainingAmount / rank4to10.length);

            rank4to10.forEach((participant, index) => {
                distributions.push({
                    userId: participant.userId,
                    rank: index + 4,
                    prizeAmount: prizePerUser,
                    percentage: prizePerUser / totalPool
                });

                distributedAmount += prizePerUser;
            });
        }

        return {
            distributions: distributions,
            totalDistributed: distributedAmount,
            prizePool: prizePool
        };
    }

    /**
     * 获取用户会话历史（按比赛ID）
     */
    getUserSessions(userId, raceId = null, limit = 50) {
        if (raceId) {
            // 获取指定比赛的用户会话
            const raceData = this.raceSessions.get(raceId);
            if (!raceData) return [];

            const userSessions = raceData.userSessions.get(userId) || [];
            return userSessions
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, limit);
        } else {
            // 获取当前比赛的用户会话
            return this.getUserSessions(userId, this.currentRaceId, limit);
        }
    }

    /**
     * 获取全局统计
     */
    getGlobalStats() {
        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);

        // 过滤最近24小时的数据
        const recentSessions = this.globalSessions.filter(s => s.timestamp > oneDayAgo);

        const totalSessions = recentSessions.length;
        const wins = recentSessions.filter(s => s.isWin).length;
        const totalBetAmount = recentSessions.reduce((sum, s) => sum + s.betAmount, 0);
        const totalWinAmount = recentSessions.reduce((sum, s) => sum + (s.winAmount || 0), 0);

        const multipliers = recentSessions.map(s => s.crashMultiplier).filter(m => m > 0);
        const avgMultiplier = multipliers.length > 0 ?
            multipliers.reduce((sum, m) => sum + m, 0) / multipliers.length : 0;
        const maxMultiplier = multipliers.length > 0 ? Math.max(...multipliers) : 0;

        return {
            totalSessions,
            winRate: totalSessions > 0 ? (wins / totalSessions * 100).toFixed(2) : 0,
            totalBetAmount: totalBetAmount.toFixed(2),
            totalWinAmount: totalWinAmount.toFixed(2),
            avgMultiplier: avgMultiplier.toFixed(2),
            maxMultiplier: maxMultiplier.toFixed(2),
            cacheSize: this.globalSessions.length,
            pendingSaves: this.pendingSaves.length
        };
    }

    /**
     * 获取最近的崩盘记录
     */
    getRecentCrashes(limit = 10) {
        return this.globalSessions
            .filter(s => s.crashMultiplier > 0)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit)
            .map(s => ({
                multiplier: s.crashMultiplier,
                timestamp: s.timestamp,
                isWin: s.isWin
            }));
    }

    /**
     * 启动后台任务
     */
    startBackgroundTasks() {
        // 批量保存任务
        setInterval(() => {
            this.batchSaveToDB();
        }, this.config.batchSaveInterval);

        // RaceParticipant数据同步任务（5分钟间隔）
        setInterval(() => {
            this.batchSyncRaceParticipants();
        }, this.config.raceParticipantSyncInterval);

        // 清理任务
        setInterval(() => {
            this.cleanup();
        }, this.config.cleanupInterval);

        console.log('Background tasks started for GameSessionCache');
        console.log(`- GameSession batch save: every ${this.config.batchSaveInterval / 1000}s`);
        console.log(`- RaceParticipant sync: every ${this.config.raceParticipantSyncInterval / 1000}s`);
    }

    /**
     * 批量保存到数据库
     */
    async batchSaveToDB() {
        if (this.pendingSaves.length === 0) {
            return;
        }

        const sessionsToSave = [...this.pendingSaves];
        this.pendingSaves = []; // 清空待保存队列

        try {
            console.log(`Batch saving ${sessionsToSave.length} sessions to database...`);

            // 转换为数据库格式
            const dbSessions = sessionsToSave.map(session => ({
                sessionId: session.sessionId || session.id,
                raceId: session.raceId, // 添加必需的raceId字段
                userId: session.userId,
                betAmount: session.betAmount,
                crashMultiplier: session.crashMultiplier || session.multiplier,
                cashOutMultiplier: session.isWin ? (session.crashMultiplier || session.multiplier) : 0,
                isWin: session.isWin,
                profit: session.isWin ? (session.winAmount - session.betAmount) : -session.betAmount,
                gameStartTime: new Date(session.timestamp),
                gameEndTime: new Date(session.timestamp + (session.gameDuration || 0)),
                gameDuration: session.gameDuration || 0,
                isFreeMode: session.isFreeMode || false
            }));

            // 批量插入
            await GameSession.insertMany(dbSessions, { ordered: false });
            console.log(`Successfully saved ${dbSessions.length} sessions to database`);

        } catch (error) {
            console.error('Error batch saving sessions:', error);
            // 如果保存失败，将会话重新加入队列（但限制重试次数）
            const retriableSessions = sessionsToSave.filter(s => !s.retryCount || s.retryCount < 3);
            retriableSessions.forEach(s => {
                s.retryCount = (s.retryCount || 0) + 1;
                this.pendingSaves.push(s);
            });
        }
    }

    /**
     * 比赛结束后清理比赛数据
     */
    async finalizeRace(raceId) {
        console.log(`Finalizing race: ${raceId}`);

        // 获取最终排行榜和奖池信息
        const leaderboard = this.getRaceLeaderboard(raceId);
        const prizePool = this.calculateRacePrizePool(raceId);

        // 批量保存比赛数据到数据库
        await this.saveRaceDataToDB(raceId);

        // 延迟清理内存数据（给API查询留出时间）
        setTimeout(() => {
            this.cleanupRaceData(raceId);
        }, this.config.raceCleanupDelay);

        return {
            raceId: raceId,
            leaderboard: leaderboard,
            prizePool: prizePool,
            finalizedAt: Date.now()
        };
    }

    /**
     * 清理指定比赛的数据
     */
    cleanupRaceData(raceId) {
        const raceData = this.raceSessions.get(raceId);
        if (raceData) {
            const sessionCount = raceData.globalSessions.length;
            console.log(`Cleaning up race ${raceId} data: ${sessionCount} sessions`);
        }

        // 清理比赛会话数据
        this.raceSessions.delete(raceId);

        // 清理比赛参与者数据
        this.raceParticipants.delete(raceId);

        console.log(`Race ${raceId} data cleaned up from memory`);
    }

    /**
     * 将比赛数据保存到数据库
     */
    async saveRaceDataToDB(raceId) {
        try {
            const raceData = this.raceSessions.get(raceId);
            if (!raceData) return;

            // 保存所有会话记录
            const sessions = raceData.globalSessions;
            if (sessions.length > 0) {
                const dbSessions = sessions.map(session => ({
                    sessionId: session.sessionId || session.id,
                    raceId: session.raceId,
                    userId: session.userId,
                    betAmount: session.betAmount,
                    crashMultiplier: session.crashMultiplier || session.multiplier,
                    cashOutMultiplier: session.isWin ? (session.crashMultiplier || session.multiplier) : 0,
                    isWin: session.isWin,
                    winAmount: session.winAmount || 0,
                    netProfit: session.netProfit,
                    profit: session.netProfit,
                    gameStartTime: new Date(session.timestamp),
                    gameEndTime: new Date(session.timestamp + (session.gameDuration || 0)),
                    gameDuration: session.gameDuration || 0,
                    isFreeMode: session.isFreeMode || false
                }));

                await GameSession.insertMany(dbSessions, { ordered: false });
                console.log(`Saved ${dbSessions.length} race sessions to database`);
            }

        } catch (error) {
            console.error(`Error saving race ${raceId} data to database:`, error);
        }
    }

    /**
     * 批量同步RaceParticipant数据到数据库（5分钟定时任务）
     */
    async batchSyncRaceParticipants() {
        if (!this.currentRaceId) {
            return; // 没有活跃比赛
        }

        try {
            const raceId = this.currentRaceId;
            const participants = this.raceParticipants.get(raceId);

            if (!participants || participants.size === 0) {
                return; // 没有参与者数据
            }

            // 获取排序后的Top1000参与者数据
            const leaderboard = this.getRaceLeaderboard(raceId, 1000);

            if (leaderboard.length === 0) {
                return;
            }

            // 转换为数据库格式
            const participantData = leaderboard.map(participant => ({
                raceId: participant.raceId,
                userId: participant.userId,
                totalBetAmount: participant.totalBetAmount,
                totalWinAmount: participant.totalWinAmount,
                netProfit: participant.netProfit,
                contributionToPool: participant.contributionToPool,
                sessionCount: participant.sessionCount,
                rank: participant.rank,
                lastUpdateTime: new Date(participant.lastUpdateTime)
            }));

            // 批量更新到数据库（已包含重试机制）
            await RaceParticipant.batchUpsert(raceId, participantData);

            console.log(`✅ Batch synced ${participantData.length} race participants to database for race ${raceId}`);

            // 重置失败计数器
            if (!this.syncFailureCount) this.syncFailureCount = {};
            this.syncFailureCount[raceId] = 0;

        } catch (error) {
            // 记录失败次数
            if (!this.syncFailureCount) this.syncFailureCount = {};
            this.syncFailureCount[this.currentRaceId] = (this.syncFailureCount[this.currentRaceId] || 0) + 1;

            const failureCount = this.syncFailureCount[this.currentRaceId];

            console.error(`❌ Error batch syncing race participants (failure #${failureCount}):`, error.message);

            // 连续失败告警
            if (failureCount >= 3) {
                console.error(`🚨 ALERT: Race participant sync has failed ${failureCount} times consecutively for race ${this.currentRaceId}`);
            }

            // 降级处理：继续运行但跳过本次同步
            console.log(`⚠️  Skipping this sync cycle, will retry in next interval`);
        }
    }

    /**
     * 清理过期数据（现在主要用于清理待保存队列）
     */
    cleanup() {
        // 清理超时的待保存数据
        const now = Date.now();
        const oldPendingCount = this.pendingSaves.length;

        this.pendingSaves = this.pendingSaves.filter(session => {
            // 保留最近1小时内的待保存数据
            return (now - session.timestamp) < (60 * 60 * 1000);
        });

        const cleanedCount = oldPendingCount - this.pendingSaves.length;
        if (cleanedCount > 0) {
            console.log(`Cleaned up ${cleanedCount} expired pending saves`);
        }
    }

    /**
     * 清理数据库中的过期数据
     */
    async cleanupDatabase() {
        try {
            const cutoffDate = new Date(Date.now() - (this.config.retentionHours * 60 * 60 * 1000));
            const result = await GameSession.deleteMany({
                gameStartTime: { $lt: cutoffDate }
            });

            if (result.deletedCount > 0) {
                console.log(`Cleaned up ${result.deletedCount} expired sessions from database`);
            }
        } catch (error) {
            console.error('Error cleaning up database:', error);
        }
    }

    /**
     * 获取缓存状态信息
     */
    getCacheStatus() {
        const totalSessions = Array.from(this.raceSessions.values())
            .reduce((sum, raceData) => sum + raceData.globalSessions.length, 0);

        const totalParticipants = Array.from(this.raceParticipants.values())
            .reduce((sum, participants) => sum + participants.size, 0);

        return {
            currentRaceId: this.currentRaceId,
            totalRaces: this.raceSessions.size,
            totalSessions: totalSessions,
            totalParticipants: totalParticipants,
            pendingSaves: this.pendingSaves.length,
            config: this.config
        };
    }
}

// 单例模式
const gameSessionCache = new GameSessionCache();

module.exports = gameSessionCache;