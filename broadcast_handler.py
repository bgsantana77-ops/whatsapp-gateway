#!/usr/bin/env python3
"""
broadcast_handler.py — Sistema de Broadcast em 3 Níveis (país/igreja/corrente).

Funcionalidades:
  1. get_publico(nivel, filtro_id)  → lista de pessoas com consentimento
  2. renderizar_template(template_id, pessoa) → str com placeholders substituídos
  3. enviar_broadcast(comunicado_id) → executa o broadcast completo
  4. agendar_broadcast(comunicado_id, data_hora) → agenda via cron/hermes

Dependências:
  - enviar_whatsapp.py (mesmo diretório)
  - Directus em http://localhost:8055
  - WAHA em http://localhost:3002

Uso:
  python3 broadcast_handler.py get_publico pais
  python3 broadcast_handler.py get_publico igreja 1
  python3 broadcast_handler.py get_publico corrente 8
  python3 broadcast_handler.py enviar <comunicado_id>
  python3 broadcast_handler.py agendar <comunicado_id> "2026-06-07 09:30:00"
  python3 broadcast_handler.py renderizar <template_id> <pessoa_id>
"""

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime
from typing import Any, Optional

# ── Config ──────────────────────────────────────────────────────────────
DIRETUS_URL = os.getenv("DIRETUS_URL", "http://localhost:8055")
DIRETUS_TOKEN = os.getenv("DIRETUS_TOKEN", "")
DIRETUS_EMAIL = os.getenv("DIRETUS_EMAIL", "paginaweb.bolivia@gmail.com")
DIRETUS_PASSWORD = os.getenv("DIRETUS_PASSWORD", "Uni2026!")

WAHA_URL = os.getenv("WAHA_URL", "http://localhost:3002")
WAHA_API_KEY = os.getenv("WAHA_API_KEY", "ebb0879aae964a61bd612cebd4d11b55")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ENVIAR_SCRIPT = os.path.join(SCRIPT_DIR, "enviar_whatsapp.py")

# ── Cache de token ──────────────────────────────────────────────────────
_token_cache: dict[str, Any] = {"token": None, "expires": 0}


