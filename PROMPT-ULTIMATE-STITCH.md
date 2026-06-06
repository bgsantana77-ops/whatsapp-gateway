# PROMPT ULTIMATE — Ecclesia OS Dashboard IURD Bolívia

## INSTRUÇÃO ABSOLUTA

Gere UM ÚNICO ARQUIVO HTML completo, autossuficiente, com TODO o CSS e JavaScript inline. NÃO invente dados genéricos. USE EXATAMENTE os dados fornecidos abaixo. SPA com 6 páginas. Tema escuro profissional. Responsivo.

---

## IDENTIDADE VISUAL — "Ecclesia OS Dark"

### Paleta de Cores (EXATAS):
```css
--bg-primary: #031427        /* Fundo principal */
--bg-surface: #102034        /* Cards e superfícies */
--bg-surface-low: #0b1c30    /* Superfície mais escura */
--bg-surface-high: #1b2b3f   /* Superfície mais clara */
--bg-elevated: #1e1e32       /* Modais e dropdowns */
--border-default: #2a2a3e    /* Bordas */
--border-light: #45464d      /* Bordas sutis */
--text-primary: #d3e4fe      /* Texto principal */
--text-secondary: #c6c6cd    /* Texto secundário */
--text-muted: #909097        /* Texto terciário */
--accent-blue: #0066ff       /* Azul IURD principal */
--accent-blue-hover: #0055dd
--accent-green: #00cc88      /* Sucesso, online */
--accent-red: #ff3344        /* Erro, urgente */
--accent-orange: #ff8800     /* Aviso */
--accent-purple: #8844ff     /* Oração */
--accent-pink: #ff44aa       /* Testemunho */
--accent-cyan: #00ccff       /* Informação */
--accent-yellow: #ffcc00     /* Alerta */
```

### Tipografia:
- Títulos: Manrope (Google Fonts)
- Corpo: Inter (Google Fonts)
- Dados: JetBrains Mono (Google Fonts)
- Ícones: Material Symbols Outlined (Google Fonts)

### Animações OBRIGATÓRIAS:
- fadeIn: opacity 0→1 + translateY(8px→0), 400ms ease-out
- pulse-green: box-shadow alternando para servidores online
- pulse-red: box-shadow alternando para servidores offline/ao vivo
- liveDot: opacity pulsando 2s para indicadores AO VIVO
- skeletonPulse: gradient shimmer 1.5s para loading
- toastIn: slideIn da direita, 300ms
- countUp: números animando do 0 ao valor final

---

## DADOS REAIS — USE EXATAMENTE ESTES (NÃO INVENTE)

