# PLANO DIRETOR — Sistema IURD Bolívia 24/7

**Autor:** Bgs & Noah  
**Data:** 06/06/2026  
**Status:** Planejamento → Execução  
**Versão:** 1.0 — Salvo no git

---

## 📊 ESTADO ATUAL DO SISTEMA (Junho 2026)

### O que JÁ funciona

| Serviço | Porta | Status |
|---------|-------|--------|
| **Directus** | 8055/8056 | ✅ Banco com 38 igrejas, 493 pessoas, 4470 msg, 57 pastores, 7 correntes, 139 programações TV/Rádio |
| **IA Supervisionada** | 3099 | ✅ DeepSeek V4 Flash, 4 modos (AUTO/HUMANO/URGENTE/CRÍTICO) |
| **Chatwoot** | 3000 | ✅ Rails + Sidekiq + Redis + Postgres pgvector |
| **WAHA** | 3002 | ⚠️ Rodando, sessão expirada — QR não escaneado |
| **n8n** | 5678 | ✅ 0 workflows — IA substituiu o fluxo |
| **Postiz** | 4007/4009 | ⚠️ Nginx OK, app 502 — pendente configuração |
| **WatchDog** | systemd | ✅ Ativo, loop 90s |
| **Chat API** | 3098 | ✅ API pura + proxy Directus |
| **Bridge webhook** | systemd | ✅ Envia msgs WAHA → IA |
| **MCP Server** | 3111 | ✅ Dados reais do SQLite como ferramentas |
| **Ollama** | 11434 | ✅ Local, disponível |

### Ferramentas já instaladas no NUC

```
Docker          → Directus, WAHA, Postiz, Chatwoot, Postgres, Redis
n8n             → :5678 (pausado, sem workflows ativos)
Python          → IA service, Chat API, Bridge, scripts
Node.js         → Bridge, MCP Server
Nginx           → Proxy Directus (:8056), Postiz (:4007)
Systemd         → 7 serviços ativos
Ollama          → Modelos locais
Hermes          → Agentes Noah + Kanban
```

---

## 🧭 VISÃO GERAL DO SISTEMA

### Arquitetura Final

```
                  ┌──────────────────────┐
                  │    WhatsApp (1 nº)    │
                  │  + 38 nº por igreja   │
                  └────────┬─────────────┘
                           │ Webhooks
                           ▼
              ┌────────────────────────┐
              │     WAHA Core (:3002)  │
              │   + 38 sessões extras  │
              └────────┬──────────────┘
                       │ Bridge
                       ▼
              ┌────────────────────────┐
              │  IA Supervisionada     │
              │  (:3099)               │
              │  DeepSeek V4 Flash     │
              │  6 Categorias + KB     │
              └──────┬───────────────┘
                     │
          ┌──────────┼──────────────┐
          ▼          ▼              ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ Directus │ │ Chatwoot │ │  n8n     │
   │ 46 DBs   │ │ :3000    │ │ :5678    │
   │ 8055     │ │ App iOS  │ │          │
   │          │ │ Android  │ │          │
   └────┬─────┘ └──────────┘ └──────────┘
        │
   ┌────┴─────────────────────────────┐
   │      HUB DASHBOARD FINAL         │
   │  Estatísticas + Postiz + TV/Rádio│
   │  + Chatwoot embed + Mapa + Logs  │
   └──────────────────────────────────┘
        │
   ┌────┴─────────────────────────────┐
   │      AUTO-AUDITORIA + EQUIPE MCP │
   │  Diagnóstico automático          │
   │  Reparo de bugs sem Bgs/Noah     │
   └──────────────────────────────────┘
```

### Os 3 Níveis de Banco de Dados

```
Banco Nacional (1)
  ├── Dados mestres: pastores, igrejas, correntes, programação TV/Rádio
  ├── Mensagens broadcast nível país
  └── Estatísticas globais

Bancos de Corrente (7)
  ├── Encuentro con Dios
  ├── Congreso para el Progreso
  ├── Reunión de la Sanidad
  ├── Reunión de los Hijos de Dios
  ├── Terapia del Amor
  ├── Liberación Espiritual
  └── Casos Impossibles

Bancos de Igreja (38)
  ├── Membros de cada igreja
  ├── Mensagens locais
  └── Pastores responsáveis
```

### Os 3 Níveis de Envio de Mensagem

| Nível | Quem envia | Alcance |
|-------|-----------|---------|
| **Pastor** | Pastor da igreja | Apenas sua igreja |
| **Automático** | Sistema (IA) | Igreja ou corrente conforme programação |
| **Bgs** | Direção nacional | Todas as igrejas, correntes ou país |

