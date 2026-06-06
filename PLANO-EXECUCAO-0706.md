# PLANO MESTRE DE EXECUÇÃO — 07/06/2026

## 📋 VISÃO GERAL DO SISTEMA (Mecanismos Completos)

### 🔄 FLUXO 24/7 — Como o sistema funciona do início ao fim

```
📱 PESSOA MANDA WHATSAPP
         │
         ▼
┌─────────────────────┐
│  1. WAHA CORE       │  Porta :3002 — recebe a mensagem
│  (:3002)            │  Webhook → Bridge (:3001)
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  2. BRIDGE WEBHOOK  │  Encaminha para IA Supervisionada
│  (:3001)            │  Filtra: ignora "fromMe"
└─────────┬───────────┘
          │
          ▼
┌──────────────────────────────────────────┐
│  3. IA SUPERVISIONADA                    │  Porta :3099
│     a) Classifica em 1 das 6 categorias  │  DeepSeek V4 Flash
│     b) Busca na Base de Conhecimento     │  4 modos: AUTO / HUMANO / URGENTE / CRÍTICO
│     c) Calcula confiança do match        │
│     d) Decide o que fazer:               │
│        ≥90% → Responde AUTO             │
│        70-89% → Salva pra humano         │
│        <70% → Encaminha pro Chatwoot    │
└──────────────────────────────────────────┘
          │
          ├── ✅ AUTO (≥90%) ──► WAHA envia resposta direto
          │
          ├── ⏳ HUMANO (70-89%) ──► Directus `respostas_pendentes`
          │         │                    └── Bgs/pastor aprova/rejeita/edita
          │         ▼                    └── Se aprovado → WAHA envia
          │    ┌─────────────────┐
          │    │ CHATWOOT        │  Fila de aprovação
          │    │ (:3000)         │  App Android/iOS
          │    └─────────────────┘
          │
          └── 🔴 CHATWOOT (<70%) ──► Pastor atende pelo app
                     │                    └── Responde como conversa
                     ▼
              ┌─────────────────┐
              │ PASTOR RESPONDE │  Pelo Chatwoot app no celular
              │ PELO APP        │  A resposta vai direto pro usuário
              └─────────────────┘
```

### 🚨 ESCALONAMENTO DE URGÊNCIA (MECANISMO NOVO)

```
MENSAGEM URGENTE CHEGA
         │
         ▼
┌──────────────────────────────┐
│  IA responde AUTO + notifica │  IA já responde com versículo + apoio
│  pastor imediatamente        │  Enquanto isso, notifica pastor no Chatwoot
└─────────┬────────────────────┘
          │
          ├── Pastor responde em ≤5min ──► ✅ Resolvido
          │
          ├── Pastor NÃO responde em 5min ──► 🔔 Notifica Bgs
          │         │                              └── "Pastor X não respondeu
          │         ▼                                 mensagem URGENTE em 5min"
          │    ┌──────────────────┐
          │    │ BGS NOTIFICADO   │  Pode assumir ou designar outro pastor
          │    └──────────────────┘
          │
          └── Pastor NÃO responde em 15min ──► 🚨 ALERTA CRÍTICO
                     │                              └── Notifica Bgs + Supervisor
                     ▼
              ┌──────────────────┐
              │ MODO CRÍTICO     │  IA entra em modo CRÍTICO:
              │ ATIVADO          │  - Responde com tom mais direto
              │                  │  - Oferece telefone do pastor de plantão
              │                  │  - Sugere ligação imediata
              └──────────────────┘
```

### 🔒 CONSENTIMENTO / PRIVACIDADE (Lei Boliviana)

Toda primeira mensagem de uma pessoa NOVA (não cadastrada) segue este fluxo:

