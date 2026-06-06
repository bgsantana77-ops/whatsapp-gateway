#!/usr/bin/env python3
"""
chat-api.py — Ponte API entre Directus + WAHA para o chat interface HTML.

Endpoints:
  GET  /pessoas          — Lista pessoas com conversas
  GET  /mensagens?pessoa_id=X — Mensagens de uma pessoa
  POST /enviar           — Envia mensagem via WAHA (body: {"telefone": "...", "texto": "..."})
  GET  /pendentes?pessoa_id=X — Respostas IA pendentes
  POST /aprovar          — Aprova resposta pendente (body: {"id": X})

Porta: 3098
"""

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
import traceback
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

# ── Config ──────────────────────────────────────────────────────────────
DIRECTUS_URL = os.getenv("DIRECTUS_URL", "http://localhost:8055")
DIRECTUS_EMAIL = os.getenv("DIRECTUS_EMAIL", "paginaweb.bolivia@gmail.com")
DIRECTUS_PASSWORD = os.getenv("DIRECTUS_PASSWORD", "Uni2026!")
API_PORT = int(os.getenv("API_PORT", "3098"))

# Cache do token
_token = None
_token_expires = 0

# ── Auth ─────────────────────────────────────────────────────────────────

def get_token() -> str:
    """Obtem token do Directus com cache."""
    global _token, _token_expires
    now = datetime.now(timezone.utc).timestamp()
    if _token and _token_expires > now + 60:
        return _token

    payload = json.dumps({
        "email": DIRECTUS_EMAIL,
        "password": DIRECTUS_PASSWORD,
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{DIRECTUS_URL}/auth/login",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        _token = data["data"]["access_token"]
        _token_expires = now + (data["data"].get("expires", 900000) / 1000)
        return _token


def directus_get(collection: str, params: str = "") -> dict:
    """Faz GET no Directus com auth."""
    token = get_token()
    url = f"{DIRECTUS_URL}/items/{collection}?{params}"
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def directus_patch(collection: str, item_id: int | str, data: dict) -> dict:
    """Faz PATCH no Directus."""
    token = get_token()
    payload = json.dumps(data).encode("utf-8")
    url = f"{DIRECTUS_URL}/items/{collection}/{item_id}"
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="PATCH",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def directus_post(collection: str, data: dict) -> dict:
    """Faz POST no Directus."""
    token = get_token()
    payload = json.dumps(data).encode("utf-8")
    url = f"{DIRECTUS_URL}/items/{collection}"
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


# ── Handler ──────────────────────────────────────────────────────────────

class ChatAPIHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _send_json(self, data: dict | list, status: int = 200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def _handle_directus_proxy_get(self, params: str):
        """Proxy GET para Directus API."""
        try:
            url = f"{DIRECTUS_URL}/{params}"
            token = get_token()
            req = urllib.request.Request(
                url,
                headers={"Authorization": f"Bearer {token}"},
                method="GET",
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            self._send_json(data)
        except urllib.error.HTTPError as e:
            self._send_json({"erro": f"Directus error: {e.code}", "detail": e.read().decode()}, e.code)
        except Exception as e:
            self._send_json({"erro": str(e)}, 500)

    def _handle_directus_proxy_post(self, body: dict, subpath: str):
        """Proxy POST para Directus API (auth/login etc)."""
        try:
            url = f"{DIRECTUS_URL}/{subpath}"
            payload = json.dumps(body).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            self._send_json(data)
        except urllib.error.HTTPError as e:
            self._send_json({"erro": f"Directus error: {e.code}", "detail": e.read().decode()}, e.code)
        except Exception as e:
            self._send_json({"erro": str(e)}, 500)

    def _read_body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        if length > 0:
            raw = self.rfile.read(length)
            return json.loads(raw.decode("utf-8"))
        return {}

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = self._parse_path()
        path = parsed["path"]
        params = parsed["params"]

        try:
            if path == "/pessoas":
                self._handle_list_pessoas(params)
            elif path == "/mensagens":
                self._handle_list_mensagens(params)
            elif path == "/pendentes":
                self._handle_list_pendentes(params)
            elif path == "/health":
                self._send_json({"status": "ok"})
            elif path.startswith("/directus/items/") or path.startswith("/directus/auth/"):
                # Proxy para Directus - extrair subpath após /directus/
                subpath = path[len("/directus/"):]
                if params:
                    subpath += "?" + params
                self._handle_directus_proxy_get(subpath)
            else:
                self._send_json({"erro": "Endpoint nao encontrado"}, 404)
        except Exception as e:
            self._send_json({"erro": str(e)}, 500)

    def do_POST(self):
        parsed = self._parse_path()
        path = parsed["path"]

        try:
            body = self._read_body()
            if path == "/enviar":
                self._handle_enviar(body)
            elif path == "/aprovar":
                self._handle_aprovar(body)
            elif path == "/broadcast":
                self._handle_broadcast(body)
            elif path == "/webhook/waha":
                self._handle_waha_webhook(body)
            elif path.startswith("/directus/"):
                subpath = path[len("/directus/"):]
                self._handle_directus_proxy_post(body, subpath)
            else:
                self._send_json({"erro": "Endpoint nao encontrado"}, 404)
        except json.JSONDecodeError:
            self._send_json({"erro": "JSON invalido"}, 400)
        except Exception as e:
            self._send_json({"erro": str(e)}, 500)

    def _parse_path(self) -> dict:
        raw = self.path.split("?", 1)
        path = raw[0].rstrip("/")
        if path == "":
            path = "/"
        params = raw[1] if len(raw) > 1 else ""
        return {"path": path, "params": params}

    # ── Handlers ──────────────────────────────────────────────────────

    def _handle_list_pessoas(self, params: str):
        """Lista pessoas com suas conversas ativas."""
        search = ""
        for part in params.split("&"):
            if part.startswith("search="):
                search = part.split("=", 1)[1].replace("+", " ")

        # Tenta buscar conversas primeiro
        conv_params = "limit=50&sort=-ultima_data&fields=*,pessoa_id.*"
        conv_resp = directus_get("conversas", conv_params)
        conversas = conv_resp.get("data", [])

        # Busca igrejas pra mapear
        igrejas_resp = directus_get("igrejas", "limit=100")
        igrejas = {i["id"]: i["nome"] for i in igrejas_resp.get("data", [])}

        # Se nao tem conversas, busca pessoas diretamente
        if not conversas:
            pessoas_params = "limit=100&sort=-data_ultimo_contato"
            if search:
                pessoas_params += f"&filter[_or][0][nome][_contains]={search}&filter[_or][1][telefone][_contains]={search}"
            pessoas_resp = directus_get("pessoas", pessoas_params)
            pessoas = pessoas_resp.get("data", [])

            # Converte pessoas pro formato de conversa para compatibilidade
            result = []
            for p in pessoas:
                result.append({
                    "id": f"p{p['id']}",
                    "pessoa_id": p,
                    "ultima_mensagem": "",
                    "ultima_data": p.get("data_ultimo_contato", ""),
                    "status": "normal",
                    "nao_lidas": 0,
                    "tipo": "whatsapp",
                    "ultimo_remetente": p.get("telefone", ""),
                })

            # Aplica search se veio sem filtro do Directus
            if search and not search.isdigit():
                search_lower = search.lower()
                result = [r for r in result if
                    search_lower in (r["pessoa_id"].get("nome") or "").lower() or
                    search_lower in (r["pessoa_id"].get("telefone") or "").lower()
                ]

            for r in result:
                p = r["pessoa_id"]
                if isinstance(p, dict) and p.get("igreja_id"):
                    p["igreja_nome"] = igrejas.get(p["igreja_id"], f"ID {p['igreja_id']}")

            self._send_json({"data": result})
            return

        # Se tem search, filtra
        if search:
            search_lower = search.lower()
            filtered = []
            for c in conversas:
                pessoa = c.get("pessoa_id") or {}
                if not isinstance(pessoa, dict):
                    pessoa = {}
                nome = (pessoa.get("nome") or "").lower()
                tel = (pessoa.get("telefone") or "").lower()
                if search_lower in nome or search_lower in tel:
                    filtered.append(c)
            conversas = filtered

        # Enriquece com nome da igreja
        for c in conversas:
            pessoa = c.get("pessoa_id") or {}
            if isinstance(pessoa, dict) and pessoa.get("igreja_id"):
                pessoa["igreja_nome"] = igrejas.get(pessoa["igreja_id"], f"ID {pessoa['igreja_id']}")

        self._send_json({"data": conversas})

    def _handle_list_mensagens(self, params: str):
        """Lista mensagens de uma pessoa."""
        pessoa_id = None
        for part in params.split("&"):
            if part.startswith("pessoa_id="):
                pessoa_id = part.split("=", 1)[1]

        if not pessoa_id:
            self._send_json({"erro": "pessoa_id é obrigatorio"}, 400)
            return

        # Strip 'p' prefix if present (API uses p{id} format for pessoas)
        clean_id = pessoa_id.lstrip("p")
        msg_params = f"filter[pessoa_id][_eq]={clean_id}&sort=data_envio&limit=200"
        resp = directus_get("mensagens", msg_params)
        self._send_json(resp)

    def _handle_list_pendentes(self, params: str):
        """Lista respostas IA pendentes."""
        pessoa_id = None
        for part in params.split("&"):
            if part.startswith("pessoa_id="):
                pessoa_id = part.split("=", 1)[1]

        if not pessoa_id:
            self._send_json({"erro": "pessoa_id é obrigatorio"}, 400)
            return

        # Strip 'p' prefix if present
        clean_id = pessoa_id.lstrip("p")
        pend_params = f"filter[pessoa_id][_eq]={clean_id}&filter[status][_eq]=pendente&limit=50"
        resp = directus_get("respostas_pendentes", pend_params)
        self._send_json(resp)

    def _handle_enviar(self, body: dict):
        """Envia mensagem via WAHA e registra no Directus."""
        telefone = body.get("telefone", "").strip()
        texto = body.get("texto", "").strip()
        pessoa_id = body.get("pessoa_id")

        if not telefone or not texto:
            self._send_json({"erro": "telefone e texto sao obrigatorios"}, 400)
            return

        # Formata telefone
        chat_id = telefone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        if "@" not in chat_id:
            chat_id += "@c.us"

        # Envia via enviar_whatsapp.py
        script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "enviar_whatsapp.py")
        result = subprocess.run(
            [sys.executable, script_path, telefone, texto],
            capture_output=True, text=True, timeout=60,
        )

        try:
            wa_result = json.loads(result.stdout)
        except json.JSONDecodeError:
            wa_result = {"sucesso": False, "erro": result.stderr or "Falha ao processar resposta"}

        # Registra no Directus se tiver pessoa_id
        if pessoa_id and wa_result.get("sucesso"):
            try:
                now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
                clean_id = int(str(pessoa_id).lstrip("p"))
                directus_post("mensagens", {
                    "pessoa_id": clean_id,
                    "remetente": "ADMIN",
                    "texto": texto,
                    "data_envio": now,
                    "classificacao": "admin",
                    "respondida": 1,
                    "prioridade": "normal",
                })

                # Atualiza conversa
                convs = directus_get("conversas", f"filter[pessoa_id][_eq]={clean_id}&limit=1")
                if convs.get("data"):
                    conv_id = convs["data"][0]["id"]
                    directus_patch("conversas", conv_id, {
                        "ultima_mensagem": texto,
                        "ultima_data": now,
                        "ultimo_remetente": "ADMIN",
                    })
            except Exception as e:
                wa_result["registro_directus"] = f"Falha ao registrar: {e}"

        self._send_json(wa_result)

    def _handle_aprovar(self, body: dict):
        """Aprova uma resposta IA pendente."""
        pendente_id = body.get("id")

        if not pendente_id:
            self._send_json({"erro": "id é obrigatorio"}, 400)
            return

        # Busca a resposta pendente
        resp = directus_get("respostas_pendentes", f"filter[id][_eq]={pendente_id}")
        dados = resp.get("data", [])
        if not dados:
            self._send_json({"erro": "Resposta pendente nao encontrada"}, 404)
            return

        pendente = dados[0]

        # Atualiza status
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        directus_patch("respostas_pendentes", int(pendente_id), {
            "status": "aprovado",
            "resposta_final": pendente.get("resposta_ia"),
            "data_aprovacao": now,
            "aprovado_por": "admin_chat",
        })

        # Se tem pessoa_id e mensagem, registra resposta no Directus
        pessoa_id = pendente.get("pessoa_id")
        msg_original = pendente.get("msg_original", "")
        resposta_ia = pendente.get("resposta_ia", "")

        if pessoa_id and resposta_ia:
            # Envia a mensagem para a pessoa via WhatsApp
            try:
                # Busca telefone da pessoa
                pessoa_resp = directus_get("pessoas", f"filter[id][_eq]={pessoa_id}")
                pessoas_data = pessoa_resp.get("data", [])
                if pessoas_data:
                    telefone = pessoas_data[0].get("telefone", "")

                    script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "enviar_whatsapp.py")
                    subprocess.run(
                        [sys.executable, script_path, telefone, resposta_ia],
                        capture_output=True, text=True, timeout=60,
                    )

                    # Registra como mensagem enviada
                    directus_post("mensagens", {
                        "pessoa_id": int(pessoa_id),
                        "remetente": "ADMIN",
                        "texto": resposta_ia,
                        "data_envio": now,
                        "classificacao": pendente.get("classificacao", "oracao"),
                        "respondida": 1,
                        "prioridade": pendente.get("classificacao", "normal") if pendente.get("classificacao") in ["urgente", "alta"] else "normal",
                    })

                    # Atualiza conversa
                    directus_patch("conversas", int(pessoa_id), {
                        "ultima_mensagem": resposta_ia,
                        "ultima_data": now,
                        "ultimo_remetente": "ADMIN",
                    })
            except Exception as e:
                pass  # Nao falha a aprovacao por erro de envio

        self._send_json({"sucesso": True, "mensagem": "Resposta aprovada com sucesso"})


# ── Main ─────────────────────────────────────────────────────────────────


    # ── Broadcast ────────────────────────────────────────────────────

    def _handle_broadcast(self, body: dict):
        """Cria um novo comunicado de broadcast no Directus.

        Body esperado:
            titulo (str): Título do comunicado
            texto (str): Conteúdo da mensagem
            nivel (str): 'pais', 'igreja' ou 'corrente'
            filtro_id (int, optional): ID da igreja ou corrente
            template_id (int, optional): ID do template
            agendamento (str, optional): Data ISO para agendamento
            status (str, optional): 'rascunho' (padrão)

        Retorna:
            dict com dados do comunicado criado
        """
        titulo = body.get("titulo", "Broadcast sem título")
        texto = body.get("texto", "")
        nivel = body.get("nivel", "pais")
        filtro_id = body.get("filtro_id")
        template_id = body.get("template_id")
        agendamento = body.get("agendamento")
        status = body.get("status", "rascunho")

        if not texto.strip():
            self._send_json({"erro": "texto é obrigatorio"}, 400)
            return

        if nivel not in ("pais", "igreja", "corrente"):
            self._send_json({"erro": f"nivel invalido: {nivel}. Use pais, igreja ou corrente"}, 400)
            return

        if nivel in ("igreja", "corrente") and not filtro_id:
            self._send_json({"erro": f"filtro_id é obrigatorio para nivel={nivel}"}, 400)
            return

        from datetime import datetime, timezone
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        # Monta payload para Directus
        comunicado_data = {
            "titulo": titulo,
            "texto": texto,
            "tipo": "broadcast",
            "data_envio": now_str,
            "nivel": nivel,
            "filtro_id": filtro_id if filtro_id else None,
            "template_id": template_id if template_id else None,
            "status": status,
            "criado_por": "Broadcast API",
        }

        if agendamento:
            # Converte ISO para formato Directus
            try:
                dt = datetime.fromisoformat(agendamento.replace("Z", "+00:00"))
                comunicado_data["data_agendado"] = dt.strftime("%Y-%m-%d %H:%M:%S")
                comunicado_data["status"] = "agendado" if status == "rascunho" else status
            except (ValueError, TypeError):
                comunicado_data["data_agendado"] = agendamento

        try:
            result = directus_post("comunicados", comunicado_data)
            self._send_json({
                "sucesso": True,
                "mensagem": "Broadcast criado com sucesso",
                "data": result,
                "comunicado_id": result.get("id"),
                "nivel": nivel,
                "agendado": bool(agendamento),
            })
        except Exception as e:
            self._send_json({"erro": f"Falha ao criar comunicado no Directus: {e}"}, 500)

    def _handle_waha_webhook(self, body: dict):
        """Recebe webhook do WAHA com mensagens recebidas e encaminha pra IA."""
        try:
            # WAHA webhook format: {event: "message", session: "default", payload: {...}}
            payload = body.get("payload", body)
            event = body.get("event", "")

            if event == "message" or "body" in payload:
                msg_body = payload.get("body", "") or payload.get("text", {}).get("body", "")
                chat_id = payload.get("from", "") or payload.get("chatId", "")
                remetente = chat_id.split("@")[0] if "@" in chat_id else chat_id

                if msg_body and remetente:
                    # Forward to IA service
                    ia_payload = json.dumps({"remetente": remetente, "texto": msg_body}).encode()
                    ia_req = urllib.request.Request(
                        "http://localhost:3099/ia/receber",
                        data=ia_payload,
                        headers={"Content-Type": "application/json"},
                        method="POST"
                    )
                    try:
                        ia_resp = urllib.request.urlopen(ia_req, timeout=10)
                        result = json.loads(ia_resp.read().decode())
                        self._send_json({"status": "forwarded", "ia": result})
                        return
                    except Exception as e:
                        self._send_json({"status": "forwarded", "ia_error": str(e)})
                        return

            self._send_json({"status": "ignored", "event": event})
        except Exception as e:
            self._send_json({"erro": str(e)}, 500)

def main():
    server = ThreadingHTTPServer(("0.0.0.0", API_PORT), ChatAPIHandler)
    print(f"[Chat-API] Servidor rodando em http://0.0.0.0:{API_PORT}")
    print(f"[Chat-API] Endpoints:")
    print(f"           GET  /pessoas?search=...")
    print(f"           GET  /mensagens?pessoa_id=X")
    print(f"           GET  /pendentes?pessoa_id=X")
    print(f"           POST /enviar    (body: telefone, texto, pessoa_id)")
    print(f"           POST /aprovar   (body: id)")
    print(f"[Chat-API] Directus: {DIRECTUS_URL}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[Chat-API] Servidor encerrado.")
        server.server_close()


if __name__ == "__main__":
    main()