def _get_directus_token() -> str:
    """Obtém token de acesso ao Directus via login ou variável de ambiente."""
    if DIRETUS_TOKEN:
        return DIRETUS_TOKEN

    now = datetime.now().timestamp()
    if _token_cache["token"] and _token_cache["expires"] > now:
        return _token_cache["token"]

    url = f"{DIRETUS_URL}/auth/login"
    payload = json.dumps({
        "email": DIRETUS_EMAIL,
        "password": DIRETUS_PASSWORD,
    }).encode("utf-8")

    req = urllib.request.Request(
        url, data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            token = body["data"]["access_token"]
            expires_in = body["data"].get("expires", 900000)
            _token_cache["token"] = token
            _token_cache["expires"] = now + (expires_in / 1000) - 60
            return token
    except Exception as e:
        raise RuntimeError(f"Falha ao autenticar no Directus: {e}")


def _directus_get(collection: str, params: Optional[dict] = None) -> list[dict]:
    """Faz GET em uma coleção do Directus com filtro JSON."""
    token = _get_directus_token()
    url = f"{DIRETUS_URL}/items/{collection}"

    query_parts = []
    if params:
        for k, v in params.items():
            if isinstance(v, bool):
                v = str(v).lower()
            query_parts.append(f"{k}={urllib.request.quote(str(v))}")
    if query_parts:
        url += "?" + "&".join(query_parts)

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            return body.get("data", [])
    except urllib.error.HTTPError as e:
        err_text = e.read().decode("utf-8")
        raise RuntimeError(f"Erro HTTP {e.code} ao acessar {collection}: {err_text}")
    except Exception as e:
        raise RuntimeError(f"Erro ao acessar Directus ({collection}): {e}")


def _directus_get_single(collection: str, item_id: int) -> dict:
    """Obtém um único item pelo ID."""
    token = _get_directus_token()
    url = f"{DIRETUS_URL}/items/{collection}/{item_id}"
    headers = {"Authorization": f"Bearer {token}"}

    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            return body.get("data", {})
    except urllib.error.HTTPError as e:
        err_text = e.read().decode("utf-8")
        raise RuntimeError(f"Erro HTTP {e.code} ao buscar {collection}/{item_id}: {err_text}")


def _directus_create(collection: str, data: dict) -> dict:
    """Cria um registro em uma coleção do Directus."""
    token = _get_directus_token()
    url = f"{DIRETUS_URL}/items/{collection}"
    payload = json.dumps(data).encode("utf-8")
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            return body.get("data", {})
    except urllib.error.HTTPError as e:
        err_text = e.read().decode("utf-8")
        raise RuntimeError(f"Erro HTTP {e.code} ao criar em {collection}: {err_text}")


def _directus_update(collection: str, item_id: int, data: dict) -> dict:
    """Atualiza um registro existente no Directus."""
    token = _get_directus_token()
    url = f"{DIRETUS_URL}/items/{collection}/{item_id}"
    payload = json.dumps(data).encode("utf-8")
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    req = urllib.request.Request(url, data=payload, headers=headers, method="PATCH")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            return body.get("data", {})
    except urllib.error.HTTPError as e:
        err_text = e.read().decode("utf-8")
        raise RuntimeError(f"Erro HTTP {e.code} ao atualizar {collection}/{item_id}: {err_text}")


# ══════════════════════════════════════════════════════════════════════════
# 1. get_publico
# ══════════════════════════════════════════════════════════════════════════

def get_publico(nivel: str, filtro_id: Optional[int] = None) -> list[dict]:
    """
    Retorna lista de pessoas com consentimento=1 baseado no nível:
      - 'pais':     TODAS as pessoas com consentimento=1
      - 'igreja':   pessoas com igreja_id=filtro_id E consentimento=1
      - 'corrente': pessoas em membros_cadeia onde cadeia.corrente_id=filtro_id E consentimento=1

    Args:
        nivel: 'pais', 'igreja' ou 'corrente'
        filtro_id: ID da igreja ou corrente (ignorado para 'pais')

    Returns:
        list[dict] — cada dict com id, nome, telefone, igreja_id, etc.
    """
    if nivel == "pais":
        filtro = json.dumps({"consentimento": {"_eq": 1}})
        pessoas = _directus_get("pessoas", {
            "filter": filtro,
            "limit": 500,
        })
        return pessoas

    elif nivel == "igreja":
        if not filtro_id:
            raise ValueError("nivel='igreja' requer filtro_id (ID da igreja)")

        filtro = json.dumps({
            "consentimento": {"_eq": 1},
            "igreja_id": {"_eq": filtro_id},
        })
        pessoas = _directus_get("pessoas", {
            "filter": filtro,
            "limit": 500,
        })
        return pessoas

    elif nivel == "corrente":
        if not filtro_id:
            raise ValueError("nivel='corrente' requer filtro_id (ID da corrente)")

        # 1. Busca cadeias que pertencem a esta corrente
        filtro_cadeias = json.dumps({"corrente_id": {"_eq": filtro_id}})
        cadeias = _directus_get("cadeias", {"filter": filtro_cadeias})
        cadeia_ids = [c["id"] for c in cadeias]

        if not cadeia_ids:
            return []

        # 2. Busca membros dessas cadeias
        membros = []
        for cid in cadeia_ids:
            filtro_membros = json.dumps({"cadeia_id": {"_eq": cid}})
            membros.extend(_directus_get("membros_cadeia", {
                "filter": filtro_membros,
                "limit": 500,
            }))

        pessoa_ids = list(set(m["pessoa_id"] for m in membros if m.get("pessoa_id")))
        if not pessoa_ids:
            return []

        # 3. Busca as pessoas com consentimento
        filtro_pessoas = json.dumps({
            "consentimento": {"_eq": 1},
            "id": {"_in": pessoa_ids},
        })
        pessoas = _directus_get("pessoas", {
            "filter": filtro_pessoas,
            "limit": 500,
        })
        return pessoas

    else:
        raise ValueError(f"Nível inválido: '{nivel}'. Use 'pais', 'igreja' ou 'corrente'.")


# ══════════════════════════════════════════════════════════════════════════
# 2. renderizar_template
# ══════════════════════════════════════════════════════════════════════════

def renderizar_template(template_id: int, pessoa: dict, extras: Optional[dict] = None) -> str:
    """
    Renderiza um template substituindo placeholders com dados da pessoa.

    Placeholders suportados no template:
      {nome}        → nome da pessoa (ou 'Irmão(ã)' se vazio)
      {igreja}      → nome da igreja da pessoa
      {igreja_nome} → alias para {igreja}
      {endereco}    → endereço da igreja
      {cidade}      → cidade da igreja
      {data}        → data atual formatada (dd/mm/aaaa)
      {horario}     → horário atual (HH:MM)
      {corrente}    → nome da corrente (se aplicável)
      {telefone}    → telefone da pessoa

    Args:
        template_id: ID do template no Directus
        pessoa: Dict da pessoa (com id, nome, telefone, igreja_id, etc.)
        extras: Dict extra com placeholders adicionais

    Returns:
        str com template renderizado
    """
    template = _directus_get_single("templates", template_id)
    texto = template.get("texto", "")
    if not texto:
        raise ValueError(f"Template {template_id} vazio ou não encontrado")

    agora = datetime.now()

    # ── Placeholders básicos da pessoa ──
    nome = pessoa.get("nome") or "Irmão(ã)"
    telefone = pessoa.get("telefone", "")

    # ── Dados da igreja ──
    igreja_nome = ""
    endereco = ""
    cidade = ""
    igreja_id = pessoa.get("igreja_id")
    if igreja_id:
        try:
            igreja = _directus_get_single("igrejas", igreja_id)
            igreja_nome = igreja.get("nome", "")
            endereco = igreja.get("endereco", "")
            cidade = igreja.get("cidade", "")
        except Exception:
            pass

    # ── Dados da corrente ──
    corrente_nome = ""
    if extras and extras.get("corrente_id"):
        try:
            corrente = _directus_get_single("correntes", extras["corrente_id"])
            corrente_nome = corrente.get("nome", "")
        except Exception:
            pass

    # ── Placeholders ──
    placeholders = {
        "{nome}": nome,
        "{igreja}": igreja_nome,
        "{igreja_nome}": igreja_nome,
        "{endereco}": endereco,
        "{cidade}": cidade,
        "{data}": extras.get("data", agora.strftime("%d/%m/%Y")) if extras else agora.strftime("%d/%m/%Y"),
        "{horario}": extras.get("horario", agora.strftime("%H:%M")) if extras else agora.strftime("%H:%M"),
        "{corrente}": corrente_nome,
        "{telefone}": telefone,
    }

    if extras:
        for k, v in extras.items():
            ph = "{" + k + "}"
            if ph not in placeholders:
                placeholders[ph] = str(v) if v else ""

    resultado = texto
    for placeholder, valor in placeholders.items():
        resultado = resultado.replace(placeholder, str(valor) if valor else "")

    return resultado


# ══════════════════════════════════════════════════════════════════════════
# 3. enviar_broadcast
# ══════════════════════════════════════════════════════════════════════════

def enviar_broadcast(comunicado_id: int) -> dict:
    """
    Executa o broadcast completo para um comunicado.

    Fluxo:
      1. Busca comunicado no Directus
      2. Busca público alvo (com consentimento) baseado no nivel/filtro_id
      3. Se tiver template_id, renderiza template para cada pessoa
      4. Envia via enviar_whatsapp.py para cada pessoa
      5. Registra cada envio no historico_broadcast
      6. Atualiza comunicado.status → 'enviado'

    Args:
        comunicado_id: ID do comunicado no Directus

    Returns:
        dict com resumo
    """
    # 1. Busca comunicado
    comunicado = _directus_get_single("comunicados", comunicado_id)
    if not comunicado:
        raise ValueError(f"Comunicado {comunicado_id} não encontrado")

    nivel = comunicado.get("nivel") or "pais"
    filtro_id = comunicado.get("filtro_id")
    template_id = comunicado.get("template_id")
    texto_fixo = comunicado.get("texto", "")

    print(f"[Broadcast] Comunicado '{comunicado.get('titulo')}' (id={comunicado_id})")
    print(f"[Broadcast] Nível: {nivel}, filtro_id: {filtro_id}")
    print(f"[Broadcast] Template: {template_id}, Texto fixo: {bool(texto_fixo)}")

    # 2. Busca público alvo
    try:
        publico = get_publico(nivel, filtro_id)
    except ValueError as e:
        _directus_update("comunicados", comunicado_id, {"status": "erro_config"})
        raise

    if not publico:
        _directus_update("comunicados", comunicado_id, {
            "status": "concluido",
            "enviado": 1,
            "total_destinos": 0,
            "total_entregues": 0,
        })
        return {
            "comunicado_id": comunicado_id,
            "total_destinos": 0,
            "total_enviados": 0,
            "total_erros": 0,
            "mensagem": "Nenhum destinatário encontrado com consentimento",
            "detalhes": [],
        }

    print(f"[Broadcast] Público alvo: {len(publico)} pessoas")

    _directus_update("comunicados", comunicado_id, {
        "status": "enviando",
        "total_destinos": len(publico),
    })

    # 3. Envia para cada pessoa
    resultados = []
    enviados = 0
    erros = 0

    for pessoa in publico:
        pessoa_id = pessoa.get("id")
        telefone = pessoa.get("telefone", "")

        if not telefone:
            resultados.append({
                "pessoa_id": pessoa_id,
                "telefone": "",
                "status": "erro",
                "erro": "Telefone vazio",
            })
            erros += 1
            continue

        if template_id:
            try:
                mensagem = renderizar_template(template_id, pessoa)
            except Exception as e:
                mensagem = texto_fixo or f"Erro ao renderizar template: {e}"
        else:
            mensagem = texto_fixo

        if not mensagem:
            resultados.append({
                "pessoa_id": pessoa_id,
                "telefone": telefone,
                "status": "erro",
                "erro": "Mensagem vazia (sem template e sem texto fixo)",
            })
            erros += 1
            continue

        # Envia via enviar_whatsapp.py
        try:
            proc = subprocess.run(
                [sys.executable, ENVIAR_SCRIPT, telefone, mensagem],
                capture_output=True, text=True, timeout=30,
            )
            if proc.returncode == 0:
                status_envio = "enviado"
                enviados += 1
            else:
                status_envio = "erro_envio"
                erros += 1
        except subprocess.TimeoutExpired:
            status_envio = "timeout"
            erros += 1
        except Exception as e:
            status_envio = "erro"
            erros += 1

        resultados.append({
            "pessoa_id": pessoa_id,
            "telefone": telefone,
            "status": status_envio,
            "erro": "" if status_envio == "enviado" else "Ver detalhes no Directus",
        })

        # 4. Registra no historico_broadcast
        try:
            _directus_create("historico_broadcast", {
                "comunicado_id": comunicado_id,
                "template_id": template_id,
                "destinatario": telefone,
                "status": status_envio,
                "nivel": nivel,
                "canal": "whatsapp",
                "escopo": nivel,
                "igreja_id": pessoa.get("igreja_id"),
                "data_envio": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            })
        except Exception as e:
            print(f"[Broadcast] Aviso: não foi possível registrar histórico para {telefone}: {e}")

    # 5. Atualiza comunicado
    _directus_update("comunicados", comunicado_id, {
        "status": "concluido",
        "enviado": 1,
        "total_destinos": len(publico),
        "total_entregues": enviados,
        "data_envio": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    })

    resumo = {
        "comunicado_id": comunicado_id,
        "total_destinos": len(publico),
        "total_enviados": enviados,
        "total_erros": erros,
        "detalhes": resultados,
    }

    print(f"[Broadcast] Resumo: {enviados} enviados, {erros} erros de {len(publico)} destinos")
    return resumo


# ══════════════════════════════════════════════════════════════════════════
# 4. agendar_broadcast
# ══════════════════════════════════════════════════════════════════════════

def agendar_broadcast(comunicado_id: int, data_hora: str) -> dict:
    """
    Agenda um broadcast para execução futura.

    Cria um script cron e registra no crontab do usuário.

    Args:
        comunicado_id: ID do comunicado no Directus
        data_hora: Data e hora no formato "YYYY-MM-DD HH:MM:SS"

    Returns:
        dict com informações do agendamento
    """
    try:
        dt = datetime.strptime(data_hora, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        raise ValueError(f"Formato de data inválido: '{data_hora}'. Use 'YYYY-MM-DD HH:MM:SS'")

    if dt < datetime.now():
        raise ValueError(f"Data {data_hora} já passou. Use uma data futura.")

    _directus_update("comunicados", comunicado_id, {
        "status": "agendado",
        "data_agendado": data_hora,
    })

    agendado_dir = os.path.join(SCRIPT_DIR, "agendados")
    os.makedirs(agendado_dir, exist_ok=True)

    script_path = os.path.join(agendado_dir, f"broadcast_{comunicado_id}.sh")
    log_path = os.path.join(agendado_dir, f"broadcast_{comunicado_id}.log")

    script_content = f"""#!/bin/bash
# Broadcast agendado — Comunicado #{comunicado_id}
# Agendado para: {data_hora}
# Gerado em: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

cd "{SCRIPT_DIR}"
{sys.executable} "{__file__}" enviar {comunicado_id} >> "{log_path}" 2>&1
echo "[$(date)] Broadcast #{comunicado_id} concluído" >> "{log_path}"
"""

    with open(script_path, "w") as f:
        f.write(script_content)
    os.chmod(script_path, 0o755)

    cron_cmd = f"cd {SCRIPT_DIR} && {sys.executable} {__file__} enviar {comunicado_id} >> {log_path} 2>&1"
    minuto = dt.strftime("%M")
    hora = dt.strftime("%H")
    dia = dt.strftime("%d")
    mes = dt.strftime("%m")

    cron_line = f"{minuto} {hora} {dia} {mes} * {cron_cmd}\n"

    try:
        proc_existing = subprocess.run(
            ["crontab", "-l"],
            capture_output=True, text=True, timeout=10,
        )
        existing = proc_existing.stdout if proc_existing.returncode == 0 else ""

        lines = [l for l in existing.split("\n") if f"broadcast_{comunicado_id}" not in l]
        lines.append(cron_line)

        novo_crontab = "\n".join(lines) + "\n"
        proc = subprocess.run(
            ["crontab", "-"],
            input=novo_crontab, text=True, capture_output=True, timeout=10,
        )
        if proc.returncode != 0:
            print(f"[Agendar] Aviso: crontab retornou código {proc.returncode}: {proc.stderr}")
    except Exception as e:
        print(f"[Agendar] Aviso: não foi possível configurar crontab: {e}")
        print(f"[Agendar] Para agendar manualmente, adicione ao crontab:")
        print(f"  {cron_line}")

    resultado = {
        "comunicado_id": comunicado_id,
        "data_hora": data_hora,
        "script": script_path,
        "log": log_path,
        "cron": cron_line.strip(),
        "status": "agendado",
    }

    print(f"[Agendar] Broadcast #{comunicado_id} agendado para {data_hora}")
    print(f"[Agendar] Script: {script_path}")
    return resultado


# ══════════════════════════════════════════════════════════════════════════
# CLI
# ══════════════════════════════════════════════════════════════════════════

def _cmd_get_publico(args: list[str]) -> None:
    if len(args) < 1:
        print("Uso: python3 broadcast_handler.py get_publico <nivel> [filtro_id]", file=sys.stderr)
        print("  nivel: pais, igreja, corrente", file=sys.stderr)
        sys.exit(1)

    nivel = args[0]
    filtro_id = int(args[1]) if len(args) > 1 else None

    pessoas = get_publico(nivel, filtro_id)
    print(json.dumps({
        "nivel": nivel,
        "filtro_id": filtro_id,
        "total": len(pessoas),
        "pessoas": pessoas,
    }, indent=2, ensure_ascii=False))


def _cmd_renderizar(args: list[str]) -> None:
    if len(args) < 2:
        print("Uso: python3 broadcast_handler.py renderizar <template_id> <pessoa_id>", file=sys.stderr)
        sys.exit(1)

    template_id = int(args[0])
    pessoa_id = int(args[1])

    pessoa = _directus_get_single("pessoas", pessoa_id)
    if not pessoa:
        print(f"Pessoa {pessoa_id} não encontrada", file=sys.stderr)
        sys.exit(1)

    mensagem = renderizar_template(template_id, pessoa)
    print(mensagem)


def _cmd_enviar(args: list[str]) -> None:
    if len(args) < 1:
        print("Uso: python3 broadcast_handler.py enviar <comunicado_id>", file=sys.stderr)
        sys.exit(1)

    comunicado_id = int(args[0])
    resultado = enviar_broadcast(comunicado_id)
    print(json.dumps(resultado, indent=2, ensure_ascii=False))

    if resultado.get("total_erros", 0) > 0:
        sys.exit(1)


def _cmd_agendar(args: list[str]) -> None:
    if len(args) < 2:
        print("Uso: python3 broadcast_handler.py agendar <comunicado_id> 'YYYY-MM-DD HH:MM:SS'", file=sys.stderr)
        sys.exit(1)

    comunicado_id = int(args[0])
    data_hora = args[1]

    resultado = agendar_broadcast(comunicado_id, data_hora)
    print(json.dumps(resultado, indent=2, ensure_ascii=False))


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        sys.exit(1)

    command = sys.argv[1]
    args = sys.argv[2:]

    commands = {
        "get_publico": _cmd_get_publico,
        "renderizar": _cmd_renderizar,
        "enviar": _cmd_enviar,
        "agendar": _cmd_agendar,
    }

    if command not in commands:
        print(f"Comando desconhecido: '{command}'", file=sys.stderr)
        print(f"Comandos: {', '.join(commands.keys())}", file=sys.stderr)
        sys.exit(1)

    commands[command](args)


if __name__ == "__main__":
    main()
