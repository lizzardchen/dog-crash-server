const mongoose = require('mongoose');
const User = require('../models/User');
const config = require('../config/server');

// 连接数据库
mongoose.connect(config.mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function fixNegativeBalances() {
    try {
        console.log('🔍 Searching for users with negative balance...');
        
        // 查找所有余额为负数的用户
        const usersWithNegativeBalance = await User.find({ balance: { $lt: 0 } });
        
        console.log(`Found ${usersWithNegativeBalance.length} users with negative balance`);
        
        if (usersWithNegativeBalance.length === 0) {
            console.log('✅ No users with negative balance found.');
            return;
        }
        
        // 修复负余额用户
        for (const user of usersWithNegativeBalance) {
            console.log(`Fixing user ${user.userId}: balance ${user.balance} -> 0`);
            user.balance = 0;
            await user.save();
        }
        
        console.log(`✅ Fixed ${usersWithNegativeBalance.length} users with negative balance`);
        
    } catch (error) {
        console.error('❌ Error fixing negative balances:', error);
    } finally {
        mongoose.connection.close();
    }
}

// 运行修复脚本
fixNegativeBalances();
