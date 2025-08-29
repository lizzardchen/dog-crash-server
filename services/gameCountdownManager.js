const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

/**
 * PIG游戏倒计时管理器 (Play Interactive Games)
 * 功能：
 * 1. 管理双阶段循环倒计时：下注倒计时 -> 游戏倒计时 -> 下注倒计时...
 * 2. 提供倒计时状态查询接口
 * 3. 支持倒计时事件监听
 * 4. 自动循环管理PIG模式游戏倒计时
 */
class GameCountdownManager extends EventEmitter {
    constructor() {
        super();
        
        // 配置文件路径
        this.configFilePath = path.join(__dirname, '../config/gameCountdownConfig.json');
        
        // PIG模式倒计时配置（默认值）
        this.defaultConfig = {
            bettingCountdown: 30000,     // 下注倒计时时长（30秒）
            gameCountdown: 60000,        // 游戏倒计时时长（60秒）
            autoStart: true,             // 自动开始下一轮倒计时
            fixedCrashMultiplier: 0      // 固定爆率值（<=0表示使用随机爆率）
        };
        
        // 加载配置（从文件或使用默认值）
        this.config = this.loadConfig();
        
        // 配置保存相关
        this.configSaveTimer = null;
        this.configSaveDelay = 5000; // 5秒延迟保存
        this.hasPendingConfigSave = false;
        
        // 当前状态
        this.currentState = {
            phase: 'idle',               // 当前阶段：'idle', 'betting', 'gaming'
            isCountingDown: false,       // 是否正在倒计时
            countdownStartTime: null,    // 倒计时开始时间
            countdownEndTime: null,      // 倒计时结束时间
            gameId: null,                // 当前游戏ID
            round: 0                     // 游戏轮次
        };
        
        // 定时器
        this.countdownTimer = null;
        
        console.log('PIG GameCountdownManager initialized');
        
        // 如果配置为自动开始，则立即开始第一轮下注倒计时
        if (this.config.autoStart) {
            this.startBettingCountdown();
        }
    }
    
    /**
     * 开始下注倒计时阶段
     */
    startBettingCountdown() {
        // 清除现有定时器
        this.clearTimers();
        
        // 生成新的游戏ID
        const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.currentState.round += 1;
        
        // 设置下注倒计时状态
        this.currentState.phase = 'betting';
        this.currentState.isCountingDown = true;
        this.currentState.countdownStartTime = Date.now();
        this.currentState.countdownEndTime = Date.now() + this.config.bettingCountdown;
        this.currentState.gameId = gameId;
        
        console.log(`💰 Starting betting countdown for game ${gameId}, round ${this.currentState.round}`);
        
        // 发出下注倒计时开始事件
        this.emit('bettingCountdownStarted', {
            gameId: gameId,
            round: this.currentState.round,
            phase: 'betting',
            countdownDuration: this.config.bettingCountdown,
            startTime: this.currentState.countdownStartTime,
            endTime: this.currentState.countdownEndTime
        });
        
        // 设置下注倒计时结束定时器
        this.countdownTimer = setTimeout(() => {
            this.onBettingCountdownFinished();
        }, this.config.bettingCountdown);
    }
    
    /**
     * 开始游戏倒计时阶段
     */
    startGameCountdown() {
        // 清除现有定时器
        this.clearTimers();
        
        // 设置游戏倒计时状态
        this.currentState.phase = 'gaming';
        this.currentState.isCountingDown = true;
        this.currentState.countdownStartTime = Date.now();
        this.currentState.countdownEndTime = Date.now() + this.config.gameCountdown;
        
        console.log(`🎮 Starting game countdown for game ${this.currentState.gameId}, round ${this.currentState.round}`);
        
        // 发出游戏倒计时开始事件
        this.emit('gameCountdownStarted', {
            gameId: this.currentState.gameId,
            round: this.currentState.round,
            phase: 'gaming',
            countdownDuration: this.config.gameCountdown,
            startTime: this.currentState.countdownStartTime,
            endTime: this.currentState.countdownEndTime
        });
        
        // 设置游戏倒计时结束定时器
        this.countdownTimer = setTimeout(() => {
            this.onGameCountdownFinished();
        }, this.config.gameCountdown);
    }
    
    /**
     * 下注倒计时结束处理
     */
    onBettingCountdownFinished() {
        console.log(`💰 Betting countdown finished for game ${this.currentState.gameId}`);
        
        // 发出下注阶段结束事件
        this.emit('bettingPhaseEnded', {
            gameId: this.currentState.gameId,
            round: this.currentState.round,
            endTime: Date.now()
        });
        
        // 自动开始游戏倒计时
        if (this.config.autoStart) {
            this.startGameCountdown();
        } else {
            this.currentState.isCountingDown = false;
            this.currentState.phase = 'idle';
        }
    }
    
