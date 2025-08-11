# Dog Crash Server 部署指南

## 🎯 部署概述

本指南将帮助你在 Linux 服务器（LVS）上部署 Dog Crash 游戏服务器。

## 📋 系统要求

- **操作系统**: CentOS 7/8, RHEL 7/8, 或 Amazon Linux 2
- **内存**: 最低 1GB RAM (推荐 2GB+)
- **CPU**: 最低 1 核心 (推荐 2 核心+)
- **存储**: 最低 10GB 可用空间
- **网络**: 需要访问外网（下载依赖包）

## 🚀 快速部署

### 方法一：使用自动部署脚本（推荐）

1. **上传服务器代码到服务器**
   ```bash
   # 使用 scp 上传
   scp -r ./server root@your-server-ip:/opt/dog-crash-server/
   
   # 或使用 rsync
   rsync -avz ./server/ root@your-server-ip:/opt/dog-crash-server/
   ```

2. **连接到服务器并运行部署脚本**
   ```bash
   ssh root@your-server-ip
   cd /opt/dog-crash-server
   chmod +x deploy.sh
   ./deploy.sh
   ```

3. **修改配置文件**
   ```bash
   # 编辑环境配置
   vim .env
   
   # 编辑 Nginx 配置
   vim /etc/nginx/conf.d/dog-crash-server.conf
   ```

4. **重启服务**
   ```bash
   pm2 restart dog-crash-server
   systemctl restart nginx
   ```

### 方法二：手动部署

#### 1. 安装 Node.js

```bash
# 安装 Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs

# 验证安装
node --version
npm --version
```

#### 2. 安装 PM2

```bash
npm install -g pm2
```

#### 3. 安装项目依赖

```bash
cd /opt/dog-crash-server
npm install --production
```

#### 4. 配置环境变量

```bash
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://dogcrash:5hRPJyResaF75MPh@124.223.21.118:27017/dogcrash
ALLOWED_ORIGINS=http://your-domain.com,https://your-domain.com
EOF
```

#### 5. 启动应用

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### 6. 配置 Nginx

```bash
yum install -y nginx

cat > /etc/nginx/conf.d/dog-crash-server.conf << 'EOF'
server {
    listen 80;
    server_name your-domain.com;
    
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /health {
        proxy_pass http://127.0.0.1:3000/health;
    }
}
EOF

systemctl enable nginx
systemctl start nginx
```

## ⚙️ 配置说明

### 环境变量 (.env)

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `NODE_ENV` | 运行环境 | `production` |
| `PORT` | 服务端口 | `3000` |
| `MONGODB_URI` | MongoDB连接字符串 | 现有远程数据库 |
| `ALLOWED_ORIGINS` | 允许的客户端域名 | 需要修改 |

### PM2 配置 (ecosystem.config.js)

- **集群模式**: 使用所有CPU核心
- **内存限制**: 500MB 自动重启
- **日志**: 自动轮转和时间戳
- **监控**: 自动重启和健康检查

### Nginx 配置

- **反向代理**: 将 /api 请求转发到 Node.js
- **健康检查**: /health 端点
- **超时设置**: 60秒连接和读取超时

## 🔍 验证部署

### 1. 检查应用状态

```bash
# 查看 PM2 进程
pm2 status

# 查看应用日志
pm2 logs dog-crash-server

# 查看错误日志
pm2 logs dog-crash-server --err
```

### 2. 测试 API

```bash
# 健康检查
curl http://localhost:3000/health

# 测试比赛API
curl http://localhost:3000/api/race/current

# 通过 Nginx 测试
curl http://your-domain.com/api/race/current
```

### 3. 检查服务状态

```bash
# 检查端口监听
netstat -tlnp | grep 3000

# 检查 Nginx 状态
systemctl status nginx

# 检查防火墙
firewall-cmd --list-ports
```

## 🛠️ 常用运维命令

### PM2 管理

```bash
# 查看状态
pm2 status

# 重启应用
pm2 restart dog-crash-server

# 停止应用
pm2 stop dog-crash-server

# 删除应用
pm2 delete dog-crash-server

# 查看监控
pm2 monit

# 保存配置
pm2 save
```

