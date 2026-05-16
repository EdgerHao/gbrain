# GBrain Windows PowerShell 部署指南

## 快速开始

### 问题 1: DATABASE_URL 环境变量

GBrain 使用 PGLite 时不需要 DATABASE_URL，但 auth 脚本需要。你需要先设置环境变量：

```powershell
# 查看当前数据库配置
$env:GBRAIN_DATABASE_URL
```

如果 GBrain 已经初始化（使用 PGLite），你可以：

**方案 A：使用默认 PGLite 路径**
```powershell
# PGLite 数据通常在 ~/.gbrain/brain.pglite
# 但 auth.ts 需要 DATABASE_URL，我们可以：
$env:GBRAIN_DATABASE_URL = "file:///$HOME/.gbrain/brain.pglite"
bun run src/commands/auth.ts create "trae-solo"
```

**方案 B：如果使用 Supabase Postgres**
```powershell
$env:DATABASE_URL = "postgres://user:password@host:5432/dbname"
bun run src/commands/auth.ts create "trae-solo"
```

### 问题 2: PowerShell 没有 chmod

在 Windows 上，你不需要 chmod。直接运行：

```powershell
# 使用 bun 运行脚本
bun run start-gbrain-server.ps1 -Token "YOUR_TOKEN"
```

---

## 完整部署步骤（Windows PowerShell）

### 第一步：设置环境并创建令牌

```powershell
# 进入 GBrain 目录
cd ~/gbrain

# 设置环境变量（如果使用 PGLite）
$env:GBRAIN_DATABASE_URL = "file:///$HOME/.gbrain/brain.pglite"

# 创建访问令牌
bun run src/commands/auth.ts create "trae-solo"
```

**重要：保存返回的令牌！**

### 第二步：获取服务器 IP

```powershell
# 方法 1: 使用 ipconfig
ipconfig

# 找 IPv4 地址，通常是 192.168.x.x 或 10.x.x.x
# 例如：192.168.31.135

# 方法 2: 使用 PowerShell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "192.168.*" }
```

### 第三步：配置防火墙

在 PowerShell 中以管理员身份运行：

```powershell
# Windows 防火墙允许端口 8787
New-NetFirewallRule -DisplayName "GBrain MCP Server" -Direction Inbound -Protocol TCP -LocalPort 8787 -Action Allow
```

### 第四步：启动服务器

```powershell
# 方法 1: 直接运行（临时）
bun run http-mcp-wrapper.ts --port 8787 --token "YOUR_TOKEN_HERE"

# 方法 2: 使用 PowerShell 脚本
bun run start-gbrain-server.ps1 -Token "YOUR_TOKEN_HERE" -Port 8787
```

### 第五步：测试连接

在**另一台电脑**（或同一个电脑的新 PowerShell 窗口）上：

```powershell
# 测试健康检查
Invoke-WebRequest -Uri "http://192.168.x.x:8787/health" -Method GET

# 应该返回：{"ok":true,"status":"running"}
```

---

## 使用 VS Code 或 Cursor 的 Trae Solo

### 如果使用 VS Code：

1. 打开设置 (Ctrl+,)
2. 搜索 "mcp"
3. 点击 "Edit in settings.json"
4. 添加：

```json
{
  "mcpServers": {
    "gbrain": {
      "command": "bun",
      "args": [
        "run",
        "C:/path/to/gbrain-mcp-client.ts",
        "--url",
        "http://192.168.x.x:8787/mcp",
        "--token",
        "YOUR_TOKEN"
      ]
    }
  }
}
```

### 如果使用 Cursor/Windsurf：

查找 MCP 服务器配置文件，通常在：
- `~/.cursor/mcp.json`
- `~/.config/windsurf/mcp.json`

添加相同配置。

---

## 常见问题（Windows）

### Q: "Set DATABASE_URL" 错误？

A: 运行前设置环境变量：
```powershell
$env:GBRAIN_DATABASE_URL = "file:///$HOME/.gbrain/brain.pglite"
```

### Q: 端口被占用？

A: 找到占用端口的进程：
```powershell
netstat -ano | findstr :8787
# 然后终止进程
taskkill /PID <PID号> /F
```

或使用其他端口：
```powershell
bun run http-mcp-wrapper.ts --port 8788 --token "YOUR_TOKEN"
```

### Q: 防火墙阻止连接？

A: 以管理员身份运行：
```powershell
New-NetFirewallRule -DisplayName "GBrain MCP" -Direction Inbound -Protocol TCP -LocalPort 8787 -Action Allow
```

### Q: Token 创建失败？

A: 检查 GBrain 是否已初始化：
```powershell
bun doctor
```

---

## PowerShell 脚本使用

### start-gbrain-server.ps1

```powershell
# 参数说明
# -Token: 必需的，你的 GBrain 访问令牌
# -Port: 可选，默认为 8787

# 基本用法
bun run start-gbrain-server.ps1 -Token "gbrain_xxxxx..."

# 指定端口
bun run start-gbrain-server.ps1 -Token "gbrain_xxxxx..." -Port 8788

# 持续运行（前台）
bun run start-gbrain-server.ps1 -Token "gbrain_xxxxx..."

# 如果要后台运行
Start-Process -FilePath "bun" -ArgumentList "run","start-gbrain-server.ps1","-Token","YOUR_TOKEN" -NoNewWindow
```

---

## 下一步

1. **启动服务器**：`bun run http-mcp-wrapper.ts --port 8787 --token "YOUR_TOKEN"`
2. **获取 IP**：`ipconfig`（找 IPv4 地址）
3. **配置笔记本**（Trae Solo）：参考上面的 VS Code/Cursor 配置

有问题随时告诉我！
