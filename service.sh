#!/bin/bash

# Dog Crash Server 后台服务管理脚本
#
# 使用方法:
# chmod +x service.sh
# ./service.sh start     - 启动应用
# ./service.sh stop      - 停止应用
# ./service.sh restart   - 重启应用
# ./service.sh status    - 查看状态
# ./service.sh logs      - 查看日志
# ./service.sh setup     - (首次运行)设置开机自启

set -e

# --- 配置 ---
APP_NAME="dog-crash-server"
APP_DIR="/www/wwwroot/$APP_NAME"
ECOSYSTEM_CONFIG="ecosystem.config.js"
# --- 结束配置 ---

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}建议使用 root 用户执行此脚本以管理系统服务。${NC}"
fi

# 切换到应用目录
cd "$APP_DIR"

ACTION=$1

if [ -z "$ACTION" ]; then
    echo "错误: 请提供一个操作 (start, stop, restart, status, logs, setup)"
    exit 1
fi

case "$ACTION" in
    start)
        echo -e "${GREEN}🚀 启动应用: $APP_NAME...${NC}"
        pm2 start "$ECOSYSTEM_CONFIG"
        ;;
    stop)
        echo -e "${YELLOW}🛑 停止应用: $APP_NAME...${NC}"
        pm2 stop "$APP_NAME"
        ;;
    restart)
        echo -e "${GREEN}🔄 重启应用: $APP_NAME...${NC}"
        pm2 restart "$APP_NAME"
        ;;
    status)
        echo -e "${GREEN}📊 查看应用状态...${NC}"
        pm2 list
        ;;
    logs)
        echo -e "${GREEN}📜 查看实时日志...${NC}"
        pm2 logs "$APP_NAME"
        ;;
    setup)
        echo -e "${GREEN}🔧 设置开机自启...${NC}"
        pm2 save
        pm2 startup
        echo -e "${YELLOW}请复制并执行上面 pm2 startup 命令生成的指令，以完成开机自启设置！${NC}"
        ;;
    *)
        echo "错误: 无效的操作 '$ACTION'. 可用操作: start, stop, restart, status, logs, setup"
        exit 1
        ;;
esac

echo -e "${GREEN}✅ 操作完成!${NC}"
