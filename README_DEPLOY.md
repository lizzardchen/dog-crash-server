# 🚀 Dog Crash Server 快速部署

## 一键部署（推荐）

### 1. 上传代码到服务器
```bash
# 方式1: 使用 scp
scp -r ./server root@your-server-ip:/opt/dog-crash-server/

# 方式2: 使用 rsync  
rsync -avz ./server/ root@your-server-ip:/opt/dog-crash-server/
```

### 2. 执行自动部署脚本
```bash
ssh root@your-server-ip
cd /opt/dog-crash-server
chmod +x deploy.sh
./deploy.sh
```

### 3. 修改配置
```bash
# 修改域名配置
vim /etc/nginx/conf.d/dog-crash-server.conf
# 将 "your-domain.com" 改为你的实际域名

# 修改客户端域名配置
vim .env
# 将 ALLOWED_ORIGINS 改为你的客户端域名
```

### 4. 重启服务
```bash
pm2 restart dog-crash-server
systemctl restart nginx
```

## 验证部署

```bash
# 检查应用状态
pm2 status

# 测试 API
curl http://localhost:3000/health
curl http://your-domain.com/api/race/current
```

## 常用命令

```bash
# 查看应用日志
pm2 logs dog-crash-server

# 重启应用
pm2 restart dog-crash-server

# 维护脚本
./scripts/maintenance.sh health    # 健康检查
./scripts/maintenance.sh cleanup   # 清理日志
./scripts/backup.sh               # 备份数据
```

## 需要修改的配置

1. **Nginx 配置**: `/etc/nginx/conf.d/dog-crash-server.conf`
   - 修改 `server_name` 为你的域名

2. **环境配置**: `.env`
   - 修改 `ALLOWED_ORIGINS` 为你的客户端域名

3. **防火墙**: 确保开放 80 和 443 端口
   ```bash
   firewall-cmd --permanent --add-port=80/tcp
   firewall-cmd --permanent --add-port=443/tcp
   firewall-cmd --reload
   ```

## 故障排除

- **部署失败**: 查看 `./deploy.sh` 的输出日志
- **API 无响应**: 检查 `pm2 logs dog-crash-server`
- **Nginx 502**: 检查 `/var/log/nginx/error.log`
- **详细文档**: 查看 `DEPLOYMENT.md`

---

🎉 **部署完成后，你的 Dog Crash 服务器就在线了！**