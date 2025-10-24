#!/bin/bash

echo "🚀 Starting Deligate.it - Complete Stack"
echo "====================================="

# Stop any existing processes
pkill -f "node" 2>/dev/null || true
pkill -f "npm" 2>/dev/null || true
pkill -f "tsx" 2>/dev/null || true

# Start Supabase
echo "📡 Starting Supabase..."
supabase start &
SUPABASE_PID=$!
echo "   Supabase PID: $SUPABASE_PID"

# Wait for Supabase to start
echo "⏳ Waiting for Supabase..."
sleep 15

# Start Redis
echo "🔴 Starting Redis..."
redis-server --daemonize yes --port 6379
echo "   Redis started on port 6379"

# Start backend services
echo "⚙️ Starting backend services..."

cd services/payment-backend
npm start > ../../logs/payment-backend.log 2>&1 &
PAYMENT_PID=$!
echo "   Payment backend PID: $PAYMENT_PID"

cd ../labeling-backend
npm start > ../../logs/labeling-backend.log 2>&1 &
LABELING_PID=$!
echo "   Labeling backend PID: $LABELING_PID"

cd ../..

# Start web application
echo "🌐 Starting web application..."
cd apps/web
npm start > ../../logs/web.log 2>&1 &
WEB_PID=$!
echo "   Web app PID: $WEB_PID"

cd ../..

# Wait for services to start
sleep 10

echo ""
echo "✅ All services started!"
echo "======================"
echo ""
echo "📊 Services Status:"
echo "   🔌 API Server: http://localhost:3001"
echo "   🏠 Web App: http://localhost:3000"
echo "   📊 Supabase Studio: http://localhost:54323"
echo "   🔴 Redis: localhost:6379"
echo ""
echo "📋 Process IDs:"
echo "   Supabase: $SUPABASE_PID"
echo "   Payment Backend: $PAYMENT_PID"
echo "   Labeling Backend: $LABELING_PID"
echo "   Web App: $WEB_PID"
echo ""
echo "💾 Logs directory: ./logs/"
echo ""
echo "Press Ctrl+C to stop all services"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping all services..."
    kill $SUPABASE_PID 2>/dev/null || true
    kill $PAYMENT_PID 2>/dev/null || true
    kill $LABELING_PID 2>/dev/null || true
    kill $WEB_PID 2>/dev/null || true
    pkill -f "node" 2>/dev/null || true
    redis-cli -p 6379 shutdown 2>/dev/null || true
    supabase stop 2>/dev/null || true
    echo "✅ All services stopped"
    exit 0
}

# Trap signals
trap cleanup SIGINT SIGTERM

# Keep script running
wait