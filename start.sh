#!/bin/bash
echo "🚀 Starting TradDesk..."
echo ""

# Check Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker Desktop first."
  exit 1
fi

echo "✅ Docker is running"
echo "📦 Building and starting containers (first run takes 2-3 minutes)..."
echo ""

docker-compose up --build -d

echo ""
echo "✅ TradDesk is running!"
echo ""
echo "  🌐 Open your app:  http://localhost:3000"
echo "  🔌 API running at: http://localhost:4000/health"
echo ""
echo "  To stop:  docker-compose down"
echo "  To logs:  docker-compose logs -f"