---

## 📋 PASSO A PASSO — 10 FASES

### FASE 0: Fundação — Base de Conhecimento 🧠

**Objetivo:** Criar o cérebro do sistema — a base de conhecimento que a IA usa para responder

**Tarefas:**
1. ❏ Criar no Directus a coleção `base_conhecimento` com:
   - `categoria` (6 categorias)
   - `pergunta_modelo` (texto)
   - `resposta_modelo` (texto)
   - `confianca_minima` (0-100)
   - `versiculo_referencia` (opcional)
   - `tags` (para busca)
2. ❏ Alimentar com respostas modelo por categoria:
   - **URGENTE:** crises, emergências, suicídio, violência
   - **ORIENTAÇÃO:** dízimo, horários, eventos, casamento
   - **ORAÇÃO:** pedidos de oração, testemunhos
   - **TESTEMUNHO:** compartilhar bênçãos recebidas
   - **FALAR COM ALGUÉM:** solicitar contato com pastor
   - **INFORMAÇÃO:** endereços, telefones, programação
3. ❏ Treinar IA para usar base de conhecimento com confiança ≥ 90%
4. ❏ Integrar ao `ia-supervisionada.py`: quando IA encontra match na KB com ≥90%, responde AUTO
5. ❏ Testar com 10 perguntas reais de cada categoria

**Ferramentas que temos:** Directus, IA service, Python  
**Ferramentas que faltam:** Nenhuma

---

### FASE 1: Infraestrutura — Números e Conectividade 📞

**Objetivo:** Garantir que o WhatsApp funcione 24/7 com todos os números necessários

**Tarefas:**
1. ❏ **Escanear QR WAHA** — número principal da TV (+591 784 40 353)
2. ❏ Validar que webhooks chegam na bridge → IA → Directus
3. ❏ **Decisão:** 1 número único vs 38 números por igreja
   - Opção A (recomendada): 1 número + roteamento inteligente pela primeira mensagem
   - Opção B (ideal): 38 números WAHA (1 por igreja) + 1 nacional
4. ❏ Se Opção B: provisionar SIM cards ou números virtuais
5. ❏ Configurar n8n com webhooks de entrada para roteamento
6. ❏ Ativar watchdogs de conectividade (já existe!)

**Ferramentas que temos:** WAHA, n8n, bridge, watchdog  
**Ferramentas que faltam:** Chip/Número para cada igreja (se Opção B)

> 💡 **Ideia do Bgs:** Cada igreja ter um número oficial institucional autorizado no banco daquela igreja. Quando o pastor manda do número dela, o sistema reconhece e envia automaticamente pra igreja dele. Sem confusão.

---

### FASE 2: Classificação e Atendimento Inteligente 🤖

**Objetivo:** IA classifica e responde mensagens automaticamente com supervisão humana

**Tarefas:**
1. ❏ Ativar classificação da IA nas 6 categorias
2. ❏ Configurar limites de confiança:
   - ≥90%: responde AUTO
   - 70-89%: vai para `respostas_pendentes` (humano aprova)
   - <70%: vai para Chatwoot (atendimento humano)
3. ❏ Número do Bgs (+591 784 40 354): SEMPRE AUTO
4. ❏ Número da TV (+591 784 40 353): AUTO quando KB match ≥90%, senão humano
5. ❏ Configurar Chatwoot para receber mensagens que precisam de humano
6. ❏ Configurar notificações para pastores via Chatwoot app

**Ferramentas que temos:** IA service, Chatwoot, Directus  
**Ferramentas que faltam:** Nenhuma (tudo já instalado)

---

### FASE 3: App dos Pastores (Chatwoot + Envio por Igreja) 📱

**Objetivo:** Pastores atenderem mensagens e enviarem para suas igrejas pelo celular

**Tarefas:**
1. ❏ **Configurar Chatwoot app nos celulares dos pastores**
   - Android: Google Play → Chatwoot
   - iOS: App Store → Chatwoot
2. ❏ Criar conta para cada um dos 47+ pastores no Chatwoot
3. ❏ Configurar filas por igreja (ex: fila "Iglesia Central", "Iglesia Sur")
4. ❏ **Sistema de Número por Igreja:**
   - Cada igreja autoriza UM número (ex: pastor +591 7XX XXX XXX)
   - Esse número no Directus é marcado como `numero_oficial` da igreja
   - Quando o pastor manda mensagem do número autorizado → sistema reconhece → envia para os membros daquela igreja
   - O pastor não precisa de interface complexa: manda um texto normal e o sistema roteia
