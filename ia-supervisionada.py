#!/usr/bin/env python3
"""
IURD 360 — IA com Supervisao Humana (FASE 2 — AO VIVO)
=======================================================
Substituto do workflow n8n (que nao esta ativando).
Fluxo: WAHA -> api-iurd360 -> este script -> DeepSeek -> Directus -> (auto-aprovacao ou humano) -> WAHA

4 MODOS DE RESPOSTA:
  * AUTO       (confianca >= 90) -> IA responde direto, sem aprovacao humana
  * HUMANO     (confianca < 90)  -> vai pra aprovacao humana (fluxo original)
  * URGENTE    (classificado urgente) -> IA responde AGORA + COPIA pra humano revisar
  * CRITICO    (classificado critico) -> NUNCA IA, sempre humano

APROVADO por Bgs em 04/06/2026.
"""

import json, os, sys, time, http.server, urllib.request, urllib.error, signal, threading

# --- Config -----------------------------------------------------------
DIRECTUS_URL = "http://localhost:8055"
DIRECTUS_EMAIL = "paginaweb.bolivia@gmail.com"
DIRECTUS_PASSWORD = "Uni2026!"
WAHA_URL = "http://localhost:3002"
WAHA_API_KEY = "ebb0879aae964a61bd612cebd4d11b55"
DEEPSEEK_API_KEY = os.environ.get("OPENROUTER_API_KEY", os.environ.get("OPENAI_API_KEY", ""))
DEEPSEEK_API_URL = "https://openrouter.ai/api/v1/chat/completions"
DEEPSEEK_MODEL = "deepseek/deepseek-v4-flash"
PORT = int(os.environ.get("PORT", 3099))

# --- Import enviar_whatsapp como modulo -------------------------------
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import enviar_whatsapp

# --- Numero do Bgs (sempre responde automatico) ------------------------
NUMERO_BGS = "59178440354"  # +591 784 40 354 — sempre AUTO
# Formatos possiveis: @c.us, @lid, ou numero puro
FORMATOS_BGS = [
    f"{NUMERO_BGS}@c.us",
    NUMERO_BGS,
    f"{NUMERO_BGS}@lid",
     # WAHA pode usar formato com codigo pais diferente
    "59178440354",
]

_DIRECTUS_TOKEN = None
_TOKEN_EXPIRES = 0


def directus_token():
    global _DIRECTUS_TOKEN, _TOKEN_EXPIRES
    now = time.time()
    if _DIRECTUS_TOKEN and now < _TOKEN_EXPIRES:
        return _DIRECTUS_TOKEN
    data = json.dumps({"email": DIRECTUS_EMAIL, "password": DIRECTUS_PASSWORD}).encode()
    req = urllib.request.Request(f"{DIRECTUS_URL}/auth/login", data=data,
        headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as resp:
            body = json.loads(resp.read())
            _DIRECTUS_TOKEN = body["data"]["access_token"]
            _TOKEN_EXPIRES = now + 3600
            return _DIRECTUS_TOKEN
    except Exception as e:
        print(f"[IA] Erro login Directus: {e}")
        return None


def directus_api(method, path, data=None):
    token = directus_token()
    if not token:
        return None
    url = f"{DIRECTUS_URL}{path}"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"[IA] Directus API {method} {path}: {e.code} {err[:200]}")
        return None


# ------------------------------------------------------------------
#  NOVAS FUNCOES: auto_approve, calcular_confianca, enviar_resposta
# ------------------------------------------------------------------

def auto_approve(classificacao: str, confianca: float, remetente: str = "") -> bool:
    """
    Decide se a IA pode responder sem aprovacao humana.

    Args:
        classificacao: 'normal', 'urgente', 'critico'
        confianca:     score de confianca da IA (0-100)
        remetente:     numero do remetente (opcional)

    Regras:
        * NUMERO_BGS (Bgs) -> sempre True (teste de funcionamento)
        * CRITICO -> nunca IA (return False)
        * URGENTE -> IA responde AGORA, humano revisa depois (return True)
        * NORMAL  -> so auto-aprova se confianca >= 90
    """
    # Bgs: sempre responde automatico — canal de confianca
    if remetente in FORMATOS_BGS:
        return True
    if classificacao == "critico":
        return False
    if classificacao == "urgente":
        return True
    return confianca >= 90


