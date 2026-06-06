#!/bin/bash
# Wrapper do IA com Supervisão Humana — IURD Bolivia
# A chave API é carregada do arquivo .env (não versionado)
if [ -f /home/catedral/whatsapp-gateway/.env ]; then
    set -a
    source /home/catedral/whatsapp-gateway/.env
    set +a
fi
export PORT=3099
exec /usr/bin/python3 /home/catedral/whatsapp-gateway/ia-supervisionada.py