### Igrejas (38):
```
Central, Sopocachi, La Paz — 120 membros — Pastor João Silva — +591 71234567
Sur, Calacoto, La Paz — 85 membros — Pastor Pedro Lopez — +591 72345678
Norte, Villa Fátima, La Paz — 65 membros — Pastor Lucas Mendes — +591 73456789
El Alto, Ceja, El Alto — 92 membros — Pastor Carlos Quispe — +591 74567890
Cochabamba, Quillacollo — 78 membros — Pastor Miguel Rojas — +591 75678901
Santa Cruz, Equipetrol — 110 membros — Pastor David Suarez — +591 76789012
Tarija, Centro — 45 membros — Pastor José Llanos — +591 77890123
Sucre, Centro — 52 membros — Pastor Marco Vargas — +591 78901234
Oruro, Centro — 38 membros — Pastor Pablo Mamani — +591 79012345
Potosi, Centro — 33 membros — Pastor Diego Condori — +591 70123456
Trinidad, Centro — 41 membros — Pastor Hugo Ribera — +591 71234568
Beni, Rurrenabaque — 28 membros — Pastor Samuel Cuellar — +591 72345679
Yungas, Chulumani — 35 membros — Pastor Ernesto Ticona — +591 73456780
Viacha — 30 membros — Pastor Roberto Callisaya — +591 74567891
Laja — 22 membros — Pastor Felipe Huanca — +591 75678902
Achocalla — 25 membros — Pastor Santiago Apaza — +591 76789013
Mecapaca — 18 membros — Pastor Tomás Quisbert — +591 77890124
Palca — 15 membros — Pastor Andrés Tarqui — +591 78901235
Copacabana — 20 membros — Pastor Marcos Yujra — +591 79012346
Desaguadero — 12 membros — Pastor Simón Alanoca — +591 70123457
Guaqui — 14 membros — Pastor Esteban Tintaya — +591 71234569
Patacamaya — 26 membros — Pastor Nicolás Choque — +591 72345680
Sicasica — 17 membros — Pastor Mateo Quispe — +591 73456781
Coroico — 21 membros — Pastor Daniel Mamani — +591 74567892
Caranavi — 29 membros — Pastor Benjamín Huarachi — +591 75678903
Rurrenabaque — 16 membros — Pastor Abraham Yana — +591 76789014
Guayaramerín — 19 membros — Pastor Josué Paredes — +591 77890125
Cobija — 24 membros — Pastor Isaías Vargas — +591 78901236
Villazón — 27 membros — Pastor Jeremías Flores — +591 79012347
Uyuni — 13 membros — Pastor Ezequiel Condori — +591 70123458
Camiri — 23 membros — Pastor Abdías Roca — +591 71234570
Monteagudo — 31 membros — Pastor Nehemías Balderrama — +591 72345681
Yacuiba — 36 membros — Pastor Josafat Aguirre — +591 73456782
Bermejo — 20 membros — Pastor Natanael Cruz — +591 74567893
Villa Montes — 18 membros — Pastor Abdías Moreno — +591 75678904
Warnes — 34 membros — Pastor Elías Vega — +591 76789015
Montero — 42 membros — Pastor Zacarías Ríos — +591 77890126
Puerto Suárez — 11 membros — Pastor Malaquías Cortez — +591 78901237
```

### Pastores (47 — top 10 com dados reais):
```
1. João Silva — Central — 245 enviadas, 238 respondidas, 1.2min tempo médio, 97% performance
2. Pedro Lopez — Sur — 189 enviadas, 170 respondidas, 3.8min, 90%
3. Lucas Mendes — Norte — 156 enviadas, 98 respondidas, 12.5min, 63%
4. Carlos Quispe — El Alto — 210 enviadas, 195 respondidas, 2.1min, 93%
5. Miguel Rojas — Cochabamba — 178 enviadas, 160 respondidas, 4.5min, 90%
6. David Suarez — Santa Cruz — 234 enviadas, 220 respondidas, 1.8min, 94%
7. José Llanos — Tarija — 67 enviadas, 55 respondidas, 8.2min, 82%
8. Marco Vargas — Sucre — 89 enviadas, 72 respondidas, 6.7min, 81%
9. Pablo Mamani — Oruro — 56 enviadas, 48 respondidas, 5.3min, 86%
10. Diego Condori — Potosi — 45 enviadas, 38 respondidas, 7.1min, 84%
```

### Correntes (7):
```
1. Encuentro con Dios — Cor azul (#0066ff)
2. Congreso para el Progreso — Cor verde (#00cc88)
3. Reunión de la Sanidad — Cor verde claro (#44dd99)
4. Reunión de los Hijos de Dios — Cor roxa (#8844ff)
5. Terapia del Amor — Cor rosa (#ff44aa)
6. Liberación Espiritual — Cor laranja (#ff8800)
7. Casos Impossibles — Cor vermelha (#ff3344)
```

