#!/bin/bash
#
# Service Health Check & Recovery Script
# Purpose: Detect and recover from common 502 issues (port conflicts, memory leaks, crashes)
# Run this script periodically via cron to prevent service failures
#
# Usage:
#   sudo bash /opt/talentflow/check-service-health.sh
#   # Add to crontab: */10 * * * * sudo bash /opt/talentflow/check-service-health.sh
#

set -e

FRONTEND_PORT=3001
BACKEND_PORT=8005
FRONTEND_SERVICE="techsalesaxis-frontend"
BACKEND_SERVICE="techsalesaxis-backend"
LOG_FILE="/var/log/talentflow-health-check.log"
ALERT_EMAIL="admin@techsalesaxis.com"
MEMORY_THRESHOLD_MB=450
RESTART_COUNTER_THRESHOLD=10

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

check_port_in_use() {
    local port=$1
    if sudo ss -tlnp | grep -q ":$port "; then
        return 0
    else
        return 1
    fi
}

get_service_restart_count() {
    local service=$1
    systemctl show -p NRestarts "$service" | cut -d= -f2
}

get_service_memory_mb() {
    local service=$1
    systemctl show -p MemoryCurrent "$service" | cut -d= -f2 | awk '{print int($1/1024/1024)}'
}

restart_service() {
    local service=$1
    log "⚠️  Restarting service: $service"
    systemctl restart "$service"
    sleep 3
}

#############################
# Health Checks
#############################

log "🔍 Starting health check..."

# 1. Check frontend service
if systemctl is-active --quiet $FRONTEND_SERVICE; then
    log "✅ Frontend service is running"
    
    # Check port binding
    if check_port_in_use $FRONTEND_PORT; then
        log "✅ Frontend listening on port $FRONTEND_PORT"
    else
        log "❌ Frontend NOT listening on port $FRONTEND_PORT - RESTARTING"
        restart_service $FRONTEND_SERVICE
    fi
    
    # Check restart counter
    restart_count=$(get_service_restart_count $FRONTEND_SERVICE)
    if [ "$restart_count" -gt "$RESTART_COUNTER_THRESHOLD" ]; then
        log "⚠️  Frontend restart counter is high: $restart_count"
    else
        log "✅ Frontend restart counter: $restart_count"
    fi
else
    log "❌ Frontend service is NOT running - RESTARTING"
    restart_service $FRONTEND_SERVICE
fi

echo ""

# 2. Check backend service
if systemctl is-active --quiet $BACKEND_SERVICE; then
    log "✅ Backend service is running"
    
    # Check port binding
    if check_port_in_use $BACKEND_PORT; then
        log "✅ Backend listening on port $BACKEND_PORT"
    else
        log "❌ Backend NOT listening on port $BACKEND_PORT - RESTARTING"
        restart_service $BACKEND_SERVICE
    fi
    
    # Check memory usage
    memory_mb=$(get_service_memory_mb $BACKEND_SERVICE)
    if [ "$memory_mb" -gt "$MEMORY_THRESHOLD_MB" ]; then
        log "⚠️  Backend memory usage is high: ${memory_mb}MB (threshold: ${MEMORY_THRESHOLD_MB}MB)"
        log "    Consider: increasing MemoryMax in service file, optimizing database queries, or scaling"
    else
        log "✅ Backend memory usage: ${memory_mb}MB"
    fi
    
    # Check restart counter
    restart_count=$(get_service_restart_count $BACKEND_SERVICE)
    if [ "$restart_count" -gt "$RESTART_COUNTER_THRESHOLD" ]; then
        log "⚠️  Backend restart counter is high: $restart_count"
    else
        log "✅ Backend restart counter: $restart_count"
    fi
else
    log "❌ Backend service is NOT running - RESTARTING"
    restart_service $BACKEND_SERVICE
fi

echo ""

# 3. Check for orphaned processes
orphaned_count=$(ps aux | grep -E 'node|npm|next' | grep -v grep | grep -v systemd | wc -l)
if [ "$orphaned_count" -gt 0 ]; then
    log "⚠️  Found $orphaned_count orphaned Node/npm processes"
    log "    Auto-cleanup is handled by systemd ExecStartPre"
else
    log "✅ No orphaned processes detected"
fi

echo ""

# 4. Test endpoints
log "🧪 Testing endpoints..."

frontend_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$FRONTEND_PORT/login 2>/dev/null || echo "000")
if [ "$frontend_status" = "200" ]; then
    log "✅ Frontend /login responds with 200"
elif [ "$frontend_status" = "000" ]; then
    log "❌ Frontend is NOT responding - RESTARTING"
    restart_service $FRONTEND_SERVICE
else
    log "⚠️  Frontend /login responds with $frontend_status (expected 200)"
fi

backend_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$BACKEND_PORT/auth/login -X POST -H 'Content-Type: application/json' -d '{}' 2>/dev/null || echo "000")
if [ "$backend_status" = "422" ]; then
    log "✅ Backend /auth/login is responding (422 expected for empty payload)"
elif [ "$backend_status" = "000" ]; then
    log "❌ Backend is NOT responding - RESTARTING"
    restart_service $BACKEND_SERVICE
else
    log "⚠️  Backend /auth/login responds with $backend_status"
fi

echo ""

# 5. Nginx upstream check
log "🔗 Checking Nginx upstream..."
if curl -s -I https://www.techsalesaxis.com/login 2>/dev/null | grep -q "200\|301\|302"; then
    log "✅ Nginx is proxying correctly (no 502 errors)"
else
    log "⚠️  Nginx may have issues connecting to upstream"
fi

log "✅ Health check completed"
echo ""
