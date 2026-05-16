# GBrain 局域网部署指南

这是在局域网环境中部署 GBrain 并在 Trae Solo 中使用的完整指南。

## 架构概览

```
笔记本 (Trae Solo)
     │
     │ 局域网请求 (http://192.168.x.x:8787/mcp)
     │
     ▼
服务器电脑 (运行 GBrain)
     ├── gbrain serve (stdio MCP)
     └── http-mcp-wrapper.ts (HTTP 包装)
```

## 第一步：服务器电脑配置

### 1.1 确保 GBrain 已安装并工作

```bash
# 在服务器电脑上
cd ~/gbrain  # 或你的 GBrain 安装位置
gbrain init  # 如果还没初始化
gbrain doctor  # 检查健康状态
```

### 1.2 创建访问令牌

```bash
# 在 GBrain 目录中
# 首先确保你的数据库 URL 已设置（如果使用 Supabase）
export DATABASE_URL=your_postgres_url  # 或者使用默认 PGLite

# 创建一个令牌
bun run src/commands/auth.ts create "trae-solo"
```

**保存这个令牌**，后面会用到。格式类似：`gbrain_xxxxx...`

### 1.3 启动 HTTP MCP 包装服务器

```bash
# 将 http-mcp-wrapper.ts 复制到服务器电脑的 GBrain 目录
# 然后运行
bun run http-mcp-wrapper.ts --port 8787 --token YOUR_TOKEN_HERE
```

### 1.4 获取服务器电脑的局域网 IP

```bash
# Linux/Mac
ip addr show  # 或 ifconfig

# Windows
ipconfig
```

找到局域网 IP，通常是 `192.168.x.x` 或 `10.x.x.x` 格式。

### 1.5 测试本地连接（在服务器电脑上）

```bash
curl http://localhost:8787/health
# 应该返回: {"ok":true,"status":"running"}
```

---

## 第二步：局域网配置（不使用 ngrok）

### 2.1 确保两台电脑在同一局域网

- 两台电脑连接同一个 Wi-Fi 或交换机
- 从笔记本可以 ping 通服务器电脑

### 2.2 测试笔记本到服务器的连接

```bash
# 在笔记本上运行
ping 192.168.x.x  # 替换为服务器的局域网 IP
```

### 2.3 配置防火墙（如果需要）

确保服务器电脑的防火墙允许 8787 端口的入站连接：

```bash
# Ubuntu/Linux
sudo ufw allow 8787

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=8787/tcp
sudo firewall-cmd --reload

# Mac
# 系统偏好设置 → 安全性与隐私 → 防火墙 → 防火墙选项
```

### 2.4 在笔记本上测试连接

```bash
curl http://192.168.x.x:8787/health  # 替换为服务器 IP
```

---

## 第三步：使用 ngrok（如果你需要外网访问）

如果你需要从任何地方访问（不只是局域网），可以使用 ngrok。

### 3.1 安装 ngrok

```bash
# Mac
brew install ngrok

# Linux
curl -sL https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz | tar xz -C /usr/local/bin

# 或从 https://ngrok.com/download 下载
```

### 3.2 配置 ngrok

```bash
# 在 ngrok 官网注册账号并获取 authtoken
ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN
```

### 3.3 启动 ngrok 隧道

```bash
# 在服务器电脑上（确保 http-mcp-wrapper 正在运行）
ngrok http 8787
```

ngrok 会给你一个公网 URL，例如：`https://abc123.ngrok-free.app`

---

## 第四步：Trae Solo 配置

### 4.1 为 Trae Solo 创建 MCP 客户端

由于 Trae Solo 可能需要 stdio 或特定的 MCP 客户端，让我们为你创建一个专用的 MCP 客户端：

创建 `gbrain-mcp-client.ts`：

```typescript
#!/usr/bin/env bun
/**
 * GBrain MCP Client for Trae Solo
 * Connects to remote HTTP MCP server and bridges to stdio
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// Configuration
const args = Bun.argv.slice(2);
let remoteUrl = 'http://localhost:8787/mcp';
let token = '';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url' && args[i + 1]) {
    remoteUrl = args[i + 1];
    i++;
  } else if (args[i] === '--token' && args[i + 1]) {
    token = args[i + 1];
    i++;
  }
}

if (!token) {
  console.error('Error: --token is required');
  process.exit(1);
}

console.error(`Connecting to GBrain at ${remoteUrl}...`);

// Cache tools list
let cachedTools: any[] | null = null;

async function callRemoteMCPServer(request: any) {
  const response = await fetch(remoteUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Remote server error: ${response.status}`);
  }

  return response.json();
}

