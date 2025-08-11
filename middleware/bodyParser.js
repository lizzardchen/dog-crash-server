const bodyParser = require('body-parser');

/**
 * 自定义body解析中间件，用于处理客户端HTTP框架发送的特殊格式数据
 * 这个中间件会在Express标准中间件之后运行，处理已解析的body数据
 */
function customBodyParser(req, res, next) {
    // 添加详细日志来调试数据格式
    console.log('Request Content-Type:', req.get('Content-Type'));
    console.log('Request body type:', typeof req.body);
    console.log('Request body:', req.body);
    
    // 如果body是字符串且看起来像JSON，尝试解析
    if (typeof req.body === 'string') {
        try {
            if (req.body.startsWith('{') && req.body.endsWith('}')) {
                req.body = JSON.parse(req.body);
                console.log('Parsed JSON from string:', req.body);
            }
        } catch (error) {
            console.error('Failed to parse JSON from string:', error);
        }
    }
    
    // 如果是对象，进行数据类型转换
    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
        // 处理URL编码解析后的字符串值，转换为适当的数据类型
        for (const [key, value] of Object.entries(req.body)) {
            if (typeof value === 'string') {
                // 转换布尔值
                if (value === 'true') {
                    req.body[key] = true;
                } else if (value === 'false') {
                    req.body[key] = false;
                } 
                // 转换数字
                else if (!isNaN(value) && value !== '' && !isNaN(parseFloat(value))) {
                    req.body[key] = Number(value);
                }
                // 字符串保持不变
            }
        }
        
        console.log('Final processed body data:', req.body);
    }
    
    next();
}

module.exports = customBodyParser;