### 日志管理

```bash
# 查看实时日志
pm2 logs dog-crash-server --lines 100

# 清空日志
pm2 flush

# 轮转日志
pm2 reloadLogs
```

### 服务管理

```bash
# Nginx
systemctl restart nginx
systemctl status nginx
systemctl reload nginx

# 防火墙
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --permanent --add-port=3000/tcp
firewall-cmd --reload
```

## 🔧 故障排除

### 常见问题

1. **端口被占用**
   ```bash
   # 查看端口占用
   lsof -i :3000
   
   # 杀死进程
   kill -9 <PID>
   ```

2. **MongoDB 连接失败**
   ```bash
   # 检查网络连接
   telnet 124.223.21.118 27017
   
   # 检查防火墙
   firewall-cmd --list-all
   ```

3. **Nginx 403/502 错误**
   ```bash
   # 检查 Nginx 错误日志
   tail -f /var/log/nginx/error.log
   
   # 检查配置语法
   nginx -t
   ```

4. **内存不足**
   ```bash
   # 检查内存使用
   free -h
   
   # 减少 PM2 实例数
   pm2 scale dog-crash-server 1
   ```

### 日志位置

- **应用日志**: `/opt/dog-crash-server/logs/`
- **Nginx 日志**: `/var/log/nginx/`
- **系统日志**: `/var/log/messages`
- **PM2 日志**: `~/.pm2/logs/`

## 🔐 安全建议

1. **防火墙配置**
   ```bash
   # 只开放必要端口
   firewall-cmd --permanent --add-port=80/tcp
   firewall-cmd --permanent --add-port=443/tcp
   firewall-cmd --reload
   ```

2. **SSL 证书**
   ```bash
   # 使用 Let's Encrypt
   yum install -y certbot python3-certbot-nginx
   certbot --nginx -d your-domain.com
   ```

3. **限制访问**
   - 使用强密码
   - 禁用 root SSH 登录
   - 使用密钥认证
   - 定期更新系统

## 📊 监控和维护

### 自动监控脚本

部署脚本已经配置了每5分钟自动检查：
- PM2 进程状态
- 端口监听状态
- 健康检查接口

监控日志位置: `/var/log/dogcrash-monitor.log`

### 定期维护

```bash
# 每周运行一次
# 1. 检查日志大小并清理
find /opt/dog-crash-server/logs/ -name "*.log" -size +100M -delete

# 2. 重启应用（清理内存）
pm2 restart dog-crash-server

# 3. 检查系统更新
yum check-update
```

## 📞 支持

如果遇到部署问题，请检查：

1. **系统日志**: `journalctl -xe`
2. **应用日志**: `pm2 logs dog-crash-server`
3. **Nginx 日志**: `tail -f /var/log/nginx/error.log`
4. **网络连接**: `curl http://localhost:3000/health`

---

**祝你部署成功！** 🎉

1. 在你的 CentOS 服务器上运行部署：

  # 1. 下载部署脚本
  wget https://raw.githubusercontent.com/lizzardchen/dog-crash/main/server/deploy.sh

  # 2. 给脚本执行权限
  chmod +x deploy.sh

  # 3. 运行部署（需要 root 权限）
  ./deploy.sh

  2. 部署完成后的管理命令：

  # 启动服务
  dogcrash start

  # 停止服务
  dogcrash stop

  # 重启服务
  dogcrash restart

  # 查看状态
  dogcrash status

  # 查看日志
  dogcrash logs

  # 更新代码并重启
  dogcrash update

  # 监控界面
  dogcrash monitor

  new 2222:

   # 1. 下载并运行部署脚本
  wget https://raw.githubusercontent.com/lizzardchen/dog-crash/main/server/deploy.sh
  chmod +x deploy.sh
  ./deploy.sh

  常用管理命令：

  # 查看状态
  pm2 status

  # 查看日志
  pm2 logs dog-crash-server

  # 重启应用
  pm2 restart dog-crash-server

  # 更新代码
  cd /www/wwwroot/dog-crash-server && ./update.sh