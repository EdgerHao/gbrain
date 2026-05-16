# GBrain Windows PowerShell 服务器启动脚本
param(
    [Parameter(Mandatory=$true)]
    [string]$Token,
    
    [Parameter(Mandatory=$false)]
    [int]$Port = 8787
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "GBrain 服务器启动中..." -ForegroundColor Cyan
Write-Host "端口: $Port" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 bun 是否可用
$bunCmd = Get-Command bun -ErrorAction SilentlyContinue
if (-not $bunCmd) {
    Write-Host "错误: 未找到 bun 命令" -ForegroundColor Red
    Write-Host "请先安装 Bun: https://bun.sh" -ForegroundColor Yellow
    exit 1
}

# 获取当前脚本目录
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# 切换到 GBrain 目录
Set-Location $ScriptDir

Write-Host "正在启动 GBrain HTTP MCP 包装器..." -ForegroundColor Green

# 启动 HTTP MCP 包装
bun run http-mcp-wrapper.ts --port $Port --token $Token
