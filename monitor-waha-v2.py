#!/usr/bin/env python3
"""
Monitor WAHA - Polling de mensagens novas v2
Corrigido: usa lista de chats (LID format), não @c.us
"""
import json, urllib.request, time, os, sys

WAHA_URL = "http://localhost:3002"
WAHA_KEY = "ebb0879aae964a61bd612cebd4d11b55"
IA_URL = "http://localhost:3099/ia/receber"
CHECK_INTERVAL = 3  # segundos

_ultimas_ids = set()
_ultimos_chats = set()

def api_get(path):
    url = f"{WAHA_URL}{path}"
    req = urllib.request.Request(url, headers={"X-API-Key": WAHA_KEY})
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return []

def get_chats():
    """Pega lista de chats com mensagens."""
    data = api_get("/api/default/chats")
    if isinstance(data, list):
        return data
    return []

def get_messages(chat_id):
    """Pega últimas mensagens de um chat."""
    data = api_get(f"/api/default/chats/{chat_id}/messages?limit=3&downloadMedia=false")
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and 'messages' in data:
        return data['messages']
    return []

def enviar_para_ia(remetente, texto):
    """Envia mensagem para o script IA."""
    data = json.dumps({"remetente": remetente, "texto": texto}).encode()
    req = urllib.request.Request(IA_URL, data=data,
        headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return {"erro": str(e)}

def main():
    global _ultimas_ids
    print(f"[Monitor v2] Iniciado (intervalo: {CHECK_INTERVAL}s)")
    print(f"[Monitor v2] WAHA: {WAHA_URL}")
    print(f"[Monitor v2] IA: {IA_URL}")
    sys.stdout.flush()
    
    while True:
        try:
            chats = get_chats()
            if not isinstance(chats, list):
                time.sleep(CHECK_INTERVAL)
                continue
            
            for chat in chats:
                # Get chat ID
                cid = chat.get('id', {})
                if isinstance(cid, dict):
                    chat_id = cid.get('_serialized', '')
                else:
                    chat_id = str(cid)
                
                if not chat_id:
                    continue
                
                messages = get_messages(chat_id)
                if not isinstance(messages, list):
                    continue
                
                for msg in messages:
                    msg_id_raw = msg.get('id', '')
                    if isinstance(msg_id_raw, dict):
                        msg_id = msg_id_raw.get('_serialized', str(msg_id_raw))
                    else:
                        msg_id = str(msg_id_raw)
                    
                    if msg_id in _ultimas_ids:
                        continue
                    
                    _ultimas_ids.add(msg_id)
                    
                    # Só mensagens RECEBIDAS (não enviadas por nós)
                    if msg.get("fromMe", False):
                        continue
                    
                    texto = msg.get("body", "") or ""
                    remetente_raw = msg.get("from", "") or ""
                    
                    if not texto or not remetente_raw:
                        continue
                    
                    # Extrair número sem formato LID
                    remetente = remetente_raw.split("@")[0] if "@" in remetente_raw else remetente_raw
                    
                    print(f"[Monitor] 📩 Nova msg de {remetente}: {texto[:60]}")
                    sys.stdout.flush()
                    
                    result = enviar_para_ia(remetente, texto)
                    if result and result.get("status") == "processing":
                        print(f"[Monitor] ✅ IA processou")
                    else:
                        print(f"[Monitor] ⚠️ IA resposta: {str(result)[:80]}")
                    sys.stdout.flush()
                
                # Limitar conjunto de IDs
                if len(_ultimas_ids) > 2000:
                    _ultimas_ids = set(list(_ultimas_ids)[-1000:])
            
            time.sleep(CHECK_INTERVAL)
        except KeyboardInterrupt:
            print("\n[Monitor] Parando...")
            break
        except Exception as e:
            print(f"[Monitor] Erro: {e}")
            sys.stdout.flush()
            time.sleep(CHECK_INTERVAL)

if __name__ == "__main__":
    main()