const server = new Server(
  { name: 'gbrain-remote', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  if (!cachedTools) {
    const response = await callRemoteMCPServer({
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
      id: 1,
    });
    cachedTools = response.result?.tools || [];
  }
  return { tools: cachedTools };
});

server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  const response = await callRemoteMCPServer({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: request.params,
    id: Date.now(),
  });
  
  return response.result || response;
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('GBrain Remote MCP Client connected');
```

### 4.2 配置 Trae Solo 的 MCP 设置

创建或编辑 Trae Solo 的 MCP 配置文件（位置取决于你的 Trae Solo 安装）：

#### 方案 A：使用局域网连接（推荐）

```json
{
  "mcpServers": {
    "gbrain": {
      "command": "bun",
      "args": [
        "run",
        "/path/to/gbrain-mcp-client.ts",
        "--url",
        "http://192.168.x.x:8787/mcp",
        "--token",
        "YOUR_GBRAIN_TOKEN"
      ]
    }
  }
}
```

#### 方案 B：使用 ngrok（外网访问）

```json
{
  "mcpServers": {
    "gbrain": {
      "command": "bun",
      "args": [
        "run",
        "/path/to/gbrain-mcp-client.ts",
        "--url",
        "https://abc123.ngrok-free.app/mcp",
        "--token",
        "YOUR_GBRAIN_TOKEN"
      ]
    }
  }
}
```

---

## 第五步：完整的启动脚本（服务器端）

创建 `start-gbrain-server.sh`：

```bash
#!/bin/bash
# GBrain 服务器启动脚本

cd ~/gbrain  # 修改为你的 GBrain 目录

# 设置环境变量（如果需要）
# export DATABASE_URL=your_postgres_url
# export OPENAI_API_KEY=your_openai_key

# 启动 HTTP MCP 包装
echo "Starting GBrain HTTP MCP wrapper..."
bun run http-mcp-wrapper.ts --port 8787 --token YOUR_GBRAIN_TOKEN
```

使其可执行：

```bash
chmod +x start-gbrain-server.sh
```

---

## 第六步：测试整个流程

### 6.1 在服务器上：

```bash
# 终端 1：启动 GBrain 服务器
./start-gbrain-server.sh

# 终端 2（可选）：启动 ngrok（如果需要外网访问）
ngrok http 8787
```

### 6.2 在笔记本上测试：

```bash
# 1. 测试健康检查
curl http://192.168.x.x:8787/health

# 2. 启动 Trae Solo 并测试 MCP 工具
# 在 Trae Solo 中尝试：
# - "搜索我的知识大脑"
# - "查询关于某个主题的内容"
```

---

## 常见问题

### Q: HTTP 包装器无法连接到 gbrain？

A: 确保 `gbrain` 命令在 PATH 中，或者修改 `http-mcp-wrapper.ts` 使用完整路径：
```typescript
gbrainProcess = spawn('/full/path/to/gbrain', ['serve'], ...);
```

### Q: 局域网连接被拒绝？

A: 检查：
1. 防火墙设置
2. 服务器是否绑定到 `0.0.0.0` 而不是 `127.0.0.1`
3. IP 地址是否正确

### Q: Token 验证失败？

A: 确保你使用的 token 与创建时一致，并且没有包含多余的空格或引号。

---

## 使用 systemd 保持服务器运行（Linux）

创建 `/etc/systemd/system/gbrain.service`：

```ini
[Unit]
Description=GBrain MCP Server
After=network.target

[Service]
Type=simple
User=your_username
WorkingDirectory=/home/your_username/gbrain
ExecStart=/home/your_username/.bun/bin/bun run http-mcp-wrapper.ts --port 8787 --token YOUR_TOKEN
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启用并启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable gbrain
sudo systemctl start gbrain
sudo systemctl status gbrain
```

---

下一步：查看 GBrain 的完整技能和使用方法！