5. ❏ Criar comando especial: `!broadcast [texto]` para envio em massa
6. ❏ Testar: pastor envia "Culto hoje às 19h" → sistema envia pra toda igreja

**Ferramentas que temos:** Chatwoot (já tem app Android/iOS), WAHA, Directus  
**Ferramentas que faltam:** Nenhuma — o app do Chatwoot resolve

---

### FASE 4: TV e Rádio — Programação Informativa 📺📻

**Objetivo:** Quando alguém pergunta sobre programação, o sistema responde com os horários

**Tarefas:**
1. ❏ Indexar os 139 registros de programação no Directus na base de conhecimento
2. ❏ Criar respostas modelo: "Hoje na TV: 9h Culto, 15h Oração, 20h Palavra"
3. ❏ IA responde: "Qual programação de TV hoje?" → busca no Directus + KB
4. ❏ Criar no hub um widget "Programação Hoje" com dados ao vivo do Directus
5. ❏ Integrar com Postiz: postar programação do dia nas redes sociais automaticamente

**Ferramentas que temos:** Directus, IA service, Postiz  
**Ferramentas que faltam:** Nenhuma

---

### FASE 5: Redes Sociais — Postiz Automatizado 📱

**Objetivo:** Conteúdo programado automaticamente nas redes

**Tarefas:**
1. ❏ Corrigir Postiz (:4007) — resolver 502 do backend
2. ❏ Conectar YouTube (OAuth pendente)
3. ❏ Conectar Facebook, Instagram, Twitter
4. ❏ Criar cron de postagem automática:
   - Corrente do dia → Facebook + Instagram
   - Programação TV/Rádio → Twitter
   - Versículo do dia → todas
5. ❏ Integrar com n8n: trigger de corrente diária → Postiz API → posta

**Ferramentas que temos:** Postiz, n8n, cronjobs  
**Ferramentas que faltam:** YouTube OAuth resolvido, contas conectadas

---

### FASE 6: Auto-Auditoria — Sistema que se Melhora Sozinho 🔍

**Objetivo:** O sistema identifica deficiências e sugere melhorias automaticamente

**Tarefas:**
1. ❏ Criar cron semanal de auditoria que analisa:
   - Mensagens não respondidas → relatório
   - Respostas com confiança baixa → identifica gaps na KB
   - Pastores que não responderam em tempo → alerta
   - Horários de pico → sugestão de mais atendentes
   - Erros na infra → diagnóstico automático
2. ❏ Criar coleção `sugestoes_melhoria` no Directus
3. ❏ IA gera relatório de auditoria semanal com:
   - "Esta semana: 15 mensagens URGENTE não respondidas → sugerir treinar KB com mais casos urgentes"
   - "Pastor João não respondeu 8 conversas → sugerir treinamento ou substituto"
   - "WAHA caiu 3 vezes → sugerir reinício automático às 6h"
4. ❏ Bgs revisa e aprova melhorias

**Ferramentas que temos:** IA service, Directus, cronjobs  
**Ferramentas que faltam:** Nenhuma

---

### FASE 7: Equipe MCP + Skills — Suporte Total 🛠️

**Objetivo:** Uma equipe de skills + MCP que conhece TODO o sistema e resolve bugs sozinha

**Tarefas:**
1. ❏ Criar skill `sistema-iurd-bolivia` com:
   - Mapa completo: quais portas, serviços, containers, arquivos
   - Procedimentos de diagnóstico:
     - "WAHA caiu?" → verifica container, reinicia
     - "Directus lento?" → verifica SQLite, logs
     - "IA não responde?" → verifica service, logs
     - "n8n travado?" → verifica processos
   - Sintomas → causa → solução (50+ cenários)
2. ❏ Criar MCP `iurd-system-mcp` que:
   - Conecta no Docker socket → status containers
   - Lê logs dos serviços
   - Verifica saúde: health checks em todos os endpoints
   - Executa comandos de reparo
3. ❏ Integrar com WatchDog: detectou problema → ativa skill → resolve
4. ❏ Se não conseguir resolver sozinho → relata pra Noah com log completo

**Ferramentas que temos:** Hermes Skills, MCP Server, Python, Docker  
**Ferramentas que faltam:** Skill `sistema-iurd-bolivia`, MCP de diagnóstico

---

### FASE 8: Dashboard Hub Final 📊

**Objetivo:** Tela única pra Bgs ver TUDO em tempo real