def calcular_confianca(texto: str, classificacao: str) -> float:
    """
    Calcula um score de confianca (0-100) baseado na mensagem.
    """
    t = texto.strip()
    comprimento = len(t)
    palavras = t.split()

    conf = 75.0

    # Penalidade por mensagem muito curta
    if comprimento < 10:
        conf -= 30
    elif comprimento < 25:
        conf -= 10

    # Bonus por comprimento razoavel (indica mensagem genuina)
    if 50 <= comprimento <= 500:
        conf += 10

    if comprimento > 1000:
        conf -= 5

    # Palavras pastorais indicam intencao genuina
    palavras_confianca = [
        "deus", "jesus", "senhor", "oracao", "oracao", "orar",
        "bencao", "bencao", "bencao", "graca", "graca", "perdao", "perdao",
        "igreja", "pastor", "fe", "fe", "salvacao", "salvacao",
        "espirito", "espirito", "biblia", "biblia", "palavra",
        "creio", "acredito", "confio", "gratidao", "gratidao",
        "milagre", "libertacao", "libertacao", "curar", "cura",
    ]
    matches = sum(1 for p in palavras_confianca if p in t.lower())
    if matches >= 3:
        conf += 15
    elif matches >= 1:
        conf += 8

    # Palavras de baixa confianca (urgencia de contato comercial)
    palavras_baixa = [
        "whatsapp", "numero", "telefone", "celular", "ligar",
        "contato", "contatar", "comprar", "vender", "preco", "preco",
        "promocao", "promocao", "oferta", "desconto",
    ]
    baixas = sum(1 for p in palavras_baixa if p in t.lower())
    if baixas >= 2:
        conf -= 15
    elif baixas >= 1:
        conf -= 5

    # Urgente ja foi detectado com palavras de alerta
    if classificacao == "urgente":
        conf += 10

    conf = max(0.0, min(100.0, conf))
    return round(conf, 1)


def enviar_resposta(telefone: str, texto: str) -> dict:
    """
    Envia resposta via WhatsApp usando o modulo enviar_whatsapp.
    Retorna dict com resultado e registra no Directus.
    """
    print(f"[IA] Enviando resposta para {telefone}...")
    resultado = enviar_whatsapp.enviar(telefone, texto)

    if resultado.get("sucesso"):
        print(f"[IA] Resposta enviada com sucesso para {telefone}")
        try:
            directus_api("POST", "/items/mensagens_enviadas", {
                "telefone": telefone,
                "texto": texto[:500],
                "status": "enviado",
                "origem": "ia_auto"
            })
        except Exception as e:
            print(f"[IA] Nao foi possivel registrar envio no Directus: {e}")
    else:
        erro = resultado.get("erro", "Erro desconhecido")
        print(f"[IA] Falha ao enviar resposta para {telefone}: {erro}")

    return resultado


# ------------------------------------------------------------------
#  DeepSeek
# ------------------------------------------------------------------