```
1ª MENSAGEM DA PESSOA
         │
         ▼
┌──────────────────────────────┐
│  Pessoa não está no banco    │
│  → Primeiro contato          │
└─────────┬────────────────────┘
          │
          ▼
┌──────────────────────────────┐
│  IA RESPONDE:                │
│  "Olá! Sou o assistente      │
│  virtual da IURD Bolívia.    │
│                              │
│  Para podermos te atender,   │
│  preciso da sua autorização  │
│  para guardar seu nome e     │
│  número. Seu dados são       │
│  seguros e usados apenas     │
│  para contato da igreja.     │
│                              │
│  Você autoriza? 🙏"          │
└─────────┬────────────────────┘
          │
          ├── ✅ "Sim" ──► Cadastra no Directus → Fluxo normal
          │
          └── ❌ "Não" ──► Não cadastra → Só responde perguntas genéricas
                           (horários, endereços) sem guardar dados
```

### 📱 ENVIO DO PASTOR PARA A IGREJA (Mecanismo de Número)

```
PASTOR MANDA WHATSAPP DO NÚMERO AUTORIZADO
         │
         ▼
┌──────────────────────────────┐
│  Sistema reconhece o número  │  Directus: `igrejas.numero_oficial`
│  → Identifica qual igreja    │  Ex: +591 71234567 → Igreja Central
└─────────┬────────────────────┘
          │
          ▼
┌──────────────────────────────┐
│  IA classifica a mensagem    │
│                              │
│  Se é informativo/broadcast: │  "Culto hoje às 19h"
│  → Envia para TODOS os       │  → Broadcast para 120 membros
│    membros daquela igreja    │
│                              │
│  Se é conversa pessoal:      │  "Bom dia, irmão João"
│  → Vai para o Chatwoot       │  → Conversa privada
│    (atendimento individual)  │
└──────────────────────────────┘
```

**Como o sistema diferencia broadcast de conversa pessoal?**
- Se a IA classificar como ORIENTAÇÃO ou INFORMAÇÃO → broadcast
- Se classificar como ORAÇÃO, TESTEMUNHO ou FALAR → conversa individual
- Comando especial `!broadcast [texto]` → força broadcast
- Comando `!responder [nome] [texto]` → força conversa individual

---

## 🗂️ ARQUITETURA DOS 46 BANCOS DE DADOS

```
┌──────────────────────────────────────────────────┐
│             1 BANCO NACIONAL                     │
│  Dados mestres: igrejas, pastores, programação   │
│  TV/Rádio, templates, configurações globais       │
├──────────────────────────────────────────────────┤
│                                                    │
│  ┌──────────────────────────────────────────┐     │
│  │          38 BANCOS DE IGREJA             │     │
│  │                                          │     │
│  │  Igreja Central → membros, mensagens     │     │
│  │  Igreja Sul    → membros, mensagens      │     │
│  │  Igreja Norte  → membros, mensagens      │     │
│  │  ... (mais 35)                           │     │
│  └──────────────────────────────────────────┘     │
│                                                    │
│  ┌──────────────────────────────────────────┐     │
│  │          7 BANCOS DE CORRENTE            │     │
│  │                                          │     │
│  │  Encuentro con Dios → membros, msgs      │     │
│  │  Terapia del Amor   → membros, msgs      │     │
│  │  ... (mais 5)                            │     │
│  └──────────────────────────────────────────┘     │
└──────────────────────────────────────────────────┘
```

### Os 3 Níveis de Envio:
| Nível | Quem envia | Alcance | Exemplo |
|-------|-----------|---------|---------|
| **Pastor** | Pastor da igreja | Apenas membros da sua igreja | "Culto hoje às 19h" → 120 membros |
| **Automático** | Sistema (IA) | Igreja ou corrente específica | Corrente diária → todos da corrente |
| **Bgs** | Direção nacional | Todas as 38 igrejas ou país | Comunicado nacional → 493 pessoas |

---

## 🔧 MECANISMO DE AUTO-AUDITORIA (Como o sistema se melhora sozinho)

### A cada domingo 8h, a IA gera:

