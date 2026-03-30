#!/bin/bash
# StockAI 服务守护进程
# 每 30 秒检查一次，异常时自动重启

LOG="/Users/here/.qclaw/workspace/memory/watchdog.log"
DIR="/Users/here/.qclaw/workspace/stockadvisor"
PORT=3001

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

start_service() {
    log "🚀 启动 StockAI 服务..."
    cd "$DIR"
    nohup node server.js >> "$LOG" 2>&1 &
    sleep 3
    if curl -s --max-time 5 http://localhost:$PORT/api/health > /dev/null 2>&1; then
        log "✅ 服务启动成功 (PID: $!)"
    else
        log "❌ 服务启动失败"
    fi
}

log "🔍 StockAI 守护进程启动"

while true; do
    # 检查服务是否响应
    if ! curl -s --max-time 5 http://localhost:$PORT/api/health > /dev/null 2>&1; then
        log "⚠️ 服务无响应，正在重启..."
        
        # 杀掉旧进程
        pkill -f "node server.js" 2>/dev/null
        sleep 2
        
        # 重启服务
        start_service
    fi
    
    sleep 30
done