def deepseek_generate(texto, msg_id):
    """Chama DeepSeek para gerar resposta pastoral."""
    if not DEEPSEEK_API_KEY:
        return "Deus te abencoe! Em breve entraremos em contato."

    system_prompt = (
        "Eres un asistente pastoral de la IURD Bolivia. "
        "REGLAS ABSOLUTAS:\n"
        "1. Responde SIEMPRE en ESPANOL.\n"
        "2. Usa la BIBLIA DE LAS AMERICAS (LBLA) para los versiculos.\n"
        "3. Lenguaje SECULAR y respetuoso: usa 'Estimado/a', 'amigo/a', "
        "NUNCA 'hermano/a'.\n"
        "4. Maximo 200 caracteres.\n"
        "5. Incluye un versiculo de la LBLA cuando sea apropiado.\n"
        "6. Se calido pero formal. Ofrece esperanza y orientacion practica.\n"
        "7. Si el mensaje es critico (suicidio, violencia), NO generes "
        "respuesta extensa, solo: 'Gracias por escribirnos. Alguien "
        "te contactara inmediatamente.'"
    )

    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": texto[:500]}
        ],
        "max_tokens": 300,
        "temperature": 0.7
    }

    req = urllib.request.Request(
        f"{DEEPSEEK_API_URL}",
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://iurd.bolivia",
            "X-Title": "IURD Bolivia IA"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())
            return result["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"[IA] Erro DeepSeek: {e}")
        return "Dios te bendiga. Estamos orando por ti."


# ------------------------------------------------------------------
#  Classificacao
# ------------------------------------------------------------------

def classificar(texto):
    """Classifica urgencia da mensagem."""
    t = texto.lower()
    criticas = ["suicidio", "suicidio", "morrer", "quero morrer", "vou morrer",
                 "violencia", "agressao", "sangrando", "emergencia", "socorro"]
    urgentes = ["urgente", "ajuda", "preciso agora", "grave", "crise", "desespero",
                "pastor", "preciso falar"]
    for w in criticas:
        if w in t:
            return "critico"
    for w in urgentes:
        if w in t:
            return "urgente"
    return "normal"


# ------------------------------------------------------------------
#  Processamento principal (ATUALIZADO)
# ------------------------------------------------------------------

def processar_mensagem(remetente, texto, msg_id=0):
    """
    Fluxo principal (ATUALIZADO - FASE 2):
    1. Verifica TV/Radio (resposta automatica)
    2. Classifica urgencia
    3. Calcula confianca
    4. Decide modo de resposta (auto_approve)
    5. Gera resposta via DeepSeek (se aplicavel)
    6. Salva no Directus com status adequado
    7. Se auto-aprovado: envia via WAHA imediatamente
    """
    # --- TV/Radio: resposta automatica sem aprovacao ---
    import tv_radio_handler
    tv_result = tv_radio_handler.processar_mensagem_tv_radio(remetente, texto, msg_id)
    if tv_result['acao'] == 'responder_direto':
        print(f"[IA] TV/Radio: resposta automatica para {remetente}")
        chat_id = remetente
        payload = json.dumps({
            "session": "default",
            "chatId": chat_id,
            "text": tv_result['resposta']
        }).encode()
        try:
            req = urllib.request.Request(
                f"{WAHA_URL}/api/sendText",
                data=payload,
                headers={
                    "X-API-Key": WAHA_API_KEY,
                    "Content-Type": "application/json"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                result = json.loads(resp.read())
                print(f"[IA] TV/Radio: mensagem enviada via WAHA: {result.get('status','ok')}")
        except Exception as e:
            print(f"[IA] TV/Radio: erro WAHA: {e}")
        data = {
            "msg_original": texto,
            "resposta_ia": tv_result['resposta'],
            "resposta_final": tv_result['resposta'],
            "classificacao": "tv_radio",
            "status": "aprovada",
            "confianca_ia": 100,
            "auto_aprovado": True
        }
        directus_api("POST", "/items/respostas_pendentes", data)
        print(f"[IA] TV/Radio: resposta registrada no Directus")
        return

    elif tv_result['acao'] == 'encaminhar_pastor':
        print(f"[IA] TV/Radio: encaminhando para fluxo pastoral: {tv_result['tipo']}")

    elif tv_result['acao'] == 'salvar_evento':
        print(f"[IA] TV/Radio: salvando evento para {remetente}")
        chat_id = remetente
        payload = json.dumps({
            "session": "default",
            "chatId": chat_id,
            "text": tv_result['resposta']
        }).encode()
        try:
            req = urllib.request.Request(
                f"{WAHA_URL}/api/sendText",
                data=payload,
                headers={
                    "X-API-Key": WAHA_API_KEY,
                    "Content-Type": "application/json"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                result = json.loads(resp.read())
                print(f"[IA] TV/Radio: confirmacao evento enviada: {result.get('status','ok')}")
        except Exception as e:
            print(f"[IA] TV/Radio: erro WAHA: {e}")
        data = {
            "msg_original": texto,
            "resposta_ia": tv_result['resposta'],
            "classificacao": "evento",
            "status": "pendente",
            "confianca_ia": 90,
            "auto_aprovado": False
        }
        directus_api("POST", "/items/respostas_pendentes", data)
        return

    # ------------------------------------------------------------------
    #  Fluxo principal ATUALIZADO (FASE 2)
    # ------------------------------------------------------------------
    classificacao = classificar(texto)
    confianca = calcular_confianca(texto, classificacao)
    print(f"[IA] Msg {msg_id} de {remetente}: class={classificacao}, confianca={confianca}")

    # --- CRITICO: nunca IA (exceto Bgs) --------------------------------
    if classificacao == "critico" and remetente not in FORMATOS_BGS:
        data = {
            "msg_original": texto,
            "resposta_ia": "[CRITICO - Responder imediatamente]",
            "classificacao": "critico",
            "status": "pendente",
            "confianca_ia": 0,
            "auto_aprovado": False
        }
        directus_api("POST", "/items/respostas_pendentes", data)
        print(f"[IA] Critico salvo - requer atencao humana imediata!")
        return

    # --- Gera resposta com DeepSeek (para normal e urgente) ----------
    resposta = deepseek_generate(texto, msg_id)
    print(f"[IA] Resposta gerada: {resposta[:60]}...")

    # --- Decide se pode auto-aprovar ---------------------------------
    pode_auto = auto_approve(classificacao, confianca, remetente)
    modo_str = "AUTO" if pode_auto else "HUMANO"
    print(f"[IA] Modo: {modo_str} (class={classificacao}, conf={confianca})")

    # --- URGENTE: IA responde AGORA + copia pra humano ---------------
    if classificacao == "urgente" and pode_auto:
        data_auto = {
            "msg_original": texto,
            "resposta_ia": resposta,
            "resposta_final": resposta,
            "classificacao": "urgente",
            "status": "aprovada",
            "confianca_ia": confianca,
            "auto_aprovado": True,
            "nota": "AUTO-APROVADO (URGENTE) - IA respondeu automaticamente"
        }
        result_auto = directus_api("POST", "/items/respostas_pendentes", data_auto)
        if result_auto:
            print(f"[IA] Urgente auto-aprovado no Directus")
        else:
            print(f"[IA] Erro ao salvar auto-aprovacao urgente")

        # Registro extra como pendente para revisao humana
        data_revisao = {
            "msg_original": texto,
            "resposta_ia": resposta,
            "resposta_final": resposta,
            "classificacao": "urgente_revisao",
            "status": "pendente",
            "confianca_ia": confianca,
            "auto_aprovado": True,
            "nota": "REVISAO NECESSARIA - IA respondeu automaticamente (URGENTE). Revisar conversa."
        }
        result_rev = directus_api("POST", "/items/respostas_pendentes", data_revisao)
        if result_rev:
            print(f"[IA] Registro de revisao criado para humano")
        else:
            print(f"[IA] Nao foi possivel criar registro de revisao")

        enviar_resposta(remetente, resposta)
        return

    # --- NORMAL com confianca alta (>= 90): auto-aprova --------------
    if classificacao == "normal" and pode_auto:
        data = {
            "msg_original": texto,
            "resposta_ia": resposta,
            "resposta_final": resposta,
            "classificacao": "normal",
            "status": "aprovada",
            "confianca_ia": confianca,
            "auto_aprovado": True,
            "nota": "AUTO-APROVADO (confianca >= 90)"
        }
        result = directus_api("POST", "/items/respostas_pendentes", data)
        if result:
            print(f"[IA] Auto-aprovado salvo no Directus")
        else:
            print(f"[IA] Erro ao salvar auto-aprovacao")

        enviar_resposta(remetente, resposta)
        return

    # --- NORMAL com confianca baixa (< 90): vai pra humano -----------
    data = {
        "msg_original": texto,
        "resposta_ia": resposta,
        "classificacao": classificacao,
        "status": "pendente",
        "confianca_ia": confianca,
        "auto_aprovado": False
    }
    result = directus_api("POST", "/items/respostas_pendentes", data)
    if result:
        print(f"[IA] Pendente salvo no Directus (aguardando humano)")
    else:
        print(f"[IA] Erro ao salvar no Directus")


# ------------------------------------------------------------------
#  Servidor HTTP
# ------------------------------------------------------------------

class IAListener(http.server.BaseHTTPRequestHandler):
    """Servidor HTTP que recebe webhooks e webhooks de aprovacao."""

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length > 0 else b"{}"

        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            self._respond(400, {"error": "JSON invalido"})
            return

        if self.path == "/ia/receber":
            remetente = data.get("remetente", "")
            texto = data.get("texto", "")
            msg_id = data.get("pessoa_id", 0)

            if not remetente or not texto:
                self._respond(400, {"error": "remetente e texto required"})
                return

            threading.Thread(target=processar_mensagem,
                args=(remetente, texto, msg_id), daemon=True).start()

            self._respond(200, {"status": "processing"})

        elif self.path == "/ia/aprovar":
            resposta_id = data.get("id", "")
            acao = data.get("acao", "approve")
            texto_aprovado = data.get("texto", "")
            chat_id = data.get("chatId", "")
            aprovado_por = data.get("aprovado_por", "admin")

            if acao == "reject":
                directus_api("PATCH", f"/items/respostas_pendentes/{resposta_id}",
                    {"status": "rejeitada", "aprovado_por": aprovado_por})
                self._respond(200, {"status": "rejeitada"})
                return

            texto_final = texto_aprovado or data.get("resposta_ia", "")

            if not texto_final or not chat_id:
                self._respond(400, {"error": "texto e chatId required"})
                return

            directus_api("PATCH", f"/items/respostas_pendentes/{resposta_id}", {
                "status": "aprovada" if acao == "approve" else "editada",
                "resposta_final": texto_final,
                "aprovado_por": aprovado_por
            })

            self._enviar_waha(chat_id, texto_final)
            self._respond(200, {"status": "enviado"})

        elif self.path == "/ia/health":
            self._respond(200, {"status": "ok", "deepseek": bool(DEEPSEEK_API_KEY)})

        else:
            self._respond(404, {"error": "Rota nao encontrada"})

    def do_GET(self):
        if self.path == "/ia/health":
            self._respond(200, {"status": "ok", "deepseek": bool(DEEPSEEK_API_KEY)})
        else:
            self._respond(404, {"error": "Rota nao encontrada"})

    def _enviar_waha(self, chat_id, texto):
        """Envia mensagem via WAHA."""
        payload = json.dumps({
            "session": "default",
            "chatId": chat_id,
            "text": texto
        }).encode()
        try:
            req = urllib.request.Request(
                f"{WAHA_URL}/api/sendText",
                data=payload,
                headers={
                    "X-API-Key": WAHA_API_KEY,
                    "Content-Type": "application/json"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                result = json.loads(resp.read())
                print(f"[IA] Mensagem enviada via WAHA: {result.get('status','ok')}")
        except Exception as e:
            print(f"[IA] Erro WAHA: {e}")

    def _respond(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, format, *args):
        pass


# ------------------------------------------------------------------
#  Main
# ------------------------------------------------------------------

def main():
    print(f"\n{'='*50}")
    print("IURD 360 - IA com Supervisao Humana (FASE 2 - AO VIVO)")
    print(f"{'='*50}")
    print(f"  Porta: {PORT}")
    print(f"  DeepSeek: {'OK' if DEEPSEEK_API_KEY else 'FALTA'} {DEEPSEEK_MODEL}")
    print(f"  Directus: {DIRECTUS_URL}")
    print(f"  WAHA: {WAHA_URL}")
    print()
    print(f"  MODOS DE RESPOSTA:")
    print(f"    AUTO     -> confianca >= 90 (responde direto)")
    print(f"    HUMANO   -> confianca < 90 (precisa aprovacao)")
    print(f"    URGENTE  -> IA responde + COPIA pra humano")
    print(f"    CRITICO  -> NUNCA IA, sempre humano")
    print()
    print(f"  Endpoints:")
    print(f"    POST /ia/receber   - Receber mensagem do WhatsApp")
    print(f"    POST /ia/aprovar   - Aprovar/editar/rejeitar resposta")
    print(f"    GET  /ia/health    - Health check")
    print(f"{'='*50}\n")

    server = http.server.HTTPServer(("0.0.0.0", PORT), IAListener)

    def shutdown(sig, frame):
        print("\n[IA] Desligando...")
        server.shutdown()

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        print("[IA] Servidor parado.")


if __name__ == "__main__":
    main()
