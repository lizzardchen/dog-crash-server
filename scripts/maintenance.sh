#!/bin/bash

# Dog Crash Server 维护脚本
# 包括日志清理、性能优化、健康检查等

set -e

# 配置
APP_DIR="/opt/dog-crash-server"
APP_NAME="dog-crash-server"
LOG_DIR="$APP_DIR/logs"
MAX_LOG_SIZE="100M"
BACKUP_DIR="/backup/dogcrash"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔧 Dog Crash Server 维护脚本${NC}"
echo -e "${BLUE}================================${NC}"

# 显示当前状态
show_status() {
    echo -e "${YELLOW}📊 当前系统状态:${NC}"
    
    # 内存使用
    echo -e "${YELLOW}内存使用:${NC}"
    free -h
    
    # CPU 负载
    echo -e "${YELLOW}CPU 负载:${NC}"
    uptime
    
    # 磁盘使用
    echo -e "${YELLOW}磁盘使用:${NC}"
    df -h
    
    # PM2 状态
    echo -e "${YELLOW}PM2 进程状态:${NC}"
    pm2 status
    
    # 端口监听
    echo -e "${YELLOW}端口监听:${NC}"
    netstat -tlnp | grep -E ":(80|3000|443)"
}

# 清理日志
cleanup_logs() {
    echo -e "${YELLOW}🧹 清理日志文件...${NC}"
    
    # 清理 PM2 日志
    pm2 flush
    
    # 清理应用日志
    if [ -d "$LOG_DIR" ]; then
        # 备份大日志文件
        find $LOG_DIR -name "*.log" -size +$MAX_LOG_SIZE -exec mv {} {}.$(date +%Y%m%d) \;
        
        # 压缩旧日志
        find $LOG_DIR -name "*.log.*" -mtime +1 -exec gzip {} \;
        
        # 删除超过7天的压缩日志
        find $LOG_DIR -name "*.log.*.gz" -mtime +7 -delete
        
        echo -e "${GREEN}✅ 应用日志清理完成${NC}"
    fi
    
    # 清理系统日志
    journalctl --vacuum-size=100M
    
    # 清理 Nginx 日志
    if [ -d "/var/log/nginx" ]; then
        find /var/log/nginx -name "*.log" -mtime +7 -delete
        systemctl reload nginx
        echo -e "${GREEN}✅ Nginx 日志清理完成${NC}"
    fi
}

# 性能优化
optimize_performance() {
    echo -e "${YELLOW}⚡ 性能优化...${NC}"
    
    # 清理系统缓存
    sync
    echo 3 > /proc/sys/vm/drop_caches
    
    # 重启应用（清理内存）
    pm2 restart $APP_NAME
    
    # 优化数据库连接（如果需要）
    # 这里可以添加数据库优化命令
    
    echo -e "${GREEN}✅ 性能优化完成${NC}"
}

# 健康检查
health_check() {
    echo -e "${YELLOW}🏥 执行健康检查...${NC}"
    
    local errors=0
    
    # 检查应用状态
    if ! pm2 list | grep -q "$APP_NAME.*online"; then
        echo -e "${RED}❌ PM2 应用状态异常${NC}"
        ((errors++))
    else
        echo -e "${GREEN}✅ PM2 应用状态正常${NC}"
    fi
    
    # 检查端口监听
    if ! netstat -tlnp | grep -q ":3000.*LISTEN"; then
        echo -e "${RED}❌ 端口3000未监听${NC}"
        ((errors++))
    else
        echo -e "${GREEN}✅ 端口监听正常${NC}"
    fi
    
    # 检查 API 响应
    if curl -f -s http://localhost:3000/health > /dev/null; then
        echo -e "${GREEN}✅ API 健康检查通过${NC}"
    else
        echo -e "${RED}❌ API 健康检查失败${NC}"
        ((errors++))
    fi
    
    # 检查 Nginx 状态
    if systemctl is-active --quiet nginx; then
        echo -e "${GREEN}✅ Nginx 运行正常${NC}"
    else
        echo -e "${RED}❌ Nginx 未运行${NC}"
        ((errors++))
    fi
    
    # 检查内存使用
    MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
    if [ $MEMORY_USAGE -gt 90 ]; then
        echo -e "${RED}⚠️  内存使用率过高: ${MEMORY_USAGE}%${NC}"
        ((errors++))
    else
        echo -e "${GREEN}✅ 内存使用正常: ${MEMORY_USAGE}%${NC}"
    fi
    
    # 检查磁盘空间
    DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ $DISK_USAGE -gt 85 ]; then
        echo -e "${RED}⚠️  磁盘使用率过高: ${DISK_USAGE}%${NC}"
        ((errors++))
    else
        echo -e "${GREEN}✅ 磁盘空间充足: ${DISK_USAGE}%${NC}"
    fi
    
    return $errors
}

# 更新应用
update_app() {
    echo -e "${YELLOW}🔄 更新应用...${NC}"
    
    # 备份当前版本
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p $BACKUP_DIR
    fi
    
    echo -e "${YELLOW}📦 备份当前版本...${NC}"
    tar -czf "$BACKUP_DIR/pre_update_$(date +%Y%m%d_%H%M%S).tar.gz" -C $APP_DIR .
    
    # 更新依赖
    cd $APP_DIR
    npm update --production
    
    # 重启应用
    pm2 restart $APP_NAME
    
    echo -e "${GREEN}✅ 应用更新完成${NC}"
}

# 修复常见问题
fix_issues() {
    echo -e "${YELLOW}🔧 修复常见问题...${NC}"
    
    # 修复权限问题
    chown -R root:root $APP_DIR
    chmod +x $APP_DIR/scripts/*.sh
    
    # 重新安装依赖（如果node_modules有问题）
    if [ "$1" = "--reinstall" ]; then
        cd $APP_DIR
        rm -rf node_modules package-lock.json
        npm install --production
    fi
    
    # 重启所有服务
    pm2 restart $APP_NAME
    systemctl restart nginx
    
    echo -e "${GREEN}✅ 问题修复完成${NC}"
}

# 显示使用方法
show_usage() {
    echo -e "${BLUE}使用方法:${NC}"
    echo -e "  $0 status          - 显示系统状态"
    echo -e "  $0 cleanup         - 清理日志文件"
    echo -e "  $0 optimize        - 性能优化"
    echo -e "  $0 health          - 健康检查"
    echo -e "  $0 update          - 更新应用"
    echo -e "  $0 fix             - 修复常见问题"
    echo -e "  $0 fix --reinstall - 修复并重新安装依赖"
    echo -e "  $0 all             - 执行所有维护操作"
}

# 主逻辑
case "$1" in
    status)
        show_status
        ;;
    cleanup)
        cleanup_logs
        ;;
    optimize)
        optimize_performance
        ;;
    health)
        health_check
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}🎉 所有健康检查通过！${NC}"
        else
            echo -e "${RED}⚠️  发现 $? 个问题，请检查日志${NC}"
            exit 1
        fi
        ;;
    update)
        update_app
        ;;
    fix)
        fix_issues $2
        ;;
    all)
        echo -e "${BLUE}🚀 执行完整维护...${NC}"
        show_status
        cleanup_logs
        optimize_performance
        health_check
        echo -e "${GREEN}🎉 维护完成！${NC}"
        ;;
    *)
        show_usage
        exit 1
        ;;
esac

echo -e "${BLUE}================================${NC}"
echo -e "${GREEN}✅ 维护脚本执行完成${NC}"