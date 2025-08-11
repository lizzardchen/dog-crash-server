# Dog Crash Game Server

Dog Crash游戏的后端服务器，提供用户管理、游戏数据持久化等功能。

## 功能特性

- 🎮 用户创建和管理
- 📊 游戏数据持久化
- 🏆 排行榜系统
- 📱 RESTful API
- 🔒 数据验证和错误处理
- 🚀 高性能MongoDB存储

## 技术栈

- **后端框架**: Express.js
- **数据库**: MongoDB + Mongoose
- **验证**: Joi + express-validator
- **安全**: Helmet, CORS, Rate Limiting
- **工具**: UUID, Morgan (日志)

## 安装和运行

### 1. 安装依赖

```bash
cd server
npm install
```

### 2. 环境配置

复制环境变量模板：
```bash
cp .env.example .env
```

编辑 `.env` 文件：
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://dogcrash:5hRPJyResaF75MPh@124.223.21.118:27017/dogcrash
ALLOWED_ORIGINS=http://localhost:7456,http://127.0.0.1:7456
```

### 3. 启动MongoDB

确保MongoDB服务正在运行：
```bash
# macOS (使用Homebrew)
brew services start mongodb-community

# 或者直接运行
mongod
```

### 4. 启动服务器

```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

服务器将在 `http://localhost:3000` 启动。

## API接口

### 用户相关接口

#### 获取或创建用户
```http
GET /api/user/:userId
```

响应示例：
```json
{
  "success": true,
  "data": {
    "userId": "user123",
    "username": "Player_user123",
    "balance": 1000,
    "totalFlights": 0,
    "flightsWon": 0,
    "highestMultiplier": 1.0,
    "winRate": 0,
    "rank": 1,
    "settings": {
      "soundEnabled": true,
      "musicEnabled": true,
      "language": "zh"
    }
  }
}
```

#### 更新用户游戏记录
```http
POST /api/user/:userId/record
Content-Type: application/json

{
  "betAmount": 100,
  "multiplier": 2.5,
  "winAmount": 250,
  "isWin": true,
  "sessionId": "session123",
  "gameDuration": 5000,
  "isFreeMode": false
}
```

#### 更新用户设置
```http
PUT /api/user/:userId/settings
Content-Type: application/json

{
  "soundEnabled": true,
  "musicEnabled": false,
  "language": "en",
  "autoCashOut": {
    "enabled": true,
    "multiplier": 2.0,
    "totalBets": 10
  }
}
```

#### 获取用户游戏历史
```http
GET /api/user/:userId/history?limit=20
```

#### 获取排行榜
```http
GET /api/user/leaderboard?limit=10
```

### 游戏相关接口

#### 获取游戏统计
```http
GET /api/game/stats
```

#### 获取游戏历史
```http
GET /api/game/history?limit=20
```

#### 获取游戏配置
```http
GET /api/game/config
```

### 健康检查

```http
GET /health
```

## 数据模型

### 用户模型 (User)

```javascript
{
  userId: String,        // 唯一用户ID
  username: String,      // 用户名
  balance: Number,       // 余额
  totalFlights: Number,  // 总游戏次数
  flightsWon: Number,    // 获胜次数
  highestMultiplier: Number,  // 最高倍数
  highestBetAmount: Number,   // 最高倍数时的下注
  highestWinAmount: Number,   // 最高倍数时的奖金
  settings: Object,      // 用户设置
  createdAt: Date,       // 创建时间
  lastLoginAt: Date,     // 最后登录时间
  isActive: Boolean      // 是否活跃
}
```

### 游戏会话模型 (GameSession)

```javascript
{
  sessionId: String,     // 会话ID
  userId: String,        // 用户ID
  betAmount: Number,     // 下注金额
  crashMultiplier: Number,   // 崩盘倍数
  cashOutMultiplier: Number, // 提现倍数
  isWin: Boolean,        // 是否获胜
  profit: Number,        // 收益
  gameStartTime: Date,   // 游戏开始时间
  gameEndTime: Date,     // 游戏结束时间
  gameDuration: Number,  // 游戏持续时间
  isFreeMode: Boolean    // 是否免费模式
}
```

## 错误处理

服务器使用统一的错误处理格式：

```json
{
  "error": "Validation Error",
  "message": "Request validation failed",
  "details": [
    {
      "field": "betAmount",
      "message": "Bet amount must be a number",
      "value": "invalid"
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/user/123/record",
  "method": "POST"
}
```

## 安全特性

- 🛡️ **速率限制**: 防止API滥用
- 🔐 **输入验证**: 严格的数据验证
- 🚫 **安全头**: Helmet.js安全头
- 🌐 **CORS配置**: 跨域请求控制
- 📝 **请求日志**: 详细的访问日志

## 开发

### 项目结构

```
server/
├── config/          # 配置文件
│   ├── database.js  # 数据库配置
│   └── server.js    # 服务器配置
├── controllers/     # 控制器
│   └── userController.js
├── middleware/      # 中间件
│   ├── errorHandler.js
│   └── validation.js
├── models/          # 数据模型
│   ├── User.js
│   └── GameSession.js
├── routes/          # 路由定义
│   ├── user.js
│   └── game.js
├── utils/           # 工具函数
│   └── helpers.js
├── app.js           # 应用入口
├── package.json     # 依赖配置
└── README.md        # 说明文档
```

### 环境变量

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `PORT` | 服务器端口 | `3000` |
| `NODE_ENV` | 运行环境 | `development` |
| `MONGODB_URI` | MongoDB连接字符串 | `mongodb://dogcrash:5hRPJyResaF75MPh@124.223.21.118:27017/dogcrash` |
| `ALLOWED_ORIGINS` | 允许的CORS源 | `http://localhost:7456` |

### 测试

```bash
# 运行测试（待实现）
npm test
```

## 部署

### 生产环境配置

1. 设置环境变量：
```bash
export NODE_ENV=production
export PORT=3000
export MONGODB_URI=mongodb://dogcrash:5hRPJyResaF75MPh@124.223.21.118:27017/dogcrash
```

2. 启动服务器：
```bash
npm start
```

### Docker部署（可选）

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 监控和日志

- 📊 健康检查端点: `/health`
- 📝 详细的请求/响应日志
- ⚡ 性能监控
- 🚨 错误追踪

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！

## 更新日志

### v1.0.0
- ✅ 用户创建和管理
- ✅ 游戏数据持久化
- ✅ 排行榜功能
- ✅ RESTful API
- ✅ 数据验证和错误处理