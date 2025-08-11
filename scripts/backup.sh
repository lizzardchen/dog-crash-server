#!/bin/bash

# Dog Crash Server 备份脚本
# 备份应用代码、配置文件和数据库

set -e

# 配置
APP_DIR="/opt/dog-crash-server"
BACKUP_DIR="/backup/dogcrash"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="dogcrash_backup_$DATE"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}🔄 开始备份 Dog Crash Server...${NC}"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份应用代码和配置
echo -e "${YELLOW}📦 备份应用代码...${NC}"
cd $APP_DIR
tar -czf "$BACKUP_DIR/${BACKUP_NAME}_app.tar.gz" \
    --exclude=node_modules \
    --exclude=logs \
    --exclude=.git \
    .

# 备份数据库
echo -e "${YELLOW}💾 备份数据库...${NC}"
mongodump --uri="mongodb://dogcrash:5hRPJyResaF75MPh@124.223.21.118:27017/dogcrash" \
    --out="$BACKUP_DIR/${BACKUP_NAME}_db"

# 压缩数据库备份
tar -czf "$BACKUP_DIR/${BACKUP_NAME}_db.tar.gz" -C "$BACKUP_DIR" "${BACKUP_NAME}_db"
rm -rf "$BACKUP_DIR/${BACKUP_NAME}_db"

# 备份 Nginx 配置
echo -e "${YELLOW}⚙️ 备份 Nginx 配置...${NC}"
tar -czf "$BACKUP_DIR/${BACKUP_NAME}_nginx.tar.gz" /etc/nginx/conf.d/

# 备份 PM2 配置
echo -e "${YELLOW}🔧 备份 PM2 配置...${NC}"
pm2 save
tar -czf "$BACKUP_DIR/${BACKUP_NAME}_pm2.tar.gz" ~/.pm2/

# 创建备份信息文件
echo -e "${YELLOW}📝 创建备份信息...${NC}"
cat > "$BACKUP_DIR/${BACKUP_NAME}_info.txt" << EOF
Dog Crash Server 备份信息
========================

备份时间: $(date)
服务器: $(hostname)
备份版本: $BACKUP_NAME

包含文件:
- ${BACKUP_NAME}_app.tar.gz     (应用代码和配置)
- ${BACKUP_NAME}_db.tar.gz      (MongoDB 数据库)
- ${BACKUP_NAME}_nginx.tar.gz   (Nginx 配置)
- ${BACKUP_NAME}_pm2.tar.gz     (PM2 配置)

恢复方法:
1. 停止应用: pm2 stop dog-crash-server
2. 解压应用: tar -xzf ${BACKUP_NAME}_app.tar.gz -C /opt/dog-crash-server/
3. 恢复数据库: mongorestore --uri="..." --drop dump/
4. 恢复配置: tar -xzf ${BACKUP_NAME}_nginx.tar.gz -C /etc/nginx/conf.d/
5. 重启服务: pm2 restart dog-crash-server && systemctl restart nginx
EOF

# 清理旧备份（保留最近7天）
echo -e "${YELLOW}🧹 清理旧备份...${NC}"
find $BACKUP_DIR -name "dogcrash_backup_*" -mtime +7 -delete

# 显示备份结果
echo -e "${GREEN}✅ 备份完成！${NC}"
echo -e "${YELLOW}备份位置: $BACKUP_DIR${NC}"
echo -e "${YELLOW}备份文件:${NC}"
ls -lh $BACKUP_DIR/${BACKUP_NAME}_*

# 计算总大小
TOTAL_SIZE=$(du -sh $BACKUP_DIR/${BACKUP_NAME}_* | awk '{sum+=$1} END {print sum}')
echo -e "${GREEN}总备份大小: ${TOTAL_SIZE}${NC}"

echo -e "${GREEN}🎉 备份成功完成！${NC}"