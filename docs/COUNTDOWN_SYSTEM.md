# 游戏倒计时系统文档

## 概述

游戏倒计时系统是一个服务器端的倒计时管理器，用于控制每局游戏开始的倒计时。客户端可以通过API接口获取倒计时状态和剩余时间。

## 功能特性

- ⏰ **自动倒计时管理**: 自动创建和管理游戏倒计时
- 🔄 **循环游戏**: 支持自动循环开始新游戏
- 📊 **实时状态**: 提供实时倒计时状态和剩余时间
- ⚙️ **可配置**: 支持动态配置倒计时时长和游戏间隔
- 📈 **统计信息**: 提供倒计时和游戏统计数据
- 🎯 **事件系统**: 支持事件监听和处理
- 🛡️ **错误处理**: 完善的错误处理和恢复机制
- 🖥️ **Web管理界面**: 提供可视化的配置管理页面
- 🔒 **安全配置**: 内置CSP安全策略支持

## 系统架构

### 核心组件

1. **GameCountdownManager**: 倒计时管理器核心类
2. **API Routes**: RESTful API接口
3. **Event System**: 事件发布订阅系统
4. **Configuration**: 动态配置管理
5. **Web Admin Interface**: 前端管理界面
6. **Security Middleware**: CSP安全中间件

### 倒计时状态

- `idle`: 空闲状态，没有活动的倒计时
- `countdown`: 倒计时进行中
- `game_starting`: 游戏即将开始
- `game_active`: 游戏进行中
- `game_ended`: 游戏结束

## API 接口

### 1. 获取倒计时状态

```http
GET /api/game/countdown
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "phase": "betting",
    "remainingTime": 25000,
    "remainingSeconds": 25,
    "isCountingDown": true,
    "bettingCountdown": 30000,
    "gameCountdown": 60000,
    "fixedCrashMultiplier": 2.5
  },
  "timestamp": "2024-01-01T12:00:05.000Z"
}
```

**响应字段说明:**
- `phase`: 当前阶段 (`"betting"` 或 `"gaming"`)
- `remainingTime`: 当前阶段剩余时间（毫秒）
- `remainingSeconds`: 当前阶段剩余时间（秒）
- `isCountingDown`: 是否正在倒计时
- `bettingCountdown`: 下注阶段配置时长（毫秒）
- `gameCountdown`: 游戏阶段配置时长（毫秒）
- `fixedCrashMultiplier`: 当前设置的爆率值（<=0表示随机爆率，>0表示固定爆率）

### 2. 更新倒计时配置

```http
PUT /api/game/countdown/config
Content-Type: application/json

{
  "bettingCountdown": 30000,
  "gameCountdown": 60000,
  "crashMultiplier": 2.5
}
```

**参数说明:**
- `bettingCountdown`: 下注阶段倒计时时长（毫秒），范围: 5000-1800000（可选）
- `gameCountdown`: 游戏阶段倒计时时长（毫秒），范围: 5000-1800000（可选）
- `crashMultiplier`: 爆率值，范围: 0.0-1000.0（可选）
  - `0` 或负数: 设置为随机爆率，系统会自动生成随机爆率值
  - `1.01-1000.0`: 设置为固定爆率值
  - 未提供此参数且当前为随机爆率时，会生成新的随机爆率

**响应示例:**
```json
{
  "success": true,
  "message": "倒计时配置更新成功",
  "data": {
    "bettingCountdown": 30000,
    "gameCountdown": 60000,
    "fixedCrashMultiplier": 2.5
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```



## 配置参数

### 默认配置

```javascript
const defaultConfig = {
    bettingCountdown: 30000,     // 30秒下注倒计时
    gameCountdown: 10000,        // 10秒游戏倒计时
    fixedCrashMultiplier: 0,     // 爆率值（<=0表示随机爆率）
    autoStart: true              // 自动开始倒计时
};
```

### 配置说明