```
📊 RELATÓRIO DE AUDITORIA — [DATA]

📈 RESUMO DA SEMANA:
  • Total mensagens: X
  • Respondidas: X (X%) 
  • Não respondidas: X (X%) 🔴
  • Tempo médio: X min
  • Pastores ativos: X/Y

🔍 GAPS NA BASE DE CONHECIMENTO:
  • URGENTE: X mensagens sem match
    → Sugestão: adicionar X respostas sobre [tema]
  • INFORMAÇÃO: X perguntas sem match
    → Sugestão: adicionar respostas sobre [tema]

📈 TENDÊNCIAS:
  • Pico de mensagens: [dia] [horário]
  • Categoria mais comum: [categoria]
  • Pastor mais rápido: [nome] — [tempo]
  • Pastor mais lento: [nome] — [tempo]

💡 SUGESTÕES:
  1. Adicionar X respostas sobre [tema]
  2. Alertar Pastor X sobre tempo de resposta
  3. Criar broadcast automático [dia] [horário]
  4. [Outra sugestão]
```

### Como o relatório é gerado:
1. Cron job domingo 8h → IA consulta Directus (mensagens da semana)
2. IA analisa: gaps, tendências, pastores, erros de infra
3. IA escreve relatório e salva em `sugestoes_melhoria`
4. Relatório chega no WhatsApp do Bgs
5. Bgs aprova/rejeita as sugestões

---

## 🛠️ MECANISMO MCP + SKILLS (Equipe de Suporte Automático)

### Quando um serviço cai:

```
🐶 WATCHDOG DETECTA PROBLEMA (a cada 90 segundos)
         │
         ▼
┌──────────────────────────────┐
│  WAHA caiu?                  │
│                              │
│  1. WatchDog detecta:        │  HTTP :3002/health → 404
│     "WAHA OFFLINE"           │
│  2. Ativa skill              │  Skill `sistema-iurd-bolivia`
│     de diagnóstico           │
│  3. Skill executa:           │  docker ps | grep waha
│     "Container WAHA parou"   │  docker logs waha --tail 20
│  4. Skill executa:           │  docker restart waha
│     "WAHA reiniciado"        │
│  5. Verifica:                │  HTTP :3002/health → 200
│     "WAHA online novamente"  │
│                              │
│  ✅ RESOLVIDO EM <2min       │
│  Bgs nem soube               │
└──────────────────────────────┘
```

### Cenários cobertos pela skill `sistema-iurd-bolivia`:

| Problema | Diagnóstico | Solução | Tempo |
|----------|------------|---------|-------|
| WAHA offline | docker ps → container parou | docker restart waha | 30s |
| Directus lento | curl :8055 → timeout | docker restart directus | 1min |
| IA não responde | curl :3099/health → 404 | systemctl restart iurd360-ia | 1min |
| Chatwoot lento | curl :3000 → timeout | docker restart chatwoot | 2min |
| Postiz 502 | curl :4007 → 502 | Verificar nginx + backend | 3min |
| Disco cheio | df -h → >90% | Limpar logs antigos | 5min |
| n8n travado | curl :5678 → timeout | systemctl restart iurd360-n8n | 1min |
| Docker parado | systemctl docker → inactive | systemctl start docker | 30s |

### Se a skill NÃO conseguir resolver:
```
Skill tentou 3x e falhou → Relata pra Noah com log completo
  → "WAHA caiu às 14:23. Tentei restart 3x sem sucesso.
     Log: [....]. Preciso de ajuda."
```

---

## 🎯 DASHBOARD — ESPECIFICAÇÃO COMPLETA (6 Páginas)

### PÁGINA 1: HOME (Dashboard Principal)

**Layout:** Sidebar 280px + Topbar 56px + Conteúdo

**Seções:**
1. **Status Bar** (40px) — chips horizontais:
   - 🟢 SISTEMA ONLINE • 🟢 WHATSAPP CONECTADO • 🟢 IA ATIVA • 🟢 DB 46/46 • 📊 MSG HOJE 127 • ⏱ 12:34:56

2. **4 Hero Cards** (grid 2×2):
   - 👥 PESSOAS: 493 total, +12 esta semana
   - ✉️ MENSAGENS: 4.470 total, +127 hoje
   - 🏛️ IGREJAS: 38 ativas, 47 pastores
   - ⏳ PENDENTES: 898 aguardam, 165 aprovadas