    /**
     * 游戏倒计时结束处理
     */
    onGameCountdownFinished() {
        console.log(`🎮 Game countdown finished for game ${this.currentState.gameId}`);
        
        // 发出游戏阶段结束事件
        this.emit('gamePhaseEnded', {
            gameId: this.currentState.gameId,
            round: this.currentState.round,
            endTime: Date.now()
        });
        
        // 自动开始下一轮下注倒计时
        if (this.config.autoStart) {
            this.startBettingCountdown();
        } else {
            this.currentState.isCountingDown = false;
            this.currentState.phase = 'idle';
        }
    }
    
    /**
     * 获取当前倒计时状态
     */
    getCountdownStatus() {
        const now = Date.now();
        
        if (!this.currentState.isCountingDown) {
            return {
                isCountingDown: false,
                phase: this.currentState.phase,
                gameId: this.currentState.gameId,
                round: this.currentState.round,
                message: 'No active countdown'
            };
        }
        
        const remainingTime = Math.max(0, this.currentState.countdownEndTime - now);
        const totalDuration = this.currentState.phase === 'betting' ? 
            this.config.bettingCountdown : this.config.gameCountdown;
        const progress = Math.min(1, (now - this.currentState.countdownStartTime) / totalDuration);
        
        return {
            isCountingDown: true,
            phase: this.currentState.phase,
            gameId: this.currentState.gameId,
            round: this.currentState.round,
            remainingTime: remainingTime,
            remainingSeconds: Math.ceil(remainingTime / 1000),
            progress: progress,
            countdownStartTime: this.currentState.countdownStartTime,
            countdownEndTime: this.currentState.countdownEndTime,
            totalDuration: totalDuration,
            phaseName: this.currentState.phase === 'betting' ? '下注阶段' : '游戏阶段'
        };
    }
    
    /**
     * 手动开始下注倒计时
     */
    startCountdown() {
        if (this.currentState.isCountingDown) {
            console.log('Countdown already in progress');
            return false;
        }
        
        this.startBettingCountdown();
        return true;
    }
    
    /**
     * 手动开始下注阶段
     */
    startBettingPhase() {
        if (this.currentState.isCountingDown) {
            console.log('Countdown already in progress');
            return false;
        }
        
        this.startBettingCountdown();
        return true;
    }
    
    /**
     * 手动开始游戏阶段
     */
    startGamePhase() {
        if (this.currentState.isCountingDown && this.currentState.phase !== 'betting') {
            console.log('Can only start game phase from betting phase or idle');
            return false;
        }
        
        this.startGameCountdown();
        return true;
    }
    
    /**
     * 停止倒计时
     */
    stopCountdown() {
        if (!this.currentState.isCountingDown) {
            console.log('No active countdown to stop');
            return false;
        }
        
        console.log(`🛑 Stopping ${this.currentState.phase} countdown for game ${this.currentState.gameId}`);
        
        // 清除定时器
        this.clearTimers();
        
        const stoppedPhase = this.currentState.phase;
        
        // 重置状态
        this.currentState.isCountingDown = false;
        this.currentState.phase = 'idle';
        this.currentState.countdownStartTime = null;
        this.currentState.countdownEndTime = null;
        
        // 发出倒计时停止事件
        this.emit('countdownStopped', {
            gameId: this.currentState.gameId,
            round: this.currentState.round,
            phase: stoppedPhase,
            stoppedAt: Date.now()
        });
        
        return true;
    }
    
    /**
     * 从文件加载配置
     */
    loadConfig() {
        try {
            if (fs.existsSync(this.configFilePath)) {
                const configData = fs.readFileSync(this.configFilePath, 'utf8');
                const loadedConfig = JSON.parse(configData);
                console.log('GameCountdownManager config loaded from file:', loadedConfig);
                return { ...this.defaultConfig, ...loadedConfig };
            } else {
                console.log('GameCountdownManager config file not found, using default config');
                return { ...this.defaultConfig };
            }
        } catch (error) {
            console.error('Error loading GameCountdownManager config:', error);
            console.log('Using default config instead');
            return { ...this.defaultConfig };
        }
    }
    
    /**
     * 调度配置保存（异步延迟保存）
     */
    scheduleConfigSave() {
        // 如果已有待保存的任务，清除之前的定时器
        if (this.configSaveTimer) {
            clearTimeout(this.configSaveTimer);
        }
        
        this.hasPendingConfigSave = true;
        
        // 设置延迟保存
        this.configSaveTimer = setTimeout(() => {
            this.saveConfigAsync();
        }, this.configSaveDelay);
    }
    
    /**
     * 异步保存配置到文件
     */
    saveConfigAsync() {
        if (!this.hasPendingConfigSave) {
            return;
        }
        
        // 使用 setImmediate 在下一个事件循环中执行，避免阻塞主线程
        setImmediate(() => {
            try {
                // 确保config目录存在
                const configDir = path.dirname(this.configFilePath);
                if (!fs.existsSync(configDir)) {
                    fs.mkdirSync(configDir, { recursive: true });
                }
                
                // 保存配置到文件
                const configData = JSON.stringify(this.config, null, 2);
                fs.writeFileSync(this.configFilePath, configData, 'utf8');
                console.log('GameCountdownManager config saved to file:', this.configFilePath);
                
                this.hasPendingConfigSave = false;
                this.configSaveTimer = null;
            } catch (error) {
                console.error('Error saving GameCountdownManager config:', error);
                this.hasPendingConfigSave = false;
                this.configSaveTimer = null;
            }
        });
    }
    