- **bettingCountdown**: 下注阶段的倒计时持续时间（毫秒）
- **gameCountdown**: 游戏阶段的倒计时持续时间（毫秒）
- **fixedCrashMultiplier**: 爆率值设置
  - `<= 0`: 随机爆率模式，系统自动生成随机爆率
  - `> 0`: 固定爆率模式，使用指定的爆率值
- **autoStart**: 是否自动开始倒计时循环

## 事件系统

倒计时管理器支持以下事件:

### 事件类型

```javascript
// 倒计时开始
manager.on('countdownStarted', (data) => {
    console.log('Countdown started:', data);
});

// 倒计时更新（每秒触发）
manager.on('countdownUpdate', (data) => {
    console.log('Remaining time:', data.remainingTime);
});

// 游戏开始
manager.on('gameStarted', (data) => {
    console.log('Game started:', data);
});

// 游戏结束
manager.on('gameEnded', (data) => {
    console.log('Game ended:', data);
});

// 倒计时停止
manager.on('countdownStopped', (data) => {
    console.log('Countdown stopped:', data);
});

// 错误事件
manager.on('error', (error) => {
    console.error('Countdown error:', error);
});
```

## 使用示例

### 客户端轮询示例

```javascript
// 每秒获取倒计时状态
setInterval(async () => {
    try {
        const response = await fetch('/api/game/countdown');
        const data = await response.json();
        
        if (data.success) {
            const { isActive, remainingTime, status } = data.data;
            
            if (isActive) {
                console.log(`倒计时剩余: ${Math.ceil(remainingTime / 1000)}秒`);
                updateCountdownUI(remainingTime);
            } else {
                console.log('当前没有活动的倒计时');
                hideCountdownUI();
            }
        }
    } catch (error) {
        console.error('获取倒计时状态失败:', error);
    }
}, 1000);
```

### WebSocket 集成示例

```javascript
// 在 WebSocket 连接中集成倒计时事件
const gameCountdownManager = require('./services/gameCountdownManager');

// 监听倒计时事件并广播给所有客户端
gameCountdownManager.on('countdownUpdate', (data) => {
    // 广播倒计时更新给所有连接的客户端
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'countdownUpdate',
                data: data
            }));
        }
    });
});

gameCountdownManager.on('gameStarted', (data) => {
    // 广播游戏开始事件
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'gameStarted',
                data: data
            }));
        }
    });
});
```

## 错误处理

### 常见错误码

- `400`: 请求参数错误
- `500`: 服务器内部错误

### 错误响应格式

```json
{
  "success": false,
  "error": "Error Type",
  "message": "详细错误信息",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 错误处理最佳实践

1. **客户端重试**: 在网络错误时实现指数退避重试
2. **状态同步**: 定期同步倒计时状态以防止客户端状态不一致
3. **降级处理**: 在倒计时服务不可用时提供备用方案

## 性能优化

### 服务器端优化

1. **事件驱动**: 使用事件系统减少轮询开销
2. **内存管理**: 及时清理过期的定时器和事件监听器
3. **批量处理**: 批量处理倒计时更新事件

### 客户端优化

1. **智能轮询**: 根据倒计时状态调整轮询频率
2. **缓存策略**: 缓存倒计时配置减少API调用
3. **WebSocket**: 使用WebSocket替代HTTP轮询以获得更好的实时性

## 监控和日志

### 关键指标

- 倒计时成功率
- 平均倒计时时长
- API响应时间
- 错误率

### 日志记录

```javascript
// 倒计时开始日志
console.log('⏰ Countdown started:', {
    duration: config.countdownDuration,
    timestamp: new Date().toISOString()
});

// 游戏开始日志
console.log('🎮 Game started:', {
    gameId: gameId,
    participants: participantCount,
    timestamp: new Date().toISOString()
});

