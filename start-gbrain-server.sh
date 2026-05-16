#!/bin/bash
# GBrain 服务器启动脚本
# 使用方法: ./start-gbrain-server.sh --token YOUR_TOKEN [--port 8787]

# 默认配置
PORT=8787
TOKEN=""
GBRAIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 解析命令行参数
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --token) TOKEN="$2"; shift ;;
        --port) PORT="$2"; shift ;;
        *) echo "未知参数: $1"; exit 1 ;;
    esac
    shift
done

# 检查 token
if [ -z "$TOKEN" ]; then
    echo "错误: 必须提供 --token 参数"
    echo "创建令牌: bun run src/commands/auth.ts create \"trae-solo\""
    exit 1
fi

# 切换到 GBrain 目录
cd "$GBRAIN_DIR" || { echo "无法进入目录: $GBRAIN_DIR"; exit 1; }

echo "========================================"
echo "GBrain 服务器启动中..."
echo "目录: $GBRAIN_DIR"
echo "端口: $PORT"
echo "========================================"

# 检查 bun 是否可用
if ! command -v bun &> /dev/null; then
    echo "错误: 未找到 bun，请先安装: https://bun.sh"
    exit 1
fi

# 检查 gbrain 是否可用
if ! command -v gbrain &> /dev/null; then
    echo "警告: 未在 PATH 中找到 gbrain，确保已运行 'bun link'"
fi

# 启动 HTTP MCP 包装
echo "正在启动 GBrain HTTP MCP 包装器..."
exec bun run http-mcp-wrapper.ts --port "$PORT" --token "$TOKEN"