### Programação TV (66 programas, distribuir em 7 dias, 06h-22h):
```
Domingo: 06h Oración Mañana (Encuentro con Dios), 09h Culto Dominical (Geral), 12h Palabra de Fe (Liberación Espiritual), 15h Terapia del Amor, 18h Corrente Diária (Casos Impossibles), 20h Encuentro con Dios
Segunda: 06h Oración Mañana, 09h Palabra de Fe, 12h Reunión de la Sanidad, 15h Terapia del Amor, 18h Corrente Diária (Congreso), 20h Liberación Espiritual
Terça: 06h Oración Mañana, 09h Reunión de los Hijos de Dios, 12h Palabra de Fe, 15h Terapia del Amor, 18h Corrente Diária (Sanidad), 20h Encuentro con Dios
Quarta: 06h Oración Mañana, 09h Culto Semanal, 12h Reunión de la Sanidad, 15h Terapia del Amor, 18h Corrente Diária (Hijos de Dios), 20h Casos Impossibles
Quinta: 06h Oración Mañana, 09h Palabra de Fe, 12h Liberación Espiritual, 15h Terapia del Amor, 18h Corrente Diária (Terapia), 20h Encuentro con Dios
Sexta: 06h Oración Mañana, 09h Reunión de los Hijos de Dios, 12h Palabra de Fe, 15h Terapia del Amor, 18h Corrente Diária (Liberación), 20h Liberación Espiritual
Sábado: 06h Oración Mañana, 09h Reunión de la Sanidad, 12h Palabra de Fe, 15h Terapia del Amor, 18h Corrente Diária (Encuentro), 20h Casos Impossibles
```

### Programação Rádio (73 programas, mesmo esquema, alternar com TV)

### Categorias de Mensagem:
```
URGENTE (#ff3344) — 358 mensagens (8%)
ORIENTAÇÃO (#0066ff) — 1.430 mensagens (32%)
ORAÇÃO (#8844ff) — 983 mensagens (22%)
TESTEMUNHO (#00cc88) — 536 mensagens (12%)
FALAR COM ALGUÉM (#ff8800) — 447 mensagens (10%)
INFORMAÇÃO (#00ccff) — 716 mensagens (16%)
TOTAL: 4.470 mensagens
```

### Últimas 10 mensagens (feed ao vivo):
```
1. URGENTE — Maria Silva — "Pastor, estou passando por uma situação difícil em casa..." — 2min atrás — Respondida 🤖 IA (87%)
2. INFORMAÇÃO — João Pedro — "Qual o horário do culto de domingo?" — 5min atrás — Respondida 🤖 IA (95%)
3. ORAÇÃO — Ana Costa — "Pela saúde do meu filho que está internado" — 8min atrás — Pendente ⏳
4. TESTEMUNHO — Rosa Mamani — "Deus abriu uma porta de trabalho pra mim!" — 15min atrás — Respondida 👤 Pastor
5. FALAR — Carlos Quispe — "Quero falar com um pastor urgentemente" — 22min atrás — Pendente ⏳
6. ORIENTAÇÃO — Lucia Rojas — "Como faço pra entregar o dízimo?" — 31min atrás — Respondida 🤖 IA (98%)
7. INFORMAÇÃO — Pedro Vargas — "Qual o endereço da igreja em El Alto?" — 45min atrás — Respondida 🤖 IA (92%)
8. URGENTE — Elena Flores — "Meu esposo está me ameaçando, preciso de ajuda" — 1h atrás — Pendente ⏳
9. ORAÇÃO — Miguel Rojas — "Pela cirurgia do meu pai amanhã" — 1h atrás — Respondida 🤖 IA (91%)
10. ORIENTAÇÃO — Sofia Lopez — "Tem culto hoje à noite?" — 1.5h atrás — Respondida 🤖 IA (99%)
```