3. **Gráfico de Mensagens 14 dias** (Chart.js linha):
   - 3 séries: Recebidas (azul), Respondidas (verde), Pendentes (vermelho)
   - Tooltip no hover, legenda clicável
   - Botões: [7 DIAS] [14 DIAS] [30 DIAS]

4. **Donut Chart 6 Categorias** (Chart.js):
   - URGENTE 🔴 8% • ORIENTAÇÃO 🔵 32% • ORAÇÃO 🟣 22%
   - TESTEMUNHO 🟢 12% • FALAR 🟠 10% • INFORMAÇÃO 🔷 16%
   - Centro: "4.470 total"
   - Click no segmento → filtra feed

5. **Mini Cards das Categorias** (grid 2×3 abaixo do donut):
   - Cada card: 4px borda esquerda na cor, nome, número, barra de progresso

6. **Mapa das 38 Igrejas** (Leaflet + CartoDB Dark):
   - Centro: La Paz [-16.5, -68.15], zoom 8
   - 38 marcadores: azul (com pastor), vermelho (sem pastor)
   - Tamanho proporcional aos membros
   - Popup: nome, pastor, telefone, membros, últimas mensagens
   - Filtros: [TODAS] [COM PASTOR] [CIDADE ▼]

7. **Ranking dos 47 Pastores** (tabela ordenável):
   - # • Pastor • Igreja • Enviadas • Respondidas • Tempo Médio • Performance • Status
   - Top 3: 🥇🥈🥉
   - Performance ≥90% verde, 70-89% amarelo, <70% vermelho
   - Tempo <3min verde, 3-10min amarelo, >10min vermelho
   - Paginação: 10/página, busca inline

8. **Feed de Mensagens Ao Vivo** (scroll 450px):
   - 10 últimas mensagens com: badge categoria, nome, preview, tempo, status
   - Pendente: fundo amarelado pulsando
   - Resposta: 🤖 IA ou 👤 Humano

### PÁGINA 2: TV/RÁDIO

**Seções:**
1. **Tabs:** [📺 TV] [📻 RÁDIO] [📡 TODOS]
2. **3 Stats Cards:** 66 TV • 73 Rádio • 48h/semana
3. **Timeline Vertical** (programação de hoje):
   - 8 horários (06h-22h)
   - AO VIVO: bullet vermelho pulsando + glow
   - GRAVADO: bullet cinza
   - AGENDA: bullet azul outline
   - Barra de progresso (se ao vivo): "38 min restantes"
4. **Grade Semanal 7×12:**
   - 7 dias × 12 horários
   - Cores por corrente (azul, rosa, roxo, verde, laranja)
   - Célula ao vivo: borda vermelha 2px pulsando
   - Hover: popup com detalhes
5. **Mini Player Flutuante:**
   - Capa + "AO VIVO" + nome do programa + controles ⏮ ⏸ ⏭
   - Dragável, minimizável, fechável

### PÁGINA 3: SOCIAL (Postiz)

**Seções:**
1. **4 Cards de Plataforma:**
   - 📘 Facebook • 📷 Instagram • 🎬 YouTube • 🐦 Twitter
   - Cada card: posts/semana, engajamento, status de conexão
2. **Gráficos de Barras por Plataforma** (Chart.js):
   - Últimos 30 dias, animados (crescem do 0)
3. **Timeline de Posts Agendados:**
   - Plataforma • Data • Texto • Thumbnail • Status
   - Botões: [✏️ Editar] [🗑️ Excluir] [📤 Publicar Agora]
4. **Calendário Mensal:**
   - Grid 7×5, bolinhas coloridas nos dias com post
   - Navegação: < Mês >, hoje destacado
5. **Status de Conexão:** 4 ícones (FB ✅, IG ✅, YT 🔴, X ⏳)

### PÁGINA 4: SISTEMA

