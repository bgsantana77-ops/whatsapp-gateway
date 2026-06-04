#!/bin/bash
# Iniciar serviços IURD 360
# Gateway WhatsApp + API SQLite

echo "🏛️ Iniciando serviços IURD 360..."
echo ""

# API SQLite (porta 3003)
echo "📡 API IURD 360..."
cd /home/catedral/whatsapp-gateway && HOME=/home/catedral node api-iurd360.js &
sleep 2
curl -s http://localhost:3003/health && echo " - ✅ API OK" || echo " - ❌ API FALHOU"

# Gateway WhatsApp (porta 3002)
echo "💬 Gateway WhatsApp..."
cd /home/catedral/whatsapp-gateway && HOME=/home/catedral node gateway.js &
sleep 5
curl -s http://localhost:3002/status && echo " - ✅ Gateway OK" || echo " - ❌ Gateway FALHOU"

echo ""
echo "✅ Serviços iniciados!"
echo "   📡 API IURD 360 :3003"
echo "   💬 Gateway       :3002"
echo "   🔥 n8n           :5678"
echo "   📊 Dashboard     :9120"