### Serviços do Sistema (15):
```
1. Directus — :8055 — Online — 29d 14h
2. WAHA WhatsApp — :3002 — Online — 5h 23min
3. IA Supervisionada — :3099 — Online — 2d 14h
4. Chatwoot — :3000 — Online — 12h 45min
5. n8n Automations — :5678 — Aviso — 29d 14h (0 workflows ativos)
6. Postiz Social — :4007 — Aviso — 1d 8h (502 backend)
7. Chat API — :3098 — Online — 5d 12h
8. MCP Server — :3111 — Online — 29d 14h
9. Webhook Bridge — :3001 — Online — 5h 23min
10. WatchDog — systemd — Online — 29d 14h
11. Nginx Proxy — :80/443 — Online — 29d 14h
12. Docker Engine — — Online — 29d 14h
13. Ollama LLM — :11434 — Online — 14d 6h
14. PostgreSQL — :5432 — Online — 12h 45min
15. Redis Cache — :6379 — Online — 12h 45min
```

### Discos:
```
HD 2TB (Externo) — 3% usado (55GB/2TB) — /dados/iurd, /backups, /midia
NVMe 238GB (Interno) — 45% usado (107GB/238GB) — /, /var, /boot
Pen 256GB (Backup) — 0.1% usado (200MB/256GB) — /backups/db, /backups/env
```

### 46 Bancos de Dados:
```
38 igrejas + 7 correntes + 1 nacional = 46 DBs
Todos ativos, último backup: 06/06/2026 06:00
Próximo backup: 07/06/2026 06:00
Tamanho total: 198MB
```

### Respostas Pendentes de Aprovação:
```
Total: 898 aguardando
Aprovadas: 165
```
Incluir 3 exemplos reais com nome, texto, categoria, confiança da IA:

1. URGENTE — Maria Silva — "Pastor, estou..." — IA respondeu (87%) — [APROVAR] [EDITAR] [REJEITAR]
2. ORAÇÃO — Ana Costa — "Pela saúde..." — IA respondeu (82%) — [APROVAR] [EDITAR] [REJEITAR]  
3. URGENTE — Elena Flores — "Meu esposo..." — IA respondeu (76%) — [APROVAR] [EDITAR] [REJEITAR]

---

## ESTRUTURA DO HTML — SPA COMPLETO

```html
<body>
  <div id="preloader">Logo + "Carregando Ecclesia OS..."</div>
  <div id="toast-container"></div>
  <div id="modal-overlay"><div id="modal-content"></div></div>
  <div id="layout">
    <aside id="sidebar">...</aside>         <!-- 280px, recolhe pra 64px -->
    <main>
      <header id="topbar">...</header>      <!-- 56px, search + notificações -->
      <div id="pages">
        <section id="page-home" class="page active">...</section>
        <section id="page-tvradio" class="page">...</section>
        <section id="page-social" class="page">...</section>
        <section id="page-system" class="page">...</section>
        <section id="page-messages" class="page">...</section>
        <section id="page-config" class="page">...</section>
      </div>
    </main>
  </div>
</body>
```

---

## PÁGINA 1 — HOME (Dashboard Principal)

### 1.A — Status Bar Global (altura 40px, abaixo da topbar)
6 chips horizontais com scroll:
```
[🟢 SISTEMA • ONLINE] [🟢 WHATSAPP • CONECTADO] [🟢 IA • ATIVA]
[🟢 DB • 46/46] [📊 MSG HOJE • 127] [⏱ Última atualização: 12:34:56]
```
Chip = border-radius 20px, padding 6px 14px, bg #0b1c30, bullet colorido pulsando

### 1.B — 4 Hero Cards (grid 2x2 desktop, 1 col mobile)
Cada card com fadeIn escalonado (100ms, 200ms, 300ms, 400ms):

**Card 1 — PESSOAS:**
Ícone 👥, label "PESSOAS", número 493 (48px bold), "+12 esta semana ▲ 2.5%" (verde)

**Card 2 — MENSAGENS:**
Ícone ✉️, label "MENSAGENS", número 4.470, "+127 hoje ▲ 15%" 
Barra de progresso: "88% respondidas" — altura 4px, verde

**Card 3 — IGREJAS:**
Ícone 🏛️, label "IGREJAS", número 38
"47 pastores ativos 🟢 100% • 0 sem pastor"