**Seções:**
1. **15 Cards de Serviço** (grid 5 colunas):
   - Directus • WAHA • IA • Chatwoot • n8n • Postiz • Chat API • MCP • Bridge • WatchDog • Nginx • Docker • Ollama • PostgreSQL • Redis
   - Cada card: nome, porta, status (🟢/🟡/🔴), uptime, CPU/RAM
   - Botões: [▶ Logs] [🔄 Reiniciar]
   - Offline: card vermelho pulsando
2. **Disco (SVG Circular + Barras):**
   - HD 2TB: 3% • NVMe 238GB: 45% • Pen 256GB: 0.1%
   - SVG circular animado para o principal
   - Detalhamento por pasta abaixo
3. **Timeline de Eventos:** 10 eventos com timestamp, tipo, mensagem, status
4. **Tabela 46 DBs:** Node ID, status, latência, uptime
5. **Filtros:** [🟢 TODOS] [🟢 ONLINE] [🟡 AVISO] [🔴 OFFLINE]

### PÁGINA 5: MENSAGENS

**Seções:**
1. **Filtros:** Categoria (6) + Status (Pendentes/Aprovadas/Rejeitadas) + Busca
2. **Cards de Mensagens Pendentes** (2 colunas):
   - Badge categoria • Nome • Data • Texto • Preview resposta IA com confiança
   - 3 botões: [✅ APROVAR] [✏️ EDITAR] [❌ REJEITAR]
3. **Modal de Aprovação:**
   - "A mensagem será enviada para [nome] ([telefone])"
   - Mostra resposta completa
   - [✅ Confirmar Envio] [❌ Cancelar]
4. **Relatório de Auto-Auditoria:**
   - Resumo semanal, gaps na KB, tendências, 5 sugestões

### PÁGINA 6: CONFIG

**Seções:**
1. **Tabela Números por Igreja** (38 linhas):
   - Igreja • Número • Pastor • Autorizado ✅/❌ • Último uso
   - Busca, paginação, modal "Autorizar Novo Número"
2. **Sliders de Limiares:**
   - Confiança IA Auto: 90% (50-100)
   - Tempo Máximo Pastor: 15min (5-60)
   - Intervalo Broadcasts: 60min (10-240)
3. **Checkboxes de Notificação:**
   - ☑ Bgs se IA offline >5min
   - ☑ Bgs se WAHA desconectar
   - ☐ Bgs se pendentes >100
   - ☑ Bgs se pastor não responder >30min
   - ☐ Resumo diário 22h

---

## ✅ CHECKLIST DETALHADO DE HOJE

### MANHÃ

**Passo 1 — Criar coleção `base_conhecimento` no Directus**
- [ ] 1.1 Autenticar na API do Directus
- [ ] 1.2 POST /collections com nome, meta, schema
- [ ] 1.3 Criar 8 campos (id, categoria, pergunta_modelo, resposta_modelo, confianca_minima, tags, versiculo_ref, status)
- [ ] 1.4 Verificar se a coleção aparece no admin

**Passo 2 — Inserir 64 respostas modelo**
- [ ] 2.1 Inserir 10 URGENTE (confiança 70-75)
- [ ] 2.2 Inserir 15 ORIENTAÇÃO (confiança 95)
- [ ] 2.3 Inserir 10 ORAÇÃO (confiança 90)
- [ ] 2.4 Inserir 8 TESTEMUNHO (confiança 95)
- [ ] 2.5 Inserir 6 FALAR COM ALGUÉM (confiança 90-95)
- [ ] 2.6 Inserir 15 INFORMAÇÃO (confiança 95)
- [ ] 2.7 Verificar se todos os 64 registros estão no Directus

**Passo 3 — Integrar IA com a Base de Conhecimento**
- [ ] 3.1 Criar script de busca por similaridade
- [ ] 3.2 Configurar limites: ≥90 AUTO, 70-89 humano, <70 Chatwoot
- [ ] 3.3 Número Bgs: SEMPRE AUTO
- [ ] 3.4 Número TV: AUTO se ≥90, senão humano
- [ ] 3.5 Testar com 3 perguntas de cada categoria

