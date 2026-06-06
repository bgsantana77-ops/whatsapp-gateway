# 🎯 Plano: Novo Hub IURD Bolivia

## ✅ OK — O que já funciona (intocado)
| Serviço | Porta | Função |
|---|---|---|
| chat-api.py | :3098 | API pura + proxy Directus |
| Directus | :8055 | Banco (38 igrejas, 7 correntes, pessoas, mensagens) |
| n8n | :5678 | Workflows (pausados) |
| Chatwoot | :3000 | Atendimento |
| Postiz | :4007 | Redes sociais |
| IA Service | :3099 | IA para correntes/broadcast |

## ✅ Backup salvo
- Git: `cleanup-06062026` (snapshot pós-limpeza)

## ❌ Eliminado
- hub-iurd.html (Apple-style, cheio de bugs)
- test-hub.html, chat-interface.html, broadcast-form.html, etc.
- 8 métodos HTML + 9 rotas no chat-api.py

## 🎯 O que o novo hub precisa
(Pendente — discutir com Bgs)

Ideias iniciais:
- Layout limpo, sem CDN, sem dependência externa
- Dados do Directus via proxy (`/directus/...`)
- Estatísticas reais (igrejas, correntes, programação)
- Embed opcional do Chatwoot e Postiz
- Responsivo (Mac, iPhone, NUC)
- Zero emoji no código HTML (evitar bug de Content-Length)

## 📋 Pendente discutir
- [ ] Funcionalidades essenciais do hub
- [ ] Layout / estilo visual
- [ ] Base de dados adicional que Bgs mencionou
- [ ] Porta ou rota que o novo hub vai ocupar
- [ ] Integrações (Chatwoot embed? Postiz? n8n?)