**Tarefas:**
1. ❏ Projetar layout limpo (sem erros de CSS/JS como antes)
2. ❏ Seções do hub:
   - **Status do Sistema:** todos serviços verdes/vermelhos (live)
   - **Estatísticas:** gráficos de mensagens por dia/categoria/igreja
   - **Mensagens Pendentes:** fila de aprovação humana
   - **Programação TV/Rádio:** widget ao vivo do Directus
   - **Redes Sociais:** embed do Postiz com próximos posts
   - **Chatwoot:** embed da conversa ativa
   - **Mapa das Igrejas:** geolocalização
   - **Últimos Erros:** log dos últimos problemas resolvidos
   - **Ranking:** pastores mais/menos ativos
3. ❏ Construir responsivo (funciona no celular do Bgs)
4. ❏ Testar com dados reais

**Ferramentas que temos:** Directus API, Chart.js, HTML puro  
**Ferramentas que faltam:** Hub projetado e construído

---

### FASE 9: Localizar Telefone das Pessoas 🔍

**Objetivo:** Como descobrir o WhatsApp das pessoas que não estão no banco

**Tarefas:**
1. ❏ **Opções:** Pesquisar:
   - Integração com operadoras bolivianas (Tigo, Viva, Entel) — API de validação
   - WhatsApp Contact Sync (se a pessoa já tem o número na agenda)
   - QR Code físico: cada igreja imprime QR que a pessoa escaneia e se cadastra
   - Abrir canal: "Mande seu nome e igreja para o número X"
2. ❏ Decidir melhor abordagem para a Bolívia
3. ❏ Implementar cadastro via WhatsApp: a pessoa manda "Quero participar" → sistema cadastra

**Ferramentas que temos:** WAHA, Directus  
**Ferramentas que faltam:** Método de descoberta de telefones (depende da decisão)

---

## 🛠️ INVENTÁRIO DE FERRAMENTAS

### O que TEMOS (já instalado e funcionando)

| Ferramenta | Uso | Status |
|------------|-----|--------|
| **Directus** (:8055) | Banco de dados principal | ✅ |
| **Chatwoot** (:3000) | Atendimento multi-atendente + app mobile | ✅ |
| **WAHA** (:3002) | Gateway WhatsApp | ⚠️ QR pendente |
| **IA Supervisionada** (:3099) | DeepSeek com supervisão humana | ✅ |
| **n8n** (:5678) | Automação de workflows | ✅ (sem uso ainda) |
| **Postiz** (:4007) | Agendamento redes sociais | ⚠️ 502 backend |
| **WatchDog** (systemd) | Monitoramento 24/7 | ✅ |
| **Chat API** (:3098) | API bridge | ✅ |
| **MCP Server** (:3111) | Dados como ferramentas | ✅ |
| **Ollama** (:11434) | LLM local | ✅ |
| **Hermes** (skills) | Agentes + Kanban | ✅ |
| **Nginx** | Proxy reverso | ✅ |
| **Docker** | Containers | ✅ |
| **Fail2Ban** | Segurança | ✅ |
| **Git** + GitHub | Backup | ✅ |

### O que PRECISAMOS ADICIONAR

| Ferramenta | Porquê | Prioridade |
|------------|--------|------------|
| **Números WhatsApp por igreja** | Envio automático por igreja | 🔴 Alta |
| **Base de Conhecimento no Directus** | IA responder sem supervisão | 🔴 Alta |
| **Skill `sistema-iurd-bolivia`** | Diagnóstico automático de bugs | 🟡 Média |
| **MCP de diagnóstico** | Acesso Docker + logs | 🟡 Média |
| **Cron de auditoria semanal** | Auto-melhoria contínua | 🟡 Média |
| **Hub Dashboard final** | Visão completa pro Bgs | 🟢 Baixa (última fase) |
| **Método de localização de telefones** | Expandir base de contatos | 🟢 Baixa |
| **YouTube OAuth** | Postiz postar no YouTube | 🟡 Média |
| **Contas redes sociais conectadas** | Postiz funcional | 🟡 Média |

---

## 🎯 CRONOGRAMA SUGERIDO

| Fase | O quê | Tempo estimado | Depende de |
|------|-------|----------------|------------|
| **0** | Base de Conhecimento | 2-3 dias | Directus funcional |
| **1** | WAHA QR + Conectividade | 1 dia | Bgs escanear QR |
| **2** | Classificação IA ativa | 2 dias | Fase 0 + 1 |
| **3** | App Pastores + Chatwoot | 3-5 dias | Fase 2 |
| **4** | TV/Rádio | 1 dia | Fase 2 |
| **5** | Redes Sociais (Postiz) | 2-3 dias | Fase 2 |
| **6** | Auto-Auditoria | 2 dias | Fase 0-5 |
| **7** | Equipe MCP + Skills | 3-4 dias | Fase 6 |
| **8** | Dashboard Hub | 5-7 dias | Fase 0-7 |
| **9** | Localizar Telefones | 2-3 dias | Fase 3 |