**Passo 4 — Ativar WatchDog**
- [ ] 4.1 Verificar script: `/home/catedral/scripts/watchdog-iurd.sh`
- [ ] 4.2 `sudo systemctl enable watchdog-iurd.service`
- [ ] 4.3 `sudo systemctl start watchdog-iurd.service`
- [ ] 4.4 Verificar: `systemctl is-active watchdog-iurd.service` → "active"
- [ ] 4.5 Verificar logs: `journalctl -u watchdog-iurd.service -n 10`

### TARDE

**Passo 5 — Verificar todos os serviços**
- [ ] 5.1 Directus :8055 → curl deve retornar 200
- [ ] 5.2 WAHA :3002 → curl deve retornar 401 (auth OK)
- [ ] 5.3 IA :3099 → curl /ia/health deve retornar 200
- [ ] 5.4 Chatwoot :3000 → curl deve retornar 200
- [ ] 5.5 n8n :5678 → curl deve retornar 200
- [ ] 5.6 Postiz :4007 → diagnóstico do 502
- [ ] 5.7 Chat API :3098 → curl /health deve retornar 200
- [ ] 5.8 MCP :3111 → curl deve retornar 200
- [ ] 5.9 Bridge → systemctl is-active
- [ ] 5.10 Nginx → systemctl is-active

**Passo 6 — Atualizar inventário de ferramentas no plano**
- [ ] 6.1 WatchDog: ❌ → ⚠️ (agora vai ficar ✅)
- [ ] 6.2 Postiz: ⚠️ (mantém — 502 ainda não resolvido)
- [ ] 6.3 WAHA: ⚠️ QR pendente (mantém)

**Passo 7 — Dashboard: Unificar Stitch v1+v2**
- [ ] 7.1 Pegar design system do skill `ecclesia-os-design-system`
- [ ] 7.2 Pegar HOME do v2 (Chart.js + Leaflet + 4 KPI cards)
- [ ] 7.3 Pegar TV/Rádio do v1 (grade 7x12 + mini player)
- [ ] 7.4 Pegar SISTEMA do v1 (15 cards) + v2 (46 DBs)
- [ ] 7.5 Pegar SOCIAL do v2 (gráficos + calendário)
- [ ] 7.6 Pegar MENSAGENS do v2 (filtros + aprovação)
- [ ] 7.7 Unificar em 1 SPA com navegação via hash (#home, #tvradio, etc.)
- [ ] 7.8 Aplicar tema escuro Ecclesia OS
- [ ] 7.9 Testar navegação entre as 6 páginas
- [ ] 7.10 Testar responsivo (redimensionar janela)

**Passo 8 — Salvar tudo no git**
- [ ] 8.1 `git add -A`
- [ ] 8.2 `git commit -m "0706: fase 0 base conhecimento + dashboard + watchdog + infra"`
- [ ] 8.3 `git push origin master`
- [ ] 8.4 Backup dos 46 DBs (copiar SQLite)

---

## ⏱ CRONOGRAMA REALISTA DO DIA

| Horário | Atividade | Responsável |
|---------|-----------|-------------|
| 09:00-09:20 | Criar coleção + campos (Directus) | Noah |
| 09:20-10:20 | Inserir 64 respostas modelo | Noah |
| 10:20-10:40 | Integrar IA com Base de Conhecimento | Noah |
| 10:40-10:50 | Ativar WatchDog | Noah |
| 10:50-11:00 | ☕ Intervalo | |
| 11:00-11:15 | Verificar todos os serviços | Noah |
| 11:15-12:30 | Dashboard — estrutura base + Home + TV/Rádio | Noah |
| 12:30-13:30 | 🍽️ Almoço | |
| 13:30-15:30 | Dashboard — Sistema + Social + Mensagens + Config | Noah |
| 15:30-16:00 | Testar dashboard completo | Noah + Bgs |
| 16:00-16:15 | Ajustes finais | Noah |
| 16:15-16:30 | Git commit + push + backup | Noah |

---

**Bgs, este é o plano COMPLETO com TODOS os mecanismos que discutimos ontem.** Cada fluxo, cada regra, cada detalhe. Começo quando quiseres! 🚀
