#!/bin/bash
# Start the CPPay backend server with FastAPI + Django integration

cd "$(dirname "$0")"

# Activate virtual environment
source venv/bin/activate

echo "🚀 Starting CPPay Backend Server..."
echo "📍 Django Admin: http://localhost:8000/admin/"
echo "📍 FastAPI Docs: http://localhost:8000/docs"
echo "📍 API Health: http://localhost:8000/health"
echo ""

# Run with uvicorn (FastAPI server with Django mounted)
uvicorn config.asgi:application --reload --host 0.0.0.0 --port 8000
