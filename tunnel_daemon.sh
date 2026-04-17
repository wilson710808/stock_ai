#!/bin/bash
# StockAI 隧道守護腳本 - 自動重連 localtunnel
# 用法: bash tunnel_daemon.sh [端口]

PORT=${1:-3001}
LOG_FILE="/tmp/stockai_tunnel.log"
PID_FILE="/tmp/stockai_tunnel.pid"
URL_FILE="/tmp/stockai_tunnel_url.txt"

echo "[$(date)] 啟動隧道守護 (端口: $PORT)" > "$LOG_FILE"

# 清理舊進程
pkill -f "localtunnel.*$PORT" 2>/dev/null
sleep 1

while true; do
    echo "[$(date)] 啟動 localtunnel..." >> "$LOG_FILE"
    
    # 啟動 localtunnel，捕獲 URL
    URL=$(npx --yes localtunnel --port "$PORT" 2>&1 | grep -o 'https://[a-z0-9-]*\.loca\.lt' | head -1)
    
    if [ -n "$URL" ]; then
        echo "$URL" > "$URL_FILE"
        echo "[$(date)] 隧道已建立: $URL" >> "$LOG_FILE"
        echo "$URL"
    else
        echo "[$(date)] 隧道建立失敗，30秒後重試..." >> "$LOG_FILE"
    fi
    
    # 如果隧道斷開，等待後重連
    echo "[$(date)] 隧道已斷開，15秒後重連..." >> "$LOG_FILE"
    sleep 15
done