// 错误日志
console.error('❌ Countdown error:', {
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
});
```

## Web管理界面

系统提供了一个可视化的Web管理界面，用于配置和监控倒计时系统。

### 访问地址

```
http://localhost:3000/admin.html
```

### 功能特性

- 📊 **实时配置显示**: 显示当前的下注和游戏倒计时配置
- ⚙️ **配置修改**: 通过表单界面修改倒计时参数
- 🔄 **实时更新**: 支持刷新当前配置
- ✅ **表单验证**: 智能的输入验证和范围检查
- 📱 **响应式设计**: 支持移动设备访问
- 🎨 **现代UI**: 美观的渐变背景和现代化界面

### 功能特性

1. **查看当前配置**: 页面顶部显示当前的下注和游戏阶段时长，以及爆率设置
2. **修改配置**: 在表单中输入新的时长值（毫秒）和爆率值
3. **爆率设置**: 支持设置固定爆率或随机爆率模式
   - 输入 `0` 或留空: 设置为随机爆率
   - 输入 `1.01-1000`: 设置为固定爆率
4. **范围提示**: 表单下方显示有效的时长范围（5秒-30分钟）和爆率范围
5. **提交更新**: 点击"更新配置"按钮应用新设置
6. **刷新配置**: 点击"刷新配置"按钮重新加载当前设置

### 安全配置

为了支持Web管理界面，系统配置了适当的内容安全策略(CSP)：

```javascript
// 在 app.js 中的CSP配置
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "script-src 'self' 'unsafe-inline'; object-src 'none';");
    next();
});
```

**重要提示**: CSP中间件必须在静态文件服务之前配置，以确保对HTML文件生效。

## 部署注意事项

1. **进程管理**: 确保在进程重启时正确恢复倒计时状态
2. **集群部署**: 在多实例部署时考虑倒计时同步问题
3. **数据持久化**: 考虑将倒计时状态持久化到数据库
4. **监控告警**: 设置倒计时异常的监控告警
5. **Web界面安全**: 确保管理界面的访问控制和安全配置
6. **CSP配置**: 正确配置内容安全策略以支持前端功能
7. **配置持久化**: 确保配置文件正确保存和加载
8. **异步保存**: 监控配置保存性能，避免阻塞主线程

## 故障排除

### 常见问题

1. **倒计时不启动**
   - 检查配置是否正确
   - 查看错误日志
   - 确认API接口是否正常

2. **倒计时时间不准确**
   - 检查服务器时间同步
   - 确认定时器精度
   - 考虑网络延迟影响

3. **内存泄漏**
   - 检查事件监听器是否正确清理
   - 确认定时器是否及时清除
   - 监控内存使用情况

4. **Web管理界面无法访问**
   - 确认静态文件服务已启用
   - 检查CSP配置是否正确
   - 验证服务器端口和路径

5. **CSP错误阻止脚本执行**
   - 确保CSP中间件在静态文件服务之前配置
   - 检查CSP策略是否包含 'unsafe-inline'
   - 查看浏览器控制台的具体错误信息

### 调试工具

```javascript
// 启用调试模式
process.env.DEBUG = 'countdown:*';

// 获取详细状态信息
const debugInfo = gameCountdownManager.getDebugInfo();
console.log('Debug info:', debugInfo);
```

## 版本历史

- **v1.0.0**: 初始版本，基础倒计时功能
- **v1.1.0**: 添加事件系统和统计功能
- **v1.2.0**: 增加配置管理和错误处理
- **v1.3.0**: 优化性能和添加监控功能
- **v1.4.0**: 添加Web管理界面和CSP安全配置
  - 新增前端管理页面 (`/admin.html`)
  - 更新API参数名称 (`bettingCountdown`, `gameCountdown`)
  - 配置CSP安全策略支持内联脚本
  - 优化中间件执行顺序
  - 改进错误处理和用户体验
- **v1.5.0**: 爆率管理和配置优化
  - 新增爆率值配置功能 (`crashMultiplier`)
  - 支持固定爆率和随机爆率模式
  - API接口返回当前爆率设置
  - 实现异步延迟配置保存机制
  - 优化服务器性能，避免频繁文件写入
  - 配置持久化，服务器重启后自动恢复设置

## 许可证

本项目采用 MIT 许可证。详见 LICENSE 文件。