**Card 4 — PENDENTES:**
Ícone ⏳, label "PENDENTES", número 898 (VERMELHO se >500)
"165 aprovados ✅ • 898 aguardando ⏳"

### 1.C — Gráfico de Mensagens 14 Dias (Chart.js)
Altura 320px, título "📈 MOVIMENTO DE MENSAGENS"

Gráfico de linhas com área preenchida (gradiente):
- Eixo X: 14 datas (24/05 a 06/06)
- 3 séries: Recebidas (azul #0066ff), Respondidas (verde #00cc88), Pendentes (vermelho #ff3344)
- Tooltip no hover, legenda clicável, toggle visibilidade

Dados EXATOS:
```
24/05: 89 rec, 72 resp, 17 pend
25/05: 134 rec, 118 resp, 16 pend
26/05: 67 rec, 55 resp, 12 pend
27/05: 198 rec, 176 resp, 22 pend
28/05: 156 rec, 140 resp, 16 pend
29/05: 45 rec, 38 resp, 7 pend
30/05: 212 rec, 190 resp, 22 pend
31/05: 178 rec, 160 resp, 18 pend
01/06: 92 rec, 78 resp, 14 pend
02/06: 145 rec, 130 resp, 15 pend
03/06: 167 rec, 149 resp, 18 pend
04/06: 88 rec, 72 resp, 16 pend
05/06: 201 rec, 185 resp, 16 pend
06/06: 127 rec, 112 resp, 15 pend
```

Três botões de período: [7 DIAS] [14 DIAS] [30 DIAS] — 14 DIAS ativo por padrão

### 1.D — Donut Chart 6 Categorias + Mini Cards
Layout 2 colunas (40% gráfico, 60% cards):

**Donut Chart (Chart.js ou canvas puro):**
- 6 segmentos com cores oficiais
- Centro: "4.470 total mensagens"
- Click no segmento: filtra feed de mensagens

**6 Mini Cards (grid 2x3):**
```
[🔴 URGENTE • 358 (8%)]     [🔵 ORIENTAÇÃO • 1.430 (32%)]
[🟣 ORAÇÃO • 983 (22%)]     [🟢 TESTEMUNHO • 536 (12%)]
[🟠 FALAR • 447 (10%)]      [🔷 INFORMAÇÃO • 716 (16%)]
```
Cada card: 4px borda esquerda na cor, barra de progresso horizontal

### 1.E — Mapa das 38 Igrejas (Leaflet + CartoDB Dark)

```html
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<link href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" rel="stylesheet"/>
```

- Centro: [-16.5, -68.15] (La Paz), zoom 8
- Tile layer: CartoDB Dark Matter (`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`)
- 38 marcadores com DIV ICON customizado:
  - Azul (#0066ff) = igreja com pastor
  - Vermelho (#ff3344) = igreja sem pastor
  - Tamanho proporcional aos membros (8px para 11, 24px para 120)
  - Glow na cor correspondente
- Cluster de marcadores quando zoom afastado
- Popup ao clicar: nome, bairro, cidade, pastor, telefone, membros, últimas mensagens
- Filtros: [TODAS (38)] [COM PASTOR (38)] [CIDADE ▼]

### 1.F — Ranking dos 47 Pastores (Tabela)

Tabela completa com colunas: #, Pastor, Igreja, ✅ Enviadas, 💬 Respondidas, ⏱ Tempo Médio, 📊 Performance, Status

- Top 3 com medalhas 🥇🥈🥉
- Performance ≥90% badge verde "Excelente", 70-89% amarelo "Bom", <70% vermelho "Atenção"
- Tempo <3min verde, 3-10min amarelo, >10min vermelho
- Status: 🟢 Online, 🟡 Ausente, 🔴 Offline
- Ordenável por coluna, busca inline, paginação 10/página
- Os 10 primeiros pastores com dados REAIS (listados acima)

### 1.G — Feed de Mensagens Ao Vivo
Altura 450px, overflow-y auto, scroll suave

Lista das 10 mensagens reais listadas acima, formato:
```
[URGENTE] Maria Silva • 2min atrás
"Pastor, estou passando por uma situação difícil..."
Resposta: 🤖 IA (87%) • Respondida ✅
---
[INFO] João Pedro • 5min atrás
"Qual o horário do culto de domingo?"
Resposta: 🤖 IA (95%) • Respondida ✅
---
```

- 4px borda esquerda na cor da categoria
- Pendente: fundo amarelado, "AGUARDANDO" pulsando
- Auto-scroll para novas mensagens

---

## PÁGINA 2 — TV/RÁDIO

### 2.A — Tabs: [📺 TV] [📻 RÁDIO] [📡 TODOS]
Tab ativa: fundo azul, texto branco

### 2.B — 3 Stats Cards:
```
Programas TV: 66 | Programas Rádio: 73 | Horas/Semana: 48h
```

### 2.C — Timeline Vertical (Programação Hoje)
- 8 itens (Domingo, 06h-22h)
- AO VIVO: bullet vermelho pulsando (animação liveDot), fundo com glow vermelho
- GRAVADO: bullet cinza
- AGENDA: bullet azul outline
- Barra de progresso para AO VIVO (ex: "38 min restantes")
- Hover: escala 1.01

### 2.D — Grade Semanal 7x12
Grid de 7 dias × 12 horários (06h-22h, a cada 2h)
- Cores por corrente (azul, rosa, roxo, verde, verde claro, laranja, vermelho)
- Célula ao vivo: borda vermelha 2px pulsando
- Célula vazia: cinza escuro com "—"
- Hover: escala 1.05, popup com detalhes do programa

### 2.E — Mini Player Flutuante
Canto inferior direito: capa + "AO VIVO" + nome do programa + controles ⏮ ⏸ ⏭

---

## PÁGINA 3 — SOCIAL (Postiz)

### 3.A — 4 Cards de Plataforma:
```
Facebook: 12 posts/sem, 1.234 reações, 🟢 Conectado
Instagram: 8 posts/sem, 892 likes, 🟡 Pendente
YouTube: 3 posts/sem, 456 views, 🔴 OAuth pendente
Twitter: 5 posts/sem, 234 retweets, 🟢 Conectado
```

### 3.B — Gráficos de Barras por Plataforma
3 gráficos (Facebook azul, Instagram verde, YouTube vermelho)
Barras animadas (crescem do 0 na carga)

### 3.C — Timeline de Posts Agendados
Próximos 10 posts com: plataforma, data, texto, thumbnail, status
Botões: ✏️ Editar, 🗑️ Excluir, 📤 Publicar Agora

### 3.D — Calendário Mensal
Grid 7×5 com bolinhas coloridas nos dias com post
Navegação: < Mês >, hoje destacado com círculo azul

### 3.E — Status de Conexão
4 ícones (FB ✅, IG ✅, YT ✅, X ⏳) com indicadores visuais

---

## PÁGINA 4 — SISTEMA

### 4.A — 15 Cards de Serviço (grid 5 colunas)
Cada card: nome, porta, status (🟢/🟡/🔴), uptime, mini métricas (CPU/RAM)
Botões: [▶ Logs] [🔄 Reiniciar]
Offline: card vermelho pulsando com overlay

### 4.B — Disco (SVG Circular + Barras)
SVG circular animado mostrando "75%" do HD 2TB
Detalhamento: cada disco com barras horizontais e pastas

### 4.C — Timeline de Eventos
10 eventos de sistema com timestamp, serviço, tipo (❌⚠️ℹ️✅), mensagem, status

### 4.D — Tabela 46 DBs
46 linhas com: Node ID (db-igreja-central, db-corrente-encuentro, etc.)
Status: todos "ACTIVE" com badge verde

---

## PÁGINA 5 — MENSAGENS

### 5.A — Filtros:
Categoria: [URGENTE] [ORIENTAÇÃO] [ORAÇÃO] [TESTEMUNHO] [FALAR] [INFO]
Status: [Pendentes] [Aprovadas] [Rejeitadas]
Busca: 🔍

### 5.B — Cards de Mensagens Pendentes
Layout 2 colunas. Cada card:
- Badge da categoria no topo
- Nome + data/hora
- Texto original (máx 4 linhas)
- Preview da resposta IA com confiança
- 3 botões grandes: [✅ APROVAR] [✏️ EDITAR] [❌ REJEITAR]

### 5.C — Modal de Aprovação
Confirma: "A mensagem será enviada para [nome] ([telefone])"
Mostra resposta completa
Botões: [✅ Confirmar Envio] [❌ Cancelar]

### 5.D — Relatório de Auto-Auditoria
Resumo: 1.247 msg, 88.4% respondidas, 11.6% não respondidas, tempo médio 4.7min
Gaps na KB: URGENTE 34 sem match, INFORMAÇÃO 12 sem match
Tendências: pico quarta 20h, pastor mais rápido João (1.2min), mais lento Marcos (47min)
5 Sugestões de melhoria

---

## PÁGINA 6 — CONFIG

### 6.A — Tabela Números por Igreja
38 linhas com: Igreja, Número, Pastor, Autorizado (✅/❌), Último uso
Busca, paginação
Modal "Autorizar Novo Número" com campos: Igreja, Número, Pastor

### 6.B — Sliders de Limiares:
- Confiança IA Auto: 90% (slider 50-100)
- Tempo Máximo Pastor: 15min (slider 5-60)
- Intervalo Broadcasts: 60min (slider 10-240)

### 6.C — Checkboxes de Notificação:
☑ Bgs se IA offline >5min
☑ Bgs se WAHA desconectar
☐ Bgs se pendentes >100
☑ Bgs se pastor não responder >30min
☐ Resumo diário 22h

---

## COMPORTAMENTO GLOBAL

### Skeleton Loading
Todos os componentes têm skeleton durante carregamento

### Toast Notifications
4 tipos: success (verde), error (vermelho), warning (laranja), info (azul)
Slide-in da direita, máximo 3 visíveis, auto-destroi

### Sistema de Modal
Overlay escuro, modal centralizado com animação scale, fecha com ESC/click fora

### Responsividade
- Desktop (>1024px): sidebar 280px, layout completo
- Tablet (480-1024px): sidebar colapsada (64px só ícones), grid 2 col
- Mobile (<480px): bottom tabs 50px, 1 coluna, gráficos simplificados

### Tratamento de Erros
Fetch falhou → toast erro + tenta novamente em 10s
API 500 → card "Indisponível" + botão "Tentar Novamente"
Offline → badge "📡 Offline" no topo

### Performance
- Debounce 300ms na busca
- IntersectionObserver para lazy render
- Cache em memória (Map) durante sessão
- requestAnimationFrame para animações

---

## CDNs OBRIGATÓRIAS (incluir no HTML):
```html
<!-- Tailwind (via CDN para estilos base) -->
<script src="https://cdn.tailwindcss.com"></script>
<!-- Google Fonts -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Manrope:wght@600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<!-- Material Symbols -->
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet">
<!-- Chart.js -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<!-- Leaflet -->
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
```

---

## INSTRUÇÃO FINAL

"NÃO invente dados. USE EXATAMENTE os números, nomes, igrejas, pastores, categorias e programações fornecidos neste prompt. Gere um ÚNICO arquivo HTML com todas as 6 páginas funcionando como SPA (navegação via hash: #home, #tvradio, #social, #system, #messages, #config). Tema escuro com a paleta fornecida. Todos os gráficos com Chart.js. Mapa com Leaflet. Responsivo. Mínimo 3000 linhas de código. VAI."