    /**
     * 立即保存配置到文件（同步方法，仅在必要时使用）
     */
    saveConfig() {
        try {
            // 确保config目录存在
            const configDir = path.dirname(this.configFilePath);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            
            // 保存配置到文件
            const configData = JSON.stringify(this.config, null, 2);
            fs.writeFileSync(this.configFilePath, configData, 'utf8');
            console.log('GameCountdownManager config saved to file:', this.configFilePath);
        } catch (error) {
            console.error('Error saving GameCountdownManager config:', error);
        }
    }
    
    /**
     * 更新PIG模式倒计时配置
     */
    updateConfig(newConfig) {
        const oldConfig = { ...this.config };
        
        // 验证配置参数
        if (newConfig.bettingCountdown && (newConfig.bettingCountdown < 5000 || newConfig.bettingCountdown > 1800000)) {
            throw new Error('Betting countdown must be between 5 seconds and 30 minutes');
        }
        
        if (newConfig.gameCountdown && (newConfig.gameCountdown < 5000 || newConfig.gameCountdown > 1800000)) {
            throw new Error('Game countdown must be between 5 seconds and 30 minutes');
        }
        
        // 验证固定爆率值
        if (newConfig.fixedCrashMultiplier !== undefined) {
            if (typeof newConfig.fixedCrashMultiplier !== 'number' || 
                (newConfig.fixedCrashMultiplier > 0 && 
                 (newConfig.fixedCrashMultiplier < 1.01 || newConfig.fixedCrashMultiplier > 1000))) {
                throw new Error('Fixed crash multiplier must be between 1.01 and 1000.00, or <= 0 for random');
            }
        }
        
        this.config = { ...this.config, ...newConfig };
        
        // 异步延迟保存配置
        this.scheduleConfigSave();
        
        console.log('PIG GameCountdownManager config updated:', {
            old: oldConfig,
            new: this.config
        });
        
        // 发出配置更新事件
        this.emit('configUpdated', {
            oldConfig: oldConfig,
            newConfig: this.config
        });
    }
    
    /**
     * 获取配置信息
     */
    getConfig() {
        return { ...this.config };
    }
    
    /**
     * 清除所有定时器
     */
    clearTimers() {
        if (this.countdownTimer) {
            clearTimeout(this.countdownTimer);
            this.countdownTimer = null;
        }
        
        if (this.configSaveTimer) {
            clearTimeout(this.configSaveTimer);
            this.configSaveTimer = null;
        }
    }
    
    /**
     * 销毁管理器
     */
    destroy() {
        console.log('Destroying PIG GameCountdownManager');
        
        // 如果有待保存的配置，立即保存
        if (this.hasPendingConfigSave) {
            console.log('Saving pending config before destroy...');
            this.saveConfig();
        }
        
        // 清除定时器
        this.clearTimers();
        
        // 移除所有监听器
        this.removeAllListeners();
        
        // 重置状态
        this.currentState = {
            phase: 'idle',
            isCountingDown: false,
            countdownStartTime: null,
            countdownEndTime: null,
            gameId: null,
            round: 0
        };
    }
    
    /**
     * 初始化管理器
     */
    initialize() {
        console.log('Initializing PIG GameCountdownManager...');
        
        // 如果配置为自动开始，则立即开始第一轮下注倒计时
        if (this.config.autoStart) {
            this.startBettingCountdown();
        }
        
        console.log('PIG GameCountdownManager initialized successfully');
    }
    
    /**
     * 清理资源
     */
    cleanup() {
        console.log('Cleaning up PIG GameCountdownManager...');
        this.destroy();
    }
    
    /**
     * 获取统计信息
     */
    getStats() {
        return {
            currentRound: this.currentState.round,
            isActive: this.currentState.isCountingDown,
            uptime: Date.now() - (this.currentState.countdownStartTime || Date.now()),
            config: this.getConfig(),
            status: this.getCountdownStatus()
        };
    }
}

// 创建单例实例
const gameCountdownManager = new GameCountdownManager();

// 监听PIG模式事件并记录日志
gameCountdownManager.on('bettingCountdownStarted', (data) => {
    console.log(`💰 Betting countdown started: Game ${data.gameId}, Round ${data.round}`);
});

gameCountdownManager.on('bettingPhaseEnded', (data) => {
    console.log(`💰 Betting phase ended: Game ${data.gameId}, Round ${data.round}`);
});

gameCountdownManager.on('gameCountdownStarted', (data) => {
    console.log(`🎮 Game countdown started: Game ${data.gameId}, Round ${data.round}`);
});

gameCountdownManager.on('gamePhaseEnded', (data) => {
    console.log(`🎮 Game phase ended: Game ${data.gameId}, Round ${data.round}`);
});

gameCountdownManager.on('countdownStopped', (data) => {
    console.log(`⏹️ ${data.phase} countdown stopped: Game ${data.gameId}, Round ${data.round}`);
});

module.exports = gameCountdownManager;