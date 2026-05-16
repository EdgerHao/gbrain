# GBrain + Trae Solo 快速启动指南

## 📋 你需要的文件

将这些文件复制到相应的电脑：

### 服务器电脑（运行 GBrain 的那台）：
1. `http-mcp-wrapper.ts` - HTTP MCP 包装服务器
2. `start-gbrain-server.sh` - 启动脚本（可选但推荐）

### 笔记本电脑（运行 Trae Solo 的那台）：
1. `gbrain-mcp-client.ts` - Trae Solo 用的 MCP 客户端
2. 配置 Trae Solo 的 MCP 设置

---

## 🚀 三步快速启动

### 第一步：服务器电脑配置

```bash
# 1. 进入 GBrain 目录
cd ~/gbrain

# 2. 创建访问令牌（保存好这个令牌！）
bun run src/commands/auth.ts create "trae-solo"

# 3. 启动服务器
chmod +x start-gbrain-server.sh
./start-gbrain-server.sh --token YOUR_TOKEN_HERE

# 4. 获取服务器的局域网 IP
ip addr show  # Linux/Mac
# 或 ipconfig  # Windows
```

### 第二步：测试连接

在笔记本电脑上运行：
```bash
curl http://192.168.x.x:8787/health  # 替换为服务器 IP
# 应该返回: {"ok":true,"status":"running"}
```

### 第三步：配置 Trae Solo

1. 将 `gbrain-mcp-client.ts` 复制到笔记本
2. 在 Trae Solo 的 MCP 配置中添加：

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

---

## 📝 详细说明

### 1. 什么是这些文件？

- `http-mcp-wrapper.ts`: 将 GBrain 的 stdio MCP 包装为 HTTP 服务
- `gbrain-mcp-client.ts`: 在 Trae Solo 端连接到远程 HTTP MCP
- `start-gbrain-server.sh`: 方便启动服务器的脚本

### 2. 令牌是什么？

令牌用于保护你的 GBrain 服务器，防止未授权访问。使用 `bun run src/commands/auth.ts create "trae-solo"` 创建。

### 3. 需要外网访问吗？

- **局域网内使用**: 不需要 ngrok，直接用 `192.168.x.x` IP
- **外网访问**: 使用 ngrok 隧道（详见 DEPLOY_LOCAL_GUIDE.md）

---

## 🛠️ 故障排除

| 问题 | 解决方法 |
|------|---------|
| 连接被拒绝 | 检查防火墙是否允许 8787 端口 |
| Token 验证失败 | 确认 token 没有多余的空格或引号 |
| gbrain 命令找不到 | 运行 `bun link` 在 GBrain 目录中 |
| 笔记本 ping 不通服务器 | 确认两台电脑在同一局域网 |

---

## 📚 更多信息

- 完整部署指南: `DEPLOY_LOCAL_GUIDE.md`
- GBrain 官方文档: 查看 `README.md` 和 `AGENTS.md`
