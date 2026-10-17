#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "======================================================================"
echo "          🎨 HandRaw Style Studio - 独立手绘创作客户端"
echo "======================================================================"
echo "正在启动客户端本地服务端..."

if command -v python3 >/dev/null 2>&1; then
    python3 server.py
elif command -v python >/dev/null 2>&1; then
    python server.py
else
    echo "[错误] 未检测到 Python 环境，请先安装 Python 3.8+。"
    exit 1
fi
