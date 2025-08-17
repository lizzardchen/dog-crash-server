const mongoose = require('mongoose');
const GameSession = require('./models/GameSession');
require('dotenv').config();

async function testDatabaseInsert() {
    try {
        // 连接数据库
        console.log('Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://dogcrash:5hRPJyResaF75MPh@124.223.21.118:27017/dogcrash', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Database connected successfully');

        // 测试数据
        const testSession = {
            sessionId: `test_${Date.now()}`,
            raceId: 'test_race_001',
            userId: 'test_user_001',
            betAmount: 100,
            crashMultiplier: 2.5,
            cashOutMultiplier: 2.0,
            isWin: true,
            profit: 100,
            gameStartTime: new Date(),
            gameEndTime: new Date(Date.now() + 5000),
            gameDuration: 5000,
            isFreeMode: false
        };

        console.log('Inserting test session:', JSON.stringify(testSession, null, 2));
        
        // 插入测试数据
        const result = await GameSession.create(testSession);
        console.log('Insert successful:', result._id);

        // 查询验证
        const found = await GameSession.findById(result._id);
        console.log('Found in database:', found ? 'YES' : 'NO');

        // 清理测试数据
        await GameSession.findByIdAndDelete(result._id);
        console.log('Test data cleaned up');

    } catch (error) {
        console.error('Test failed:', error);
        if (error.name === 'ValidationError') {
            console.error('Validation errors:', error.errors);
        }
    } finally {
        await mongoose.disconnect();
        console.log('Database disconnected');
    }
}

// 运行测试
testDatabaseInsert();