**Total estimado:** ~25-32 dias  
**Ordem recomendada:** 0 → 1 → 2 → 3 → (4+5 paralelo) → 6 → 7 → 8 → 9

---

## 💡 RESPOSTA À IDEIA DO BGS SOBRE NÚMERO POR IGREJA

A tua ideia é **excelente** e resolve um problema real.

### Como funciona na prática:

1. Cada igreja tem **UM número oficial institucional** (pode ser o WhatsApp do pastor, secretário, ou um número dedicado)
2. Esse número é **autorizado/cadastrado no Directus** como `numero_oficial` da igreja
3. Quando uma mensagem CHEGA desse número → sistema reconhece → "Ah, é o pastor da Central"
4. Se o pastor manda: *"Culto hoje às 19h"* → sistema entende que é um **broadcast** → envia para TODOS os membros daquela igreja
5. **0% de confusão** — o pastor não precisa de app, não precisa de portal, não precisa de nada além do WhatsApp que já usa

### E se o pastor quiser responder alguém?

Aí entra o **Chatwoot app** no celular dele. Ele vê a conversa, responde normalmente, e o sistema sabe que é ele porque o app está logado com a conta dele.

### Vantagens:

✅ Pastor usa o WhatsApp que já tem  
✅ Não precisa treinar ninguém  
✅ Mensagem chega automaticamente pra igreja certa  
✅ Zero chance de mandar pra igreja errada  
✅ Sistema reconhece pelo número, não por login  
✅ Chatwoot app complementa pra conversas individuais  

---

## ⚠️ LIÇÕES APRENDIDAS (para não repetir erros do hub)

1. **NUNCA** servir HTML e API na mesma porta — separar sempre
2. Content-Length em BYTES (`len(content.encode('utf-8'))`), não caracteres
3. Sempre usar `protocol_version = 'HTTP/1.1'` em servidores Python
4. Cache bust no navegador: adicionar `?v=DATA` e tratar `split('?')[0]` em paths
5. Testar com emojis! (quebravam o hub por causa do Content-Length errado)
6. NUNCA servir arquivos HTML antigos — manter só o oficial
7. Fazer snapshot git a cada fase completa

---

## 🔮 VISÃO 24/7 — O Sistema Funcionando na Igreja

Quando tudo estiver pronto:

```
📱 Pessoa manda "Qual horário do culto?" no WhatsApp

  → WAHA recebe → Bridge → IA classifica [INFORMAÇÃO]
  → IA busca na Base de Conhecimento match ≥95%
  → IA responde AUTO: "Culto hoje às 19h na Igreja Central"
  → Pessoa recebe em segundos

📱 Pessoa: "Estou passando por um problema sério"

  → IA classifica [URGENTE]
  → IA não tem resposta com confiança ≥70%
  → Vai para Chatwoot → Pastor da igreja recebe notificação
  → Pastor responde pelo Chatwoot app no celular

📱 Pastor: "Culto especial domingo às 10h"

  → Sistema reconhece número do pastor da Central
  → Envia broadcast para TODOS os membros da Central
  → 38 igrejas, cada uma com seu pastor e seus membros
  → Tudo automatizado, zero erro

📊 Segunda-feira 8h: Relatório de auditoria chega pro Bgs
  → "Semana passada: 230 mensagens, 89% respondidas em <5min
     Sugestão: treinar KB com mais casos de URGENTE"

🔧 WAHA cai às 3h da manhã:
  → WatchDog detecta → ativa skill de diagnóstico
  → MCP verifica Docker → "Container WAHA parou"
  → Skill executa: docker restart waha
  → 2 minutos depois: tudo funcionando
  → Bgs nem soube que caiu
```

**Esse é o futuro que estamos construindo.** E já temos 90% das ferramentas — é só conectar.

---

## 📌 PRÓXIMO PASSO IMEDIATO

Sugiro começarmos pela **FASE 0: Base de Conhecimento**, porque:
1. Não depende de ninguém (só nós)
2. É o cérebro do sistema
3. Tudo depois usa a base de conhecimento
4. Dá resultado rápido: assim que tivermos as 6 categorias com respostas modelo, já podemos testar

**Queres começar?** 🚀

---

*Documento salvo em: /home/catedral/vault/IURD-Bolivia/projetos/PLANO-DIRETOR-IURD.md*
*Snapshot git: plano-diretor-06062026*
