#!/bin/bash

# Dog Crash Server 简化部署脚本
# 使用方法: chmod +x deploy.sh && ./deploy.sh

set -e

echo "🚀 开始部署 Dog Crash Server..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置变量
APP_NAME="dog-crash-server"
APP_DIR="/www/wwwroot/dog-crash-server"
PORT="3000"
GIT_REPO="https://github.com/lizzardchen/dog-crash.git"
GIT_BRANCH="main"

echo -e "${YELLOW}1. 创建应用目录并克隆代码...${NC}"

# 如果目录已存在，先备份
if [ -d "$APP_DIR" ]; then
    echo -e "${YELLOW}检测到现有部署，创建备份...${NC}"
    mv "$APP_DIR" "${APP_DIR}.backup.$(date +%Y%m%d_%H%M%S)"
fi

# 创建父目录
mkdir -p "$(dirname "$APP_DIR")"

# 快速下载 server 文件夹（使用 GitHub API）
echo -e "${YELLOW}快速下载 server 文件夹...${NC}"

# 方法1: 使用 GitHub API 下载压缩包
REPO_OWNER="lizzardchen"
REPO_NAME="dog-crash"
DOWNLOAD_URL="https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/zipball/$GIT_BRANCH"

# 下载并解压
cd "$(dirname "$APP_DIR")"
echo -e "${YELLOW}下载代码压缩包...${NC}"
curl -L -o repo.zip "$DOWNLOAD_URL"

echo -e "${YELLOW}解压文件...${NC}"
unzip -q repo.zip
EXTRACTED_DIR=$(find . -maxdepth 1 -name "*$REPO_OWNER-$REPO_NAME-*" -type d)

# 移动 server 文件夹到目标目录
if [ -d "$EXTRACTED_DIR/server" ]; then
    mv "$EXTRACTED_DIR/server" "$APP_DIR"
    echo -e "${GREEN}Server 文件夹移动完成${NC}"
else
    echo -e "${RED}错误: 未找到 server 文件夹${NC}"
    exit 1
fi

# 清理临时文件
rm -rf "$EXTRACTED_DIR" repo.zip

cd "$APP_DIR"

# 初始化 git（为了后续更新）
git init
git remote add origin "$GIT_REPO"

# 验证 package.json 是否存在
if [ ! -f "package.json" ]; then
    echo -e "${RED}错误: 未找到 package.json 文件${NC}"
    echo -e "${YELLOW}请检查仓库中 server 文件夹是否包含正确的 Node.js 项目文件${NC}"
    exit 1
fi

echo -e "${GREEN}代码克隆完成！${NC}"

echo -e "${YELLOW}2. 安装项目依赖...${NC}"
npm install --production

echo -e "${YELLOW}3. 创建环境配置文件...${NC}"
cat > .env << EOF
# 生产环境配置
NODE_ENV=production
PORT=$PORT

# MongoDB 配置
MONGODB_URI=mongodb://dogcrash:5hRPJyResaF75MPh@124.223.21.118:27017/dogcrash

# CORS 配置
ALLOWED_ORIGINS=http://crash.realfunplay.cn,https://crash.realfunplay.cn,http://localhost:7456,http://127.0.0.1:7456

# 安全配置
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
EOF

echo -e "${YELLOW}4. 创建 PM2 配置文件...${NC}"
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: '$APP_NAME',
    script: 'app.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: $PORT
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '512M'
  }]
};
EOF

# 创建日志目录
mkdir -p logs

echo -e "${YELLOW}5. 启动应用...${NC}"
pm2 start ecosystem.config.js
pm2 save

echo -e "${YELLOW}6. 创建更新脚本...${NC}"
cat > update.sh << EOF
#!/bin/bash
# 快速更新脚本

set -e

echo "🔄 开始更新..."

APP_NAME="$APP_NAME"
REPO_OWNER="lizzardchen"
REPO_NAME="dog-crash"
GIT_BRANCH="$GIT_BRANCH"

# 备份重要配置文件
echo "📦 备份配置文件..."
[ -f ".env" ] && cp .env .env.backup
[ -f "ecosystem.config.js" ] && cp ecosystem.config.js ecosystem.config.js.backup

# 下载最新代码
echo "📥 下载最新代码..."
DOWNLOAD_URL="https://api.github.com/repos/\$REPO_OWNER/\$REPO_NAME/zipball/\$GIT_BRANCH"
cd /tmp
curl -L -o repo_update.zip "\$DOWNLOAD_URL"
unzip -q repo_update.zip
EXTRACTED_DIR=\$(find . -maxdepth 1 -name "*\$REPO_OWNER-\$REPO_NAME-*" -type d)

# 更新文件（保留配置）
echo "🔄 更新文件..."
cd "$APP_DIR"
if [ -d "/tmp/\$EXTRACTED_DIR/server" ]; then
    # 备份并删除旧文件（除了配置文件）
    find . -type f ! -name ".env*" ! -name "ecosystem.config.js*" ! -name "*.log" ! -path "./logs/*" ! -path "./node_modules/*" -delete
    
    # 复制新文件
    cp -r /tmp/\$EXTRACTED_DIR/server/* ./
    
    echo "✅ 文件更新完成"
else
    echo "❌ 错误: 未找到 server 文件夹"
    exit 1
fi

# 恢复配置文件
[ -f ".env.backup" ] && mv .env.backup .env
[ -f "ecosystem.config.js.backup" ] && mv ecosystem.config.js.backup ecosystem.config.js

# 清理临时文件
rm -rf /tmp/\$EXTRACTED_DIR /tmp/repo_update.zip

# 安装依赖
echo "📦 安装依赖..."
npm install --production

# 重启应用
echo "🔄 重启应用..."
pm2 restart \$APP_NAME

echo "✅ 更新完成！"
pm2 status
EOF

chmod +x update.sh

echo -e "${GREEN}✅ 部署完成！${NC}"
echo -e "${YELLOW}📝 部署信息:${NC}"
echo -e "  应用目录: $APP_DIR"
echo -e "  运行端口: $PORT"
echo -e "  应用名称: $APP_NAME"

echo -e "${YELLOW}🔧 常用命令:${NC}"
echo -e "  查看状态: pm2 status"
echo -e "  查看日志: pm2 logs $APP_NAME"
echo -e "  重启应用: pm2 restart $APP_NAME"
echo -e "  停止应用: pm2 stop $APP_NAME"
echo -e "  更新代码: cd $APP_DIR && ./update.sh"

echo -e "${GREEN}🎉 服务器部署成功！${NC}"