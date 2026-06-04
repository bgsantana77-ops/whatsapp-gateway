#!/usr/bin/env python3
"""
enviar_whatsapp.py — Envia mensagens via WAHA API.

Uso:
    python3 enviar_whatsapp.py <numero> <texto>
    python3 enviar_whatsapp.py 59178440354 "Ola, irmao! 🙏"

Retorna:
    Codigo 0 e JSON com sucesso, ou codigo 1 e JSON com erro.

Configuracao via variaveis de ambiente (ou defaults abaixo):
    WAHA_URL      = http://localhost:3002
    WAHA_API_KEY  = ebb0879aae964a61bd612cebd4d11b55
    WAHA_SESSION  = default
"""

import json
import os
import sys
import urllib.error
import urllib.request

# ── Config ──────────────────────────────────────────────────────────────
WAHA_URL = os.getenv("WAHA_URL", "http://localhost:3002").rstrip("/")
WAHA_API_KEY = os.getenv("WAHA_API_KEY", "ebb0879aae964a61bd612cebd4d11b55")
WAHA_SESSION = os.getenv("WAHA_SESSION", "default")

SEND_TEXT_URL = f"{WAHA_URL}/api/sendText"
HEADERS = {
    "Content-Type": "application/json",
    "X-API-Key": WAHA_API_KEY,
}


# ── Helpers ─────────────────────────────────────────────────────────────

def format_chat_id(numero: str) -> str:
    """Garante que o numero termine com @c.us (formato WAHA)."""
    numero = numero.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if "@" not in numero:
        numero += "@c.us"
    return numero


def enviar(numero: str, texto: str) -> dict:
    """
    Envia mensagem via WAHA API.

    Args:
        numero: Numero do destinatario (com ou sem @c.us).
        texto:  Texto da mensagem.

    Returns:
        dict com {"sucesso": True, "dados": {...}} em caso de sucesso,
        ou {"sucesso": False, "erro": "..."} em caso de falha.
    """
    chat_id = format_chat_id(numero)
    payload = json.dumps({
        "session": WAHA_SESSION,
        "chatId": chat_id,
        "text": texto,
    }).encode("utf-8")

    req = urllib.request.Request(
        SEND_TEXT_URL,
        data=payload,
        headers=HEADERS,
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            return {
                "sucesso": True,
                "codigo": resp.status,
                "dados": body,
                "chatId": chat_id,
                "session": WAHA_SESSION,
            }
    except urllib.error.HTTPError as e:
        try:
            erro_body = json.loads(e.read().decode("utf-8"))
        except Exception:
            erro_body = {"raw": str(e)}
        return {
            "sucesso": False,
            "codigo": e.code,
            "erro": erro_body.get("error", str(e)),
            "chatId": chat_id,
            "session": WAHA_SESSION,
            "status": erro_body.get("status", "UNKNOWN"),
        }
    except urllib.error.URLError as e:
        return {
            "sucesso": False,
            "codigo": 0,
            "erro": f"Nao foi possivel conectar a {WAHA_URL}: {e.reason}",
            "chatId": chat_id,
            "session": WAHA_SESSION,
        }
    except Exception as e:
        return {
            "sucesso": False,
            "codigo": 0,
            "erro": str(e),
            "chatId": chat_id,
            "session": WAHA_SESSION,
        }


# ── CLI ─────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 3:
        print("Uso: python3 enviar_whatsapp.py <numero> <mensagem>", file=sys.stderr)
        print("Ex:  python3 enviar_whatsapp.py 59178440354 'Ola, irmao!'", file=sys.stderr)
        sys.exit(1)

    numero = sys.argv[1]
    texto = " ".join(sys.argv[2:])

    print(f"[Enviar] Preparando envio para {numero}...", file=sys.stderr)
    print(f"[Enviar] Session: {WAHA_SESSION}", file=sys.stderr)
    print(f"[Enviar] URL: {SEND_TEXT_URL}", file=sys.stderr)
    print(file=sys.stderr)

    resultado = enviar(numero, texto)

    # Imprime resultado como JSON (stdout para piping)
    print(json.dumps(resultado, indent=2, ensure_ascii=False))

    if resultado["sucesso"]:
        sys.exit(0)
    else:
        # Mensagem amigavel no stderr
        erro = resultado.get("erro", "Erro desconhecido")
        codigo = resultado.get("codigo", 0)
        status = resultado.get("status", "")
        print(file=sys.stderr)
        print(f"ERRO ({codigo}): {erro}", file=sys.stderr)
        if status:
            print(f"   Status da sessao: {status}", file=sys.stderr)
            if status == "SCAN_QR_CODE":
                print("   A sessao precisa escanear o QR code do WhatsApp!", file=sys.stderr)
                print(f"   Escaneie o QR em: {WAHA_URL}/api/default/auth/qr", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
