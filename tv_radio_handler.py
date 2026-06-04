#!/usr/bin/env python3
"""
TV/Rádio — Respostas automáticas sobre programação
==================================================
Integra-se ao ia-supervisionada.py para detectar perguntas
sobre horários da TV/Rádio IURD e responder automaticamente.

Fluxo:
  1. classificar_tipo_mensagem() detecta 'programacao', 'oracao', 'evento', 'testemunho'
  2. Se 'programacao' → buscar_programacao_hoje() + formatar_resposta_programacao()
  3. Se 'oracao'/'testemunho' → fluxo normal (DeepSeek + aprovação humana)
  4. Se 'evento' → salvar no Directus como inscrição
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime

# ─── Config (mesmo padrão do ia-supervisionada.py) ────────────────
DIRECTUS_URL = "http://localhost:8055"
DIRECTUS_EMAIL = "paginaweb.bolivia@gmail.com"
DIRECTUS_PASSWORD = "Uni2026!"
LINK_TV = "https://www.youtube.com/@IURDBoliviaOficial"
LINK_RADIO = "https://iurd.bo/radio"

# ─── Palavras-chave para detectar pergunta sobre programação ─────
PALAVRAS_PROGRAMACAO = [
    "horario", "horário", "programa", "programação", "programacao",
    "tv", "radio", "rádio", "canal",
    "link", "assistir", "en vivo", "ao vivo", "aovivo",
    "grade", "programacion", "programación",
    "que hoje", "o que vai passar", "whatsapp",
    "estreia", "vai passar", "passando",
]

PALAVRAS_ORACAO = [
    "oracao", "oração", "orar", "reza", "rezar",
    "pastor", "conselho", "ajuda espiritual",
    "bencao", "bênção", "benção", "bendicao",
    "intercessão", "intercessao",
]

PALAVRAS_EVENTO = [
    "inscricao", "inscrição", "inscrever", "cadastrar",
    "evento", "crusad", "cruzada", "campanha",
    "queroparticipar", "quero participar", "participar",
    "palestra", "seminario", "seminário",
]

PALAVRAS_TESTEMUNHO = [
    "testemunho", "depoimento", "milagre",
    "aconteceu", "passei", "fui liberto",
    "graça", "graca", "benefic",
]

# ─── Nomes dos dias da semana ─────────────────────────────────────
DIAS_SEMANA = [
    "domingo", "segunda-feira", "terça-feira",
    "quarta-feira", "quinta-feira", "sexta-feira", "sábado"
]

# ─── Cache de token ───────────────────────────────────────────────
_DIRECTUS_TOKEN = None
_TOKEN_EXPIRES = 0


# ═══════════════════════════════════════════════════════════════════
#  Directus helpers
# ═══════════════════════════════════════════════════════════════════

def directus_token():
    global _DIRECTUS_TOKEN, _TOKEN_EXPIRES
    now = time.time()
    if _DIRECTUS_TOKEN and now < _TOKEN_EXPIRES:
        return _DIRECTUS_TOKEN
    data = json.dumps({"email": DIRECTUS_EMAIL, "password": DIRECTUS_PASSWORD}).encode()
    req = urllib.request.Request(
        f"{DIRECTUS_URL}/auth/login",
        data=data,
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req) as resp:
            body = json.loads(resp.read())
            _DIRECTUS_TOKEN = body["data"]["access_token"]
            _TOKEN_EXPIRES = now + 1800
            return _DIRECTUS_TOKEN
    except Exception as e:
        print(f"[TV-RADIO] Erro login Directus: {e}")
        return None


def directus_api(method, path, data=None):
    """Faz requisição à API do Directus."""
    token = directus_token()
    if not token:
        return None
    url = f"{DIRECTUS_URL}{path}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"[TV-RADIO] Directus {method} {path}: {e.code} {err[:200]}")
        return None


# ═══════════════════════════════════════════════════════════════════
#  Classificador de mensagens
# ═══════════════════════════════════════════════════════════════════

def classificar_tipo_mensagem(texto):
    """
    Classifica o tipo de mensagem recebida.

    Retorna uma das strings:
      'programacao'  -> resposta automática sobre horários TV/Rádio
      'oracao'       -> fluxo normal de IA + aprovação humana
      'evento'       -> salvar inscrição no Directus
      'testemunho'   -> fluxo de testemunho
      'normal'       -> fluxo padrão (DeepSeek + aprovação)
    """
    if not texto:
        return 'normal'

    t = texto.lower().strip()

    # Verifica se é pergunta sobre programação
    # Palavras-chave específicas + contexto de pergunta
    palavras_encontradas = [p for p in PALAVRAS_PROGRAMACAO if p in t]

    # Se encontrar pelo menos 2 keywords de programação, classifica como programacao
    # Ou se encontrar 1 keyword + tiver ? no texto
    if len(palavras_encontradas) >= 2:
        return 'programacao'
    if len(palavras_encontradas) >= 1 and ('?' in t or '\xbf' in t):
        return 'programacao'

    # Se for pergunta sobre programação com uma palavra-chave forte
    for palavra_forte in ['horario', 'horário', 'programa', 'grade']:
        if palavra_forte in t:
            return 'programacao'

    # Verifica evento
    for p in PALAVRAS_EVENTO:
        if p in t:
            return 'evento'

    # Verifica testemunho
    for p in PALAVRAS_TESTEMUNHO:
        if p in t:
            return 'testemunho'

    # Verifica oração
    for p in PALAVRAS_ORACAO:
        if p in t:
            return 'oracao'

    return 'normal'


def detectar_tipo_programacao(texto):
    """
    Detecta se a pergunta é sobre TV, Rádio ou ambos.

    Retorna: 'tv', 'radio', ou 'ambos'
    """
    t = texto.lower()
    quer_tv = any(p in t for p in ['tv', 'televisão', 'televisao', 'canal', 'youtube',
                                     'assistir', 'video', 'vídeo'])
    quer_radio = any(p in t for p in ['radio', 'rádio', 'fm', 'ouvir', 'audio', 'áudio'])

    if quer_tv and quer_radio:
        return 'ambos'
    if quer_tv:
        return 'tv'
    if quer_radio:
        return 'radio'
    return 'tv'  # padrão TV


# ═══════════════════════════════════════════════════════════════════
#  Busca programação no Directus
# ═══════════════════════════════════════════════════════════════════

def buscar_programacao_hoje(tipo='tv'):
    """Busca a programação de HOJE no Directus."""
    dia_semana = datetime.now().weekday()  # 0=segunda, 6=domingo
    # Directus usa 0=domingo -> converter
    dia_semana_directus = (dia_semana + 1) % 7  # 0=domingo

    filtros = []
    if tipo == 'tv':
        filtros.append("filter[tipo][_eq]=tv")
    elif tipo == 'radio':
        filtros.append("filter[tipo][_eq]=radio")

    filtros.append(f"filter[dia_semana][_eq]={dia_semana_directus}")
    filtros.append("filter[ativo][_eq]=1")
    filtros.append("sort=horario")
    filtros.append("limit=50")

    query = "&".join(filtros)
    result = directus_api("GET", f"/items/programacao?{query}")

    if not result or not result.get("data"):
        print(f"[TV-RADIO] Nenhum programa encontrado para dia={dia_semana_directus}, tipo={tipo}")
        return []

    return result["data"]


def buscar_programacao_restante(programas):
    """
    Filtra apenas os programas que ainda não passaram (horario > agora).
    """
    agora = datetime.now()
    hora_atual = agora.hour * 60 + agora.minute

    restantes = []
    for prog in programas:
        try:
            h, m = prog["horario"].split(":")
            min_prog = int(h) * 60 + int(m)
            if min_prog >= hora_atual:
                restantes.append(prog)
        except (ValueError, KeyError):
            restantes.append(prog)

    return restantes


# ═══════════════════════════════════════════════════════════════════
#  Formatação de resposta
# ═══════════════════════════════════════════════════════════════════

def formatar_resposta_programacao(programas, tipo='tv'):
    """Formata resposta automática com programação do dia."""
    if not programas:
        nome = "TV IURD" if tipo == 'tv' else "Radio IURD"
        return (f"📺 *{nome}*\n\n"
                "Não encontrei programação para hoje. "
                "Fique ligado! Em breve teremos novidades. 🙏")

    dia_semana = datetime.now().weekday()
    nome_dia = DIAS_SEMANA[dia_semana]

    if tipo == 'tv':
        cabecalho = f"📺 *TV IURD — Programação {nome_dia}*\n\n"
    else:
        cabecalho = f"📻 *Rádio IURD — Programação {nome_dia}*\n\n"

    linhas = []
    for p in programas:
        horario = p.get("horario", "")
        titulo = p.get("titulo", "Programa")
        descricao = p.get("descricao", "")
        if descricao:
            linhas.append(f"⏰ *{horario}* — {titulo}\n   _{descricao}_")
        else:
            linhas.append(f"⏰ *{horario}* — {titulo}")

    corpo = "\n".join(linhas)

    if tipo == 'tv':
        link = f"\n\n🔗 *Assista ao vivo:* {LINK_TV}"
    else:
        link = f"\n\n🔗 *Ouça ao vivo:* {LINK_RADIO}"

    rodape = "\n\n🙏 Deus abençoe seu dia!"

    return cabecalho + corpo + link + rodape


def formatar_resposta_ambos(programas_tv, programas_radio):
    """Formata resposta combinada TV + Radio."""
    dia_semana = datetime.now().weekday()
    nome_dia = DIAS_SEMANA[dia_semana]

    cabecalho = f"📡 *Programação IURD — {nome_dia}*\n\n"
    partes = []

    if programas_tv:
        partes.append("📺 *TV IURD:*")
        for p in programas_tv:
            h = p.get("horario", "")
            t = p.get("titulo", "Programa")
            partes.append(f"⏰ {h} — {t}")
        partes.append("")

    if programas_radio:
        partes.append("📻 *Rádio IURD:*")
        for p in programas_radio:
            h = p.get("horario", "")
            t = p.get("titulo", "Programa")
            partes.append(f"⏰ {h} — {t}")
        partes.append("")

    links = (
        f"\n🔗 *TV ao vivo:* {LINK_TV}\n"
        f"🔗 *Rádio ao vivo:* {LINK_RADIO}"
    )

    rodape = "\n\n🙏 Deus abençoe seu dia!"

    return cabecalho + "\n".join(partes) + links + rodape


# ═══════════════════════════════════════════════════════════════════
#  Processamento principal (ponto de entrada para ia-supervisionada)
# ═══════════════════════════════════════════════════════════════════

def processar_mensagem_tv_radio(remetente, texto, msg_id=0):
    """
    Processa mensagem recebida no numero de TV/Radio.

    Returns:
        Dict com:
          - 'acao': 'responder_direto' | 'encaminhar_pastor' | 'salvar_evento' | 'normal'
          - 'resposta': texto formatado (se acao == 'responder_direto')
          - 'tipo': tipo_classificado
    """
    tipo = classificar_tipo_mensagem(texto)
    print(f"[TV-RADIO] Msg {msg_id} de {remetente}: tipo={tipo}")

    resultado = {
        "acao": "normal",
        "resposta": "",
        "tipo": tipo,
        "msg_original": texto,
        "remetente": remetente,
        "msg_id": msg_id,
    }

    if tipo == 'programacao':
        midia = detectar_tipo_programacao(texto)

        if midia == 'ambos':
            programas_tv = buscar_programacao_hoje('tv')
            programas_radio = buscar_programacao_hoje('radio')
            resposta = formatar_resposta_ambos(programas_tv, programas_radio)
        else:
            programas = buscar_programacao_hoje(midia)
            if not programas:
                programas = buscar_programacao_hoje('tv')
                midia = 'tv'
            programas_restantes = buscar_programacao_restante(programas)
            if programas_restantes:
                resposta = formatar_resposta_programacao(programas_restantes, midia)
            else:
                resposta = formatar_resposta_programacao(programas, midia)

        resultado["acao"] = "responder_direto"
        resultado["resposta"] = resposta
        resultado["midia"] = midia
        print(f"[TV-RADIO] Resposta automatica gerada ({len(resposta)} chars)")

    elif tipo == 'evento':
        resultado["acao"] = "salvar_evento"
        resultado["resposta"] = ("📋 Recebemos seu interesse no evento! "
                                 "Em breve entraremos em contato. 🙏")
        print(f"[TV-RADIO] Evento registrado para {remetente}")

    elif tipo in ('oracao', 'testemunho'):
        resultado["acao"] = "encaminhar_pastor"
        resultado["resposta"] = ""
        print(f"[TV-RADIO] Encaminhando para pastor: {tipo}")

    else:
        resultado["acao"] = "normal"
        resultado["resposta"] = ""
        print(f"[TV-RADIO] Fluxo normal (DeepSeek + aprovacao)")

    return resultado


# ═══════════════════════════════════════════════════════════════════
#  Teste / execução direta
# ═══════════════════════════════════════════════════════════════════

def testar():
    """Executa um teste rapido com perguntas exemplo."""
    exemplos = [
        "Qual o horário da programação da TV hoje?",
        "Quero oração, estou passando por um momento difícil",
        "Quero me inscrever no evento da cruzada",
        "TV IURD hoje às 19h?",
        "Tem programação no rádio agora?",
        "Deus abençoe",
        "Quero dar meu testemunho de cura",
        "Link para assistir a TV IURD ao vivo",
        "O que vai passar hoje na TV?",
        "Quero oração para minha família",
    ]

    print("\n" + "=" * 60)
    print("TV/Radio Handler - Teste de Classificacao")
    print("=" * 60)
    print()

    for i, exemplo in enumerate(exemplos, 1):
        tipo = classificar_tipo_mensagem(exemplo)
        print(f"  {i:2d}. [{tipo:14s}] {exemplo}")

    print()
    print("=" * 60)
    print("Teste de Busca de Programacao de HOJE")
    print("=" * 60)
    print()

    print(f"Hoje e: {DIAS_SEMANA[datetime.now().weekday()]}")
    print()

    for midia in ['tv', 'radio']:
        programas = buscar_programacao_hoje(midia)
        print(f"\n  {'TV' if midia == 'tv' else 'RADIO'} - {len(programas)} programas encontrados")
        if programas:
            for p in programas[:5]:
                print(f"    {p.get('horario','')} - {p.get('titulo','')}")
            if len(programas) > 5:
                print(f"    ... e mais {len(programas) - 5} programas")

    print()
    print("=" * 60)
    print("Teste de Resposta Formatada")
    print("=" * 60)

    programas_tv = buscar_programacao_hoje('tv')
    programas_radio = buscar_programacao_hoje('radio')

    if programas_tv:
        print("\nRESPOSTA TV:")
        print(formatar_resposta_programacao(programas_tv, 'tv'))
        print()

    if programas_tv and programas_radio:
        print("\nRESPOSTA COMBINADA:")
        resposta = formatar_resposta_ambos(programas_tv[:3], programas_radio[:3])
        print(resposta)
        print()

    print("=" * 60)
    print("Teste concluido")
    print("=" * 60)


def integracao_teste(pergunta):
    """Testa o fluxo completo com uma pergunta."""
    resultado = processar_mensagem_tv_radio("teste@c.us", pergunta, msg_id=999)
    print(f"\nPergunta: {pergunta}")
    print(f"Resultado:")
    print(f"   Tipo: {resultado['tipo']}")
    print(f"   Acao: {resultado['acao']}")
    if resultado['resposta']:
        print(f"\nResposta:\n{resultado['resposta']}")
    return resultado


if __name__ == "__main__":
    if len(sys.argv) > 1:
        pergunta = " ".join(sys.argv[1:])
        integracao_teste(pergunta)
    else:
        testar()
