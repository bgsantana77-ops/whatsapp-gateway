#!/usr/bin/env python3
"""
Monitor WAHA - Polling de mensagens novas
Como o WAHA Core gratuito não suporta webhooks,
este script verifica mensagens a cada 2 segundos
e encaminha para o script IA.
"""
import json, urllib.request, time, os

WAHA_URL = "http://localhost:3002"
WAHA_KEY = "ebb0879aae964a61bd612cebd4d11b55"
IA_URL = "http://localhost:3099/ia/receber"
NUMERO_OFICIAL = "59178440353@c.us"
CHECK_INTERVAL = 2  # segundos

_ultimas_ids = set()

def get_mensagens():
    """Pega últimas mensagens do WAHA."""
    url = f"{WAHA_URL}/api/default/chats/{NUMERO_OFICIAL}/messages?limit=5&downloadMedia=false"
    req = urllib.request.Request(url, headers={"X-API-Key": WAHA_KEY})
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return []

def enviar_para_ia(remetente, texto, msg_id):
    """Envia mensagem para o script IA."""
    data = json.dumps({
        "remetente": remetente,
        "texto": texto,
        "pessoa_id": msg_id
    }).encode()
    req = urllib.request.Request(IA_URL, data=data,
        headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read())
    except:
        return None

def main():
    global _ultimas_ids
    print(f"[Monitor] WAHA→IA monitor iniciado (intervalo: {CHECK_INTERVAL}s)")
    print(f"[Monitor] Número oficial: {NUMERO_OFICIAL}")
    
    while True:
        try:
            mensagens = get_mensagens()
            if isinstance(mensagens, list):
                for msg in mensagens:
                    msg_id = msg.get("id", "")
                    if msg_id in _ultimas_ids:
                        continue
                    
                    # Só mensagens recebidas (não enviadas por nós)
                    if msg.get("fromMe", False):
                        continue
                    
                    texto = msg.get("body", "") or msg.get("text", "")
                    remetente = msg.get("from", "") or msg.get("sender", {}).get("id", "")
                    
                    if texto and remetente and remetente != NUMERO_OFICIAL:
                        print(f"[Monitor] Nova msg de {remetente}: {texto[:50]}")
                        result = enviar_para_ia(remetente, texto, hash(msg_id) % 100000)
                        if result:
                            print(f"[Monitor] ✅ Enviado pra IA")
                        else:
                            print(f"[Monitor] ❌ Erro ao enviar pra IA")
                    
                    _ultimas_ids.add(msg_id)
                    
                    # Limitar o conjunto de IDs
                    if len(_ultimas_ids) > 1000:
                        _ultimas_ids = set(list(_ultimas_ids)[-500:])
            
            time.sleep(CHECK_INTERVAL)
        except KeyboardInterrupt:
            print("\n[Monitor] Parando...")
            break
        except Exception as e:
            print(f"[Monitor] Erro: {e}")
            time.sleep(CHECK_INTERVAL)

if __name__ == "__main__":
    main()
