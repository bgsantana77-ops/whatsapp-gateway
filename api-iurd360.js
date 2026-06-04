/**
 * API IURD 360 — Ponte SQLite para n8n
 * Porta: 3003
 * Schema real do banco iurd360.db
 */

const http = require('http');
const { execSync } = require('child_process');
const url = require('url');
const path = require('path');
const fs = require('fs');
const os = require('os');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = process.env.JWT_SECRET || 'iurd360_secret_key_2026';

const DB = '/home/catedral/n8n-data/iurd360.db';
const PORT = 3003;

function sql(query) {
    try {
        // Escrever SQL em arquivo temporário para evitar problemas de escaping no shell
        const tmpFile = path.join(os.tmpdir(), `iurd_${Date.now()}.sql`);
        fs.writeFileSync(tmpFile, query);

        if (query.trim().toUpperCase().startsWith('SELECT')) {
            const result = execSync(`sqlite3 -json "${DB}" < "${tmpFile}"`, { encoding: 'utf-8', timeout: 5000 });
            fs.unlinkSync(tmpFile);
            return result.trim() ? JSON.parse(result) : [];
        }
        execSync(`sqlite3 "${DB}" < "${tmpFile}"`, { encoding: 'utf-8', timeout: 5000 });
        fs.unlinkSync(tmpFile);
        return { ok: true };
    } catch (e) {
        console.error('SQL Erro:', query.substring(0, 80), e.message.substring(0, 150));
        return { error: e.message.substring(0, 200) };
    }
}

function parseBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
    });
}

const ORIGENS_PERMITIDAS = ['http://localhost:5252', 'http://localhost:3003', 'http://localhost:5678', 'http://100.85.155.54', 'http://localhost:9121'];

function getCorsOrigin(req) {
    if (req && req.headers && req.headers.origin && ORIGENS_PERMITIDAS.includes(req.headers.origin)) {
        return req.headers.origin;
    }
    return 'http://localhost:5252';
}

function json(res, data, status = 200, req = null) {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': getCorsOrigin(req) });
    res.end(JSON.stringify(data));
}

function esc(s) {
    if (s === null || s === undefined) return 'NULL';
    return String(s).replace(/'/g, "''").replace(/\\/g, "\\\\");
}

// ===== ITEM 2 ❓ FAQ =====
const FAQ = [
  { pergunta: "O que a IURD acredita", resposta: "A IURD (Igreja Universal do Reino de Deus) acredita na fé inabalável em Deus, no poder da oração e na transformação de vidas através do Espírito Santo. Sua mensagem central é que Deus tem um propósito para cada pessoa e que, através da fé, é possível superar desafios, encontrar cura, libertação e prosperidade espiritual." },
  { pergunta: "horario de culto", resposta: "Los cultos en la IURD son de lunes a sábado, con horarios variados según la iglesia. Consulte la iglesia más cercana para confirmar los horarios específicos. Generalmente: lunes a viernes 19h, sábado 10h y 18h, domingo 10h y 18h." },
  { pergunta: "como ser miembro", resposta: "Para hacerse miembro de la IURD, participe en los cultos regularmente y busque al pastor después de uno de los servicios. Él le orientará sobre los pasos, incluyendo la decisión de seguir a Cristo, el bautismo en las aguas y el compromiso con la iglesia local." },
  { pergunta: "donde queda", resposta: "¡Tenemos 38 iglesias en toda Bolivia! Para encontrar la iglesia más cercana a usted, indique su ciudad o región. Cada iglesia tiene dirección y horarios específicos." },
  { pergunta: "diezmo", resposta: "Sobre diezmos y ofrendas, la IURD enseña que son actos de fe y gratitud a Dios. El diezmo corresponde al 10% de los ingresos y es una forma de reconocer que todo viene de Dios. Las ofrendas son contribuciones voluntarias además del diezmo. Consulte al pastor de su iglesia para más orientación." },
  { pergunta: "bautismo", resposta: "El bautismo en las aguas es un paso importante de fe para aquellos que han decidido seguir a Jesús. En la IURD, el bautismo se realiza en cultos especiales. Busque al pastor de su iglesia para saber sobre las próximas fechas y prepararse espiritualmente." },
  { pergunta: "casamiento", resposta: "Para casarse en la IURD, los novios deben participar en un preparatorio con el pastor. Póngase en contacto con la iglesia más cercana para agendar una conversación con el pastor e iniciar el proceso." },
  { pergunta: "campana", resposta: "Las campañas de la IURD son períodos especiales de fe y oración enfocados en áreas específicas de la vida: salud, familia, finanzas, liberación espiritual. Cada campaña tiene un tema y una duración determinada. ¡Participe en los cultos para saber sobre la campaña actual!" },
];

// ❓ Busca no FAQ por correspondência
function buscarFAQ(mensagem) {
  const t = mensagem.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const faq of FAQ) {
    const pergunta = faq.pergunta.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const palavrasFAQ = pergunta.split(/\s+/);
    let matchCount = 0;
    for (const pw of palavrasFAQ) {
      if (pw.length > 2 && t.includes(pw)) matchCount++;
    }
    if (matchCount >= 1) {
      return faq.resposta;
    }
  }
  return null;
}

// ===== ITEM 3 🎯 REGRAS DE NEGÓCIO =====
const REGRAS = {
  agendarSeNaoSabe: true,
  sempreIncluirVersiculo: true,
  maxTentativasLLM: 2,
  tempoEsperaGateway: 5000,
  responderSoComConsentimento: true,
  horarioSilencioso: { inicio: 22, fim: 7 },
  maxMensagensPorSessao: 20,
};

// ===== ITEM 4 ⚙️ MODELO LLM CONFIG =====
const LLM_CONFIG = {
  provider: 'groq',
  model: 'deepseek-v4-flash',
  apiUrl: 'http://localhost:3001/v1/chat/completions',
  maxTokens: 500,
  temperature: 0.7,
};

// ===== ITEM 1 🤖 PROMPT ESTRUTURADO =====
function montarPrompt(mensagemOriginal) {
  const dia = new Date().toLocaleDateString('es-BO', { weekday: 'long' });
  const correntes = ['DOMINGO - DIA DEL SENOR','LUNES DE FE - Cree y recibiras!','MARTES DE LIBERACION - Libre eres','MIERCOLES DE SALUD - Sana tus heridas','JUEVES DE FAMILIA - Hogar bendecido','VIERNES DE PROSPERIDAD - Tu milagro llega','SABADO - Preparate para el domingo'];
  const versiculos = ['Este es el dia que hizo Jehova - Salmo 118:24','Todo lo que pidiereis orando, creed que lo recibireis - Marcos 11:24','Conocereis la verdad, y la verdad os hara libres - Juan 8:32','Yo soy Jehova tu sanador - Exodo 15:26','Cree en el Senor Jesucristo, y seras salvo tu y tu casa - Hechos 16:31','Jehova es mi pastor; nada me faltara - Salmo 23:1','Bendecire a Jehova en todo tiempo - Salmo 34:1'];
  const idx = new Date().getDay();
  const corrente = correntes[idx] || 'IURD Bolivia';
  const versiculo = versiculos[idx] || 'Dios te bendiga';

  return `Eres el asistente de la IURD Bolivia.

CONTEXTO ACTUAL:
- Fecha: ${dia}
- Cadena: ${corrente} - ${versiculo}
- Iglesias: 38 en toda Bolivia
- La persona escribió: "${mensajeOriginal}"

REGLAS:
1. Responde con información REAL de la base de datos
2. Incluye siempre un versículo o la cadena del día
3. Si no sabes responder, ofrece agendar con el pastor
4. Sé acogedor, tono espiritual pero natural
5. Responde SIEMPRE en español, NO uses portugués
6. Menciona la cadena del día al inicio si es posible`;
}

// ⚙️ Chama a LLM com prompt estruturado
function chamarLLM(mensagemOriginal) {
  return new Promise((resolve, reject) => {
    const prompt = montarPrompt(mensagemOriginal);
    const body = JSON.stringify({
      model: LLM_CONFIG.model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: mensagemOriginal }
      ],
      max_tokens: LLM_CONFIG.maxTokens,
      temperature: LLM_CONFIG.temperature,
    });

    const urlObj = new URL(LLM_CONFIG.apiUrl);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 15000,
    };

    let tentativas = 0;
    const tentar = () => {
      tentativas++;
      const reqHttp = http.request(options, (resHttp) => {
        let responseData = '';
        resHttp.on('data', chunk => responseData += chunk);
        resHttp.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            const content = parsed.choices?.[0]?.message?.content || '';
            if (content) resolve(content);
            else if (tentativas < REGRAS.maxTentativasLLM) tentar();
            else reject(new Error('Resposta vazia da LLM'));
          } catch (e) {
            if (tentativas < REGRAS.maxTentativasLLM) tentar();
            else reject(new Error('Falha ao parsear resposta LLM: ' + e.message));
          }
        });
      });
      reqHttp.on('error', (e) => {
        if (tentativas < REGRAS.maxTentativasLLM) tentar();
        else reject(new Error('Erro na chamada LLM: ' + e.message));
      });
      reqHttp.on('timeout', () => {
        reqHttp.destroy();
        if (tentativas < REGRAS.maxTentativasLLM) tentar();
        else reject(new Error('Timeout LLM'));
      });
      reqHttp.write(body);
      reqHttp.end();
    };
    tentar();
  });
}

// ===== GAP 1 & 2 & 3: Emergências, Memória, Alucinações =====

// 🚨 Palavras de emergência (crise/suicídio/depressão)
const PALAVRAS_CRITICO = [
    'suicídio','suicidio','suicida',
    'morrer','morir','vou morrer','voy a morir',
    'acabar com tudo','terminar con todo',
    'quitar la vida','tirar a vida',
    'nao aguento','no aguanto',
    'nao quero viver','no quiero vivir',
    'desesperado','desesperada',
    'socorro','ajuda','ayuda',
    'matar','me matar','quero morrer','me quiero morir',
    'nao vale a pena','no vale la pena',
    'cansado da vida','cansado de vivir',
];

// 🚨 Palabras de urgencia (necesita pastor pronto)
const PALAVRAS_URGENTE = [
    'urgente','urgencia','emergencia','crise','crisis',
    'preciso de ajuda','necesito ayuda','preciso de um pastor',
    'agora','imediatamente','ahora','ya',
    'desesperación','desespero','desesperacion',
    'nao sei o que fazer','no se que hacer',
    'pior dia','pior momento','no aguento mais',
];

function detectarCritico(texto) {
    const t = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return PALAVRAS_CRITICO.some(p => t.includes(p));
}

function detectarUrgente(texto) {
    const t = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return PALAVRAS_URGENTE.some(p => t.includes(p));
}

// 🎯 Classificação de sentimento da mensagem
function classificarSentimento(texto) {
    const t = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // 1. Crítico (suicídio/desespero) — MAIOR prioridade
    if (detectarCritico(t)) return { classificacao: 'urgente', sentimento: 'critico', severidade: 'crítico', prioridade: 'alta' };
    
    // 2. Urgente
    if (detectarUrgente(t)) return { classificacao: 'urgente', sentimento: 'urgente', severidade: 'alto', prioridade: 'alta' };
    
    // 3. Pedido de oração
    const oracao = ['orar','oração','oracao','orem','reza','rezar','prece','clamor','clamar','interceder',
        'pedido de oração','pedido de oracao','cadeira','cadeira de oração','cadeira da oração',
        'cura','saúde','sanidad','saude','doente','enfermo','doença','enfermedad',
        'libertação','libertacion','libertacao','libertar','livramento'];
    if (oracao.some(p => t.includes(p))) return { classificacao: 'oracao', sentimento: 'devoção', severidade: 'normal', prioridade: 'normal' };
    
    // 4. Dúvida / Pergunta
    const duvida = ['?','duvida','dúvida','pergunta','pregunta','como','qual','que','onde','quando',
        'horário','horario','endereço','endereco','dirección','direccion','culto','misa','santa ceia',
        'bíblia','biblia','versículo','versiculo'];
    if (duvida.some(p => t.includes(p)) || texto.includes('?')) return { classificacao: 'duvida', sentimento: 'neutro', severidade: 'normal', prioridade: 'normal' };
    
    // 5. Testemunho / Agradecimento
    const testemunho = ['testemunho','testimonio','milagre','milagro','graças','grazie','obrigado','obrigada',
        'agradecer','agradeço','agradezco','gratidão','gratidao','glória','gloria','aleluia','aleluyah',
        'deus é fiel','dios es fiel','consegui','lo logré','realizou','realizo'];
    if (testemunho.some(p => t.includes(p))) return { classificacao: 'testemunho', sentimento: 'gratidão', severidade: 'normal', prioridade: 'normal' };
    
    // 6. Agendamento com pastor
    const agenda = ['pastor','pastora','agendar','agenda','marcar','falar','conversar','consulta','agendar','marcar cita','cita con el pastor','hablar con pastor','necesito hablar',
        'reunião','reunion','encontro','encuentro','aconselhamento','conselho'];
    if (agenda.some(p => t.includes(p))) return { classificacao: 'agendamento', sentimento: 'interesse', severidade: 'normal', prioridade: 'normal' };
    
    // 7. Padrão — geral / boas-vindas
    return { classificacao: 'geral', sentimento: 'neutro', severidade: 'normal', prioridade: 'normal' };
}

// 🔄 Sessões em memória (últimas 5 mensagens por remetente)
const sessions = {};

function getSession(remetente) {
    if (!sessions[remetente]) {
        // Tentar recuperar do banco
        const saved = sql(`SELECT contexto FROM sessions WHERE remetente = '${esc(remetente)}' ORDER BY updated_at DESC LIMIT 1`);
        if (saved.length > 0 && saved[0].contexto) {
            try {
                sessions[remetente] = JSON.parse(saved[0].contexto);
            } catch {
                sessions[remetente] = [];
            }
        } else {
            sessions[remetente] = [];
        }
    }
    return sessions[remetente];
}

function addToSession(remetente, role, content) {
    const session = getSession(remetente);
    session.push({ role, content, timestamp: new Date().toISOString() });
    // Manter apenas últimas 5
    while (session.length > 5) session.shift();
    sessions[remetente] = session;
    // Persistir no banco
    sql(`INSERT OR REPLACE INTO sessions (remetente, contexto, updated_at) VALUES (
        '${esc(remetente)}',
        '${esc(JSON.stringify(session))}',
        datetime('now', '-4 hours')
    )`);
}

function extrairContexto(remetente) {
    const session = getSession(remetente);
    if (session.length < 2) return '';
    // Procurar cidade/igreja mencionada no histórico
    for (const msg of session) {
        const match = msg.content.match(/(?:em|en|na|no|de)\s+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇa-záéíóúâêîôûãõç]+\s*[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇa-záéíóúâêîôûãõç]*)/);
        if (match) return `Usted dijo anteriormente que estaba en ${match[1]}. `;
    }
    return '';
}

// 🎭 Validação contra banco (alucinações)
function validarContraBanco(resposta) {
    // Procurar nome de igreja na resposta
    const igrejaMatch = resposta.match(/(?:📍\s*)([^\n]+)/);
    if (!igrejaMatch) return resposta;

    const nomeIgreja = igrejaMatch[1].trim();
    const igrejas = sql(`SELECT nome, endereco, horario_culto, cidade FROM igrejas WHERE nome LIKE '%${esc(nomeIgreja)}%' LIMIT 3`);

    if (igrejas.length === 0) return resposta;

    const igreja = igrejas[0];
    const enderecoReal = igreja.endereco ? igreja.endereco.trim() : '';
    const horarioReal = igreja.horario_culto ? igreja.horario_culto.trim() : '';

    let respostaCorrigida = resposta;

    // Corrigir endereço se presente na resposta
    if (enderecoReal && resposta.includes('📍')) {
        const endLinha = `📍 ${igreja.nome}`;
        respostaCorrigida = respostaCorrigida.replace(/📍[^\n]+/, endLinha);
    }

    // Corrigir horário se presente
    if (horarioReal && resposta.includes('🕐')) {
        const horLinha = `🕐 ${horarioReal}`;
        respostaCorrigida = respostaCorrigida.replace(/🕐[^\n]+/, horLinha);
    }

    if (respostaCorrigida !== resposta) {
        respostaCorrigida += '\n\n📍 Segundo nosso banco de dados oficial';
    }

    return respostaCorrigida;
}

// 🚨 Contador de emergências (para notificação do dashboard)
let emergenciasCounter = 0;
let ultimasEmergencias = [];

function registrarEmergencia(remetente, texto, resposta) {
    emergenciasCounter++;
    ultimasEmergencias.unshift({ remetente, texto, resposta, data: new Date().toISOString() });
    if (ultimasEmergencias.length > 20) ultimasEmergencias.pop();
}

// Enviar WhatsApp via WAHA Gateway (porta 3002)
function sendWhatsApp(para, texto) {
    try {
        // Limpar formato do número
        let rawId = para.replace(/[^0-9@.]/g, '');
        // Detectar se é LID ou número real
        const isLid = rawId.includes('@lid') || (rawId.length > 15 && !rawId.startsWith('591'));
        let chatId;
        if (isLid) {
            const digits = rawId.replace(/[^0-9]/g, '');
            chatId = digits + '@lid';
        } else {
            chatId = rawId.replace(/[^0-9]/g, '');
            if (!chatId.endsWith('@c.us') && !chatId.endsWith('@g.us')) {
                chatId = chatId + '@c.us';
            }
        }
        const payload = JSON.stringify({
            session: 'default',
            chatId: chatId,
            text: texto
        });
        const cmd = `curl -s -X POST http://localhost:3002/api/sendText -H 'Content-Type: application/json' -H 'X-Api-Key: ebb0879aae964a61bd612cebd4d11b55' -d '${payload.replace(/'/g, "'\\''")}'`;
        execSync(cmd, { timeout: 10000, stdio: 'pipe' });
        console.log(`📤 WAHA enviado para ${para} (${chatId}): ${texto.substring(0, 50)}...`);
        return true;
    } catch (e) {
        console.error(`⚠️ Falha ao enviar WhatsApp para ${para}: ${e.message.substring(0, 100)}`);
        return false;
    }
}

// ===== MODO APRENDIZAGEM =====
const MODO_APRENDIZAGEM_FILE = '/home/catedral/whatsapp-gateway/modo-aprendizagem.json';

function getModoAprendizagem() {
    try {
        if (fs.existsSync(MODO_APRENDIZAGEM_FILE)) {
            return JSON.parse(fs.readFileSync(MODO_APRENDIZAGEM_FILE, 'utf-8'));
        }
    } catch (e) {
        console.error('Erro ao ler modo-aprendizagem:', e.message);
    }
    return { modo_aprendizagem: false, atualizado_em: new Date().toISOString() };
}

function setModoAprendizagem(valor) {
    const data = { modo_aprendizagem: !!valor, atualizado_em: new Date().toISOString() };
    fs.writeFileSync(MODO_APRENDIZAGEM_FILE, JSON.stringify(data, null, 2));
    return data;
}

// ===== PAINEL IA — Config de modo por classificação =====
const IA_MODE_FILE = '/home/catedral/whatsapp-gateway/ia-mode-config.json';
const DATA_INICIO_TREINO_FILE = '/home/catedral/whatsapp-gateway/data-inicio-treino.txt';

// 🗓️ Registra a data de início do treino de 15 dias
function registrarInicioTreino() {
    if (!fs.existsSync(DATA_INICIO_TREINO_FILE)) {
        fs.writeFileSync(DATA_INICIO_TREINO_FILE, new Date().toISOString());
        console.log('🗓️ Treino de 15 dias iniciado em:', new Date().toISOString());
    }
}

// 📅 Verifica se ainda está no período de treino (primeiros 15 dias)
function emPeriodoTreino() {
    try {
        if (fs.existsSync(DATA_INICIO_TREINO_FILE)) {
            const inicio = new Date(fs.readFileSync(DATA_INICIO_TREINO_FILE, 'utf-8').trim());
            const hoje = new Date();
            const dias = Math.floor((hoje - inicio) / (1000 * 60 * 60 * 24));
            return dias < 15;
        }
    } catch (e) {
        console.error('Erro ao verificar período de treino:', e.message);
    }
    // Se não tem arquivo, criar agora e entrar em treino
    registrarInicioTreino();
    return true;
}

// ⚙️ Config default: durante treino, tudo rascunho; após treino, tudo auto
function getDefaultIaMode() {
    if (emPeriodoTreino()) {
        return { modo: 'rascunho', label: 'Treino (15 dias) — Revisão humana necessária' };
    }
    return { modo: 'auto', label: 'Produção — IA responde automaticamente' };
}

// 📋 Obtém modos IA por classificação
function getIaModes() {
    try {
        if (fs.existsSync(IA_MODE_FILE)) {
            return JSON.parse(fs.readFileSync(IA_MODE_FILE, 'utf-8'));
        }
    } catch (e) {
        console.error('Erro ao ler ia-mode-config:', e.message);
    }
    // Default: todas as classificações seguem o modo geral
    const defaultMode = getDefaultIaMode();
    return {
        modo_geral: defaultMode.modo,
        label_geral: defaultMode.label,
        classificacoes: {
            oracao: defaultMode.modo,
            duvida: defaultMode.modo,
            testemunho: defaultMode.modo,
            agendamento: defaultMode.modo,
            urgente: 'rascunho', // urgência sempre precisa revisão
            geral: defaultMode.modo,
            faq: 'auto', // FAQ é sempre seguro para auto
            consentimento: 'auto', // consentimento sempre auto
        },
        atualizado_em: new Date().toISOString()
    };
}

// ⚙️ Atualiza modo de uma classificação específica
function setIaMode(classificacao, modo) {
    const config = getIaModes();
    if (classificacao === 'geral') {
        // Atualiza modo geral e todas as classificações
        config.modo_geral = modo;
        config.label_geral = modo === 'auto' ? 'Produção — IA responde automaticamente' : 'Rascunho — Revisão humana necessária';
        for (const key of Object.keys(config.classificacoes)) {
            if (key !== 'urgente' && key !== 'faq' && key !== 'consentimento') {
                config.classificacoes[key] = modo;
            }
        }
    } else if (config.classificacoes.hasOwnProperty(classificacao)) {
        config.classificacoes[classificacao] = modo;
    } else {
        return { error: `classificacao '${classificacao}' nao encontrada` };
    }
    config.atualizado_em = new Date().toISOString();
    fs.writeFileSync(IA_MODE_FILE, JSON.stringify(config, null, 2));
    return config;
}

// 🔍 Verifica se IA pode enviar resposta diretamente para uma classificação
function iaPodeEnviarDireto(classificacao) {
    const config = getIaModes();
    const modo = config.classificacoes[classificacao] || config.modo_geral || 'rascunho';
    return modo === 'auto';
}

// 🌐 Roteamento por igreja — tenta identificar igreja_id do remetente
function identificarIgreja(remetente, texto) {
    // 1. Tentar pela pessoa (telefone → pessoa_id → igreja_id)
    const pessoa = sql(`SELECT p.id, p.igreja_id, p.telefone FROM pessoas p WHERE p.telefone = '${esc(remetente)}' LIMIT 1`);
    if (pessoa.length > 0 && pessoa[0].igreja_id) {
        return { pessoa_id: pessoa[0].id, igreja_id: pessoa[0].igreja_id, origem: 'pessoa' };
    }

    // 2. Tentar pelo QR code slug no texto (formato: "Orem por mim | Catedral" ou "texto | slug")
    const parts = (texto || '').split('|');
    if (parts.length > 1) {
        const slug = parts[1].trim();
        const qrcode = sql(`SELECT q.igreja_id, q.codigo, i.nome FROM qrcodes q JOIN igrejas i ON q.igreja_id = i.id WHERE q.codigo LIKE '%${esc(slug)}%' LIMIT 1`);
        if (qrcode.length > 0) {
            // Se encontrou pessoa mas sem igreja, atualizar
            if (pessoa.length > 0) {
                sql(`UPDATE pessoas SET igreja_id = ${qrcode[0].igreja_id} WHERE id = ${pessoa[0].id}`);
            }
            return { pessoa_id: pessoa.length > 0 ? pessoa[0].id : null, igreja_id: qrcode[0].igreja_id, origem: 'qrcode', igreja_nome: qrcode[0].nome };
        }

        // 3. Tentar pelo nome da igreja diretamente
        const igreja = sql(`SELECT id, nome FROM igrejas WHERE nome LIKE '%${esc(slug)}%' LIMIT 1`);
        if (igreja.length > 0) {
            if (pessoa.length > 0) {
                sql(`UPDATE pessoas SET igreja_id = ${igreja[0].id} WHERE id = ${pessoa[0].id}`);
            }
            return { pessoa_id: pessoa.length > 0 ? pessoa[0].id : null, igreja_id: igreja[0].id, origem: 'nome_igreja', igreja_nome: igreja[0].nome };
        }
    }

    // 4. Fallback: pessoa existe mas sem igreja
    if (pessoa.length > 0) {
        return { pessoa_id: pessoa[0].id, igreja_id: null, origem: 'pessoa_sem_igreja' };
    }

    return { pessoa_id: null, igreja_id: null, origem: 'desconhecido' };
}

// Salvar resposta na tabela respostas_ia e retornar se deve enviar WhatsApp
function salvarRespostaIa(remetente, pergunta, resposta, classificacao, mensagem_id) {
    // Usar o novo sistema PAINEL IA (modo por classificação)
    const podeEnviar = iaPodeEnviarDireto(classificacao);
    const status = podeEnviar ? 'aprovado' : 'rascunho';
    const emTreino = emPeriodoTreino();

    sql(`INSERT INTO respostas_ia (mensagem_id, remetente, pergunta, resposta_gerada, resposta_final, status, agente, classificacao) VALUES (
        ${mensagem_id || 'NULL'},
        '${esc(remetente)}',
        '${esc(pergunta)}',
        '${esc(resposta)}',
        '${esc(resposta)}',
        '${status}',
        'noah',
        '${esc(classificacao)}'
    )`);

    if (emTreino) {
        console.log(`🧪 Período de TREINO (15 dias) — resposta SALVA como rascunho para ${remetente}`);
    } else if (!podeEnviar) {
        console.log(`⏸️ IA em modo RASCUNHO para '${classificacao}' — revisão humana necessária para ${remetente}`);
    } else {
        console.log(`🤖 IA em modo AUTO para '${classificacao}' — resposta ENVIADA para ${remetente}`);
    }

    return podeEnviar;
}

const server = http.createServer(async (req, res) => {
    const pathname = url.parse(req.url, true).pathname;

    if (req.method === 'OPTIONS') {
        res.writeHead(200, { 'Access-Control-Allow-Origin': getCorsOrigin(req), 'Access-Control-Allow-Methods': 'GET,POST', 'Access-Control-Allow-Headers': 'Content-Type' });
        return res.end();
    }

    try {
        // POST /contato — Registrar/atualizar contato
        // Schema: id, telefone, nome, igreja_id, origem, qr_codigo, consentimento, data_consentimento, data_primeiro_contato, data_ultimo_contato, ativo
        if (req.method === 'POST' && pathname === '/contato') {
            const d = await parseBody(req);
            if (!d.telefone) return json(res, { error: 'telefone required' }, 400);

            const existing = sql(`SELECT id, igreja_id, origem, consentimento FROM pessoas WHERE telefone = '${esc(d.telefone)}'`);

            if (existing.length > 0) {
                // Já existe — atualiza data_ultimo_contato
                sql(`UPDATE pessoas SET data_ultimo_contato = datetime('now', '-4 hours') WHERE telefone = '${esc(d.telefone)}'`);
                return json(res, { status: 'existente', id: existing[0].id, consentimento: existing[0].consentimento });
            }

            // Novo contato — descobrir igreja_id pelo nome
            let igreja_id = 'NULL';
            if (d.igreja) {
                const ig = sql(`SELECT id FROM igrejas WHERE nome LIKE '%${esc(d.igreja)}%' LIMIT 1`);
                if (ig.length > 0) igreja_id = ig[0].id;
            }

            const insert = `INSERT INTO pessoas (telefone, igreja_id, origem, qr_codigo, data_primeiro_contato, data_ultimo_contato, ativo) VALUES (
                '${esc(d.telefone)}',
                ${igreja_id},
                '${esc(d.origem || 'WHATSAPP')}',
                '${esc(d.qr_codigo || '')}',
                datetime('now', '-4 hours'),
                datetime('now', '-4 hours'),
                1
            )`;
            sql(insert);
            return json(res, { status: 'novo' });
        }

        // POST /mensagem — Salvar mensagem recebida
        // Schema: id, pessoa_id, remetente, texto, classificacao, sentimento, respondida, resposta_texto, resposta_agente, data_envio, data_resposta, tempo_resposta_seg
        if (req.method === 'POST' && pathname === '/mensagem') {
            const d = await parseBody(req);
            if (!d.remetente) return json(res, { error: 'remetente required' }, 400);

            // Buscar pessoa_id
            const pessoa = sql(`SELECT id FROM pessoas WHERE telefone = '${esc(d.remetente)}' LIMIT 1`);
            const pessoa_id = pessoa.length > 0 ? pessoa[0].id : 'NULL';

            const insert = `INSERT INTO mensagens (pessoa_id, remetente, texto, classificacao, sentimento, respondida, resposta_texto, resposta_agente, data_envio, data_resposta, tempo_resposta_seg) VALUES (
                ${pessoa_id},
                '${esc(d.remetente)}',
                '${esc(d.texto)}',
                '${esc(d.classificacao || 'geral')}',
                '${esc(d.sentimento || 'neutro')}',
                ${d.resposta_texto ? 1 : 0},
                '${esc(d.resposta_texto || '')}',
                '${esc(d.resposta_agente || 'noah')}',
                datetime('now', '-4 hours'),
                ${d.resposta_texto ? `datetime('now', '-4 hours')` : 'NULL'},
                ${d.tempo_resposta_seg !== undefined ? d.tempo_resposta_seg : 'NULL'}
            )`;
            sql(insert);

            // Atualizar data_ultimo_contato da pessoa
            sql(`UPDATE pessoas SET data_ultimo_contato = datetime('now', '-4 hours') WHERE telefone = '${esc(d.remetente)}'`);

            return json(res, { status: 'salvo' });
        }

        // GET /contato/:telefone — Buscar contato (com igreja nome)
        if (req.method === 'GET' && pathname.startsWith('/contato/')) {
            const telefone = decodeURIComponent(pathname.replace('/contato/', ''));
            const result = sql(`SELECT p.*, i.nome as igreja_nome FROM pessoas p LEFT JOIN igrejas i ON p.igreja_id = i.id WHERE p.telefone = '${esc(telefone)}'`);
            return json(res, result.length > 0 ? result[0] : { status: 'nao_encontrado' });
        }

        // POST /contato/:id/nome — Atualizar nome de um contato (renomear JIDs)
        if (req.method === 'POST' && pathname.match(/^\/contato\/\d+\/nome$/)) {
            const id = parseInt(pathname.split('/')[2]);
            const d = await parseBody(req);
            if (!d.nome || !d.nome.trim()) return json(res, { error: 'nome required' }, 400);
            sql(`UPDATE pessoas SET nome = '${esc(d.nome.trim())}' WHERE id = ${id}`);
            return json(res, { status: 'atualizado', id, nome: d.nome.trim() });
        }

        // POST /consentimento — Atualizar consentimento
        if (req.method === 'POST' && pathname === '/consentimento') {
            const d = await parseBody(req);
            if (!d.telefone) return json(res, { error: 'telefone required' }, 400);
            // Aceitar formato workflow: {telefone, acao:"opt_in"} ou {telefone, nome, acao:"opt_in"}
            if (d.consentimento === undefined && d.acao) {
                d.consentimento = d.acao === 'opt_in' || d.acao === 'consentimento_concedido';
            }
            if (d.consentimento === undefined) return json(res, { error: 'consentimento required (true/false) ou acao (opt_in)' }, 400);

            sql(`UPDATE pessoas SET consentimento = ${d.consentimento ? 1 : 0}, data_consentimento = datetime('now', '-4 hours') WHERE telefone = '${esc(d.telefone)}'`);
            return json(res, { status: 'atualizado', consentimento: !!d.consentimento });
        }

        // GET /stats — Estatísticas
        if (req.method === 'GET' && pathname === '/stats') {
            const stats = {};
            try { stats.pessoas = sql('SELECT COUNT(*) as total FROM pessoas')[0]?.total || 0; } catch { stats.pessoas = 0; }
            try { stats.mensagens = sql('SELECT COUNT(*) as total FROM mensagens')[0]?.total || 0; } catch { stats.mensagens = 0; }
            try { stats.consentimentos = sql('SELECT COUNT(*) as total FROM pessoas WHERE consentimento = 1')[0]?.total || 0; } catch { stats.consentimentos = 0; }
            try { stats.igrejas = sql('SELECT COUNT(*) as total FROM igrejas')[0]?.total || 0; } catch { stats.igrejas = 0; }
            return json(res, stats, 200, req);
        }

        // 🗓️ Versículos em espanhol baseados nas correntes reais do banco
        function getVersiculoDelDia() {
            // 📖 La Biblia de las Américas (LBLA) — traducción oficial
            const versiculosLBLA = {
                0: { cadena: 'Encuentro con Dios', ref: 'Hechos 2:4', texto: '"Todos fueron llenos del Espíritu Santo"' },
                1: { cadena: 'Congreso para el Progreso', ref: 'Marcos 11:24', texto: '"Todo lo que pidáis en oración, creed que lo habéis recibido, y os será concedido"' },
                2: { cadena: 'Reunión de Sanidad', ref: 'Juan 8:36', texto: '"Si el Hijo os hace libres, seréis realmente libres"' },
                3: { cadena: 'Hijos de Dios', ref: 'Hechos 1:8', texto: '"Recibiréis poder cuando el Espíritu Santo venga sobre vosotros"' },
                4: { cadena: 'Terapia del Amor', ref: 'Amós 3:7', texto: '"El Señor DIOS no hace nada sin revelar Su secreto a Sus siervos"' },
                5: { cadena: 'Liberación Espiritual', ref: 'Isaías 61:1', texto: '"Me ha enviado para proclamar libertad a los cautivos"' },
                6: { cadena: 'Casos Imposibles', ref: 'Salmos 127:1', texto: '"Si el SEÑOR no edifica la casa, en vano trabajan los que la edifican"' }
            };
            const hoy = new Date().getDay();
            const v = versiculosLBLA[hoy] || versiculosLBLA[0];
            return {
                cadena: v.cadena,
                texto: `📖 ${v.ref} (LBLA) — ${v.texto}`
            };
        }

        // POST /whatsapp-webhook — Bienvenida única + renovación cada 12h con nuevo versículo
        if (req.method === 'POST' && pathname === '/whatsapp-webhook') {
            const d = await parseBody(req);
            let remetente, texto;

            if (d.event === 'message' && d.payload) {
                remetente = d.payload.from || '';
                texto = d.payload.body || '';
                if (d.event === 'message.ack') return json(res, { ok: true, event: 'ack' });
            } else {
                remetente = d.remetente || '';
                texto = d.texto || '';
            }

            if (!remetente || !texto) return json(res, { error: 'remetente e texto required' }, 400);

            // Garantir que pessoa existe no banco
            let existing = sql(`SELECT id, bienvenida_enviada, ultima_resposta_em FROM pessoas WHERE telefone = '${esc(remetente)}'`);

            if (existing.length === 0) {
                // Nova pessoa — criar e enviar bienvenida
                sql(`INSERT INTO pessoas (telefone, origem, data_primeiro_contato, data_ultimo_contato, ativo, bienvenida_enviada, ultima_resposta_em) VALUES (
                    '${esc(remetente)}', 'WHATSAPP',
                    datetime('now', '-4 hours'), datetime('now', '-4 hours'), 1, 0, NULL
                )`);
                existing = sql(`SELECT id, bienvenida_enviada, ultima_resposta_em FROM pessoas WHERE telefone = '${esc(remetente)}'`);
            }

            const pessoa = existing[0];
            const pessoa_id = pessoa.id;
            const yaRecibioBienvenida = pessoa.bienvenida_enviada === 1;
            const ultimaRespuesta = pessoa.ultima_resposta_em;

            // Atualizar data_ultimo_contato
            sql(`UPDATE pessoas SET data_ultimo_contato = datetime('now', '-4 hours') WHERE id = ${pessoa_id}`);

            // Versículo do día
            const { cadena, texto: versiculoTexto } = getVersiculoDelDia();

            // Calcular horas desde última resposta
            let horasDesdeUltima = 999;
            if (ultimaRespuesta) {
                try {
                    const diff = sql(`SELECT ROUND((julianday(datetime('now', '-4 hours')) - julianday('${esc(ultimaRespuesta)}')) * 24) as horas`);
                    if (diff.length > 0 && diff[0].horas !== null) {
                        horasDesdeUltima = Number(diff[0].horas);
                    }
                } catch(e) {
                    console.log('⚠️ Erro calculando horas:', e.message);
                }
            }

            const ahora = sql("SELECT datetime('now', '-4 hours') as ahora")[0]?.ahora || new Date().toISOString();

            let resposta = '';
            let tipo = '';

            if (!yaRecibioBienvenida) {
                // 🟢 PRIMEIRA VEZ — enviar bienvenida completa com versículo do dia + canal
                // 🔒 P3: Perguntar consentimento LGPD
                resposta = '🙏 Gracias por escribirnos a IURD Bolivia.\\n\\n'
                    + 'Según la Ley de Protección de Datos Personales de Bolivia, '
                    + '¿autoriza usted recibir mensajes e información de la IURD Bolivia?\\n\\n'
                    + '1️⃣ Sí, autorizo\\n'
                    + '2️⃣ No, solo quiero oración\\n\\n'
                    + versiculoTexto;

                sql(`UPDATE pessoas SET bienvenida_enviada = 1, ultima_resposta_em = '${esc(ahora)}' WHERE id = ${pessoa_id}`);
                // Guardar que aguardamos resposta de consentimento
                sql(`INSERT OR REPLACE INTO sessions (remetente, contexto, updated_at) VALUES ('${esc(remetente)}', '{\"aguardando\":\"consentimento\"}', datetime('now', '-4 hours'))`);
                tipo = '🟢BIENVENIDA+CONSENTIMIENTO';
                console.log(`${tipo} — ${remetente}`);

            } else {
                // 🔵 JÁ RECEBEU BIENVENIDA — verificar se é resposta de consentimento
                const session = sql(`SELECT contexto FROM sessions WHERE remetente = '${esc(remetente)}' ORDER BY updated_at DESC LIMIT 1`);
                let aguardandoConsentimento = false;
                if (session.length > 0 && session[0].contexto) {
                    try {
                        const ctx = JSON.parse(session[0].contexto);
                        aguardandoConsentimento = ctx.aguardando === 'consentimento';
                    } catch(e) {}
                }

                if (aguardandoConsentimento) {
                    const textoLower = texto.toLowerCase();
                    if (textoLower.match(/^1|sim|s[ií]|autorizo|aceito|ok|si$/)) {
                        // ✅ Consentimento concedido
                        sql(`UPDATE pessoas SET consentimento = 1, data_consentimento = datetime('now', '-4 hours') WHERE id = ${pessoa_id}`);
                        sql(`INSERT INTO consentimento_log (pessoa_id, telefone, acao, metodo) VALUES (${pessoa_id}, '${esc(remetente)}', 'concedido', 'whatsapp')`);
                        sql(`DELETE FROM sessions WHERE remetente = '${esc(remetente)}'`);
                        resposta = '🙌 ¡Gracias! Ahora recibirá mensajes e información de la IURD Bolivia.\\n\\n' + versiculoTexto;
                        tipo = '✅CONSENTIMENTO_SIM';
                    } else if (textoLower.match(/^2|n[aã]o|no|solo oracion|solo oração/)) {
                        // ❌ Consentimento negado
                        sql(`UPDATE pessoas SET consentimento = 0 WHERE id = ${pessoa_id}`);
                        sql(`INSERT INTO consentimento_log (pessoa_id, telefone, acao, metodo) VALUES (${pessoa_id}, '${esc(remetente)}', 'negado', 'whatsapp')`);
                        sql(`DELETE FROM sessions WHERE remetente = '${esc(remetente)}'`);
                        resposta = '🙏 Entendido. Solo responderemos a sus mensajes de oración.\\n\\n' + versiculoTexto;
                        tipo = '❌CONSENTIMENTO_NAO';
                    } else {
                        // Ainda aguardando — reenviar pergunta
                        resposta = '🙏 Por favor, responda:\\n\\n1️⃣ Sí, autorizo recibir mensajes\\n2️⃣ No, solo quiero oración';
                        tipo = '⏳AGUARDANDO_CONSENTIMENTO';
                    }
                    } else if (horasDesdeUltima >= 12) {
                    // 🟡 RENOVACIÓN — pasaron 12h+, enviar mensaje ligero con nuevo versículo
                    const saludo = horasDesdeUltima >= 24 ? '🙏 Buenos días' : '🙏 Hola';
                    resposta = saludo + ', hemos recibido tu mensaje anterior.\n\n'
                        + '✨ Hoy: ' + versiculoTexto + '\n\n'
                        + '💙 Un pastor te responderá pronto. ¡Dios te bendiga! 🙏';

                    sql(`UPDATE pessoas SET ultima_resposta_em = '${esc(ahora)}' WHERE id = ${pessoa_id}`);
                    tipo = '🟡RENOVACION';
                    console.log(`${tipo} — ${remetente} — ${horasDesdeUltima}h desde última resposta`);
                } else {
                    // 🔵 SILENCIO — menos de 12h desde la última resposta
                    tipo = '🔵SILENCIO';
                    console.log(`${tipo} — ${remetente} — solo ${horasDesdeUltima}h desde última resposta`);
                }
            }

            // Salvar mensagem no histórico
            // Auto-resposta NÃO marca como respondida (pastor precisa ver)
            const respondida = 0;
            sql(`INSERT INTO mensagens (pessoa_id, remetente, texto, classificacao, respondida, resposta_texto, resposta_agente, data_envio, data_resposta) VALUES (
                ${pessoa_id}, '${esc(remetente)}', '${esc(texto)}', 'recibida', ${respondida},
                '${esc(resposta)}', 'noah',
                datetime('now', '-4 hours'), ${respondida ? "datetime('now', '-4 hours')" : 'NULL'}
            )`);

            if (resposta) {
                return json(res, { resposta, classificacao: tipo });
            } else {
                // 🔁 Forward para n8n (IA + aprovação humana)
                const n8nPayload = JSON.stringify({ remetente, texto, tipo, pessoa_id });
                fetch('http://localhost:5678/webhook/whatsapp-receive', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: n8nPayload
                }).catch(e => console.log('[N8N] Forward error: ' + e.message));

                return json(res, { ok: true, classificacao: tipo });
            }
        }

        // POST /enviar-resposta — Dashboard envia resposta manual (botão Responder)
        if (req.method === 'POST' && pathname === '/enviar-resposta') {
            const d = await parseBody(req);
            if (!d.remetente || !d.texto) return json(res, { error: 'remetente e texto required' }, 400);

            const enviado = sendWhatsApp(d.remetente, d.texto);

            if (d.mensagem_id) {
                sql(`UPDATE mensagens SET respondida = 1, resposta_texto = '${esc(d.texto)}', resposta_agente = 'dashboard', data_resposta = datetime('now', '-4 hours') WHERE id = ${parseInt(d.mensagem_id)}`);
            }

            return json(res, { status: enviado ? 'enviado' : 'falha', remetente: d.remetente });
        }

        // GET /healthz — Health check pro dashboard Hermes
        if (req.method === 'GET' && pathname === '/healthz') {
            return json(res, { status: 'ok', db: DB, time: new Date().toISOString() }, 200, req);
        }

        // GET /iurd360/igrejas — Lista igrejas pro dashboard
        if (req.method === 'GET' && pathname === '/iurd360/igrejas') {
            const igrejas = sql('SELECT * FROM igrejas ORDER BY nome');
            const total = igrejas.length;
            return json(res, { igrejas, total });
        }

        // GET /iurd360/estatisticas — Métricas pro dashboard
        if (req.method === 'GET' && pathname === '/iurd360/estatisticas') {
            const stats = {};
            try { stats.igrejas = sql('SELECT COUNT(*) as total FROM igrejas')[0]?.total || 0; } catch { stats.igrejas = 0; }
            try { stats.pastores = sql('SELECT COUNT(*) as total FROM pastores')[0]?.total || 0; } catch { stats.pastores = 0; }
            try { stats.pessoas = sql('SELECT COUNT(*) as total FROM pessoas')[0]?.total || 0; } catch { stats.pessoas = 0; }
            try { stats.mensagens = sql('SELECT COUNT(*) as total FROM mensagens')[0]?.total || 0; } catch { stats.mensagens = 0; }
            try { stats.consentimentos = sql('SELECT COUNT(*) as total FROM pessoas WHERE consentimento = 1')[0]?.total || 0; } catch { stats.consentimentos = 0; }
            try { stats.mensagens_hoje = sql("SELECT COUNT(*) as total FROM mensagens WHERE date(data_envio) = date('now', '-4 hours')")[0]?.total || 0; } catch { stats.mensagens_hoje = 0; }
            try { stats.pessoas_esta_semana = sql("SELECT COUNT(*) as total FROM pessoas WHERE data_primeiro_contato >= date('now', '-4 hours', '-7 days')")[0]?.total || 0; } catch { stats.pessoas_esta_semana = 0; }
            // Dados para gráficos do dashboard
            try {
                const origemRaw = sql(`SELECT COALESCE(origem, 'desconhecido') as label, COUNT(*) as valor FROM pessoas GROUP BY label ORDER BY valor DESC LIMIT 8`);
                stats.origem = Array.isArray(origemRaw) ? origemRaw : [{label: 'WhatsApp', valor: stats.pessoas}];
            } catch { stats.origem = [{label: 'WhatsApp', valor: stats.pessoas}]; }
            try {
                const diarioRaw = sql(`SELECT substr(data_envio,1,10) as label, COUNT(*) as valor FROM mensagens WHERE data_envio >= datetime('now','-4 hours','-7 days') GROUP BY label ORDER BY label ASC LIMIT 14`);
                stats.diario = Array.isArray(diarioRaw) ? diarioRaw : [];
            } catch { stats.diario = []; }
            try {
                const horarioRaw = sql(`SELECT CAST(strftime('%H', data_envio) AS INTEGER) as hora, COUNT(*) as valor FROM mensagens WHERE data_envio >= datetime('now','-4 hours','-7 days') GROUP BY hora ORDER BY hora LIMIT 24`);
                stats.horario = Array.isArray(horarioRaw) ? horarioRaw.map(h => ({label: `${String(h.hora).padStart(2,'0')}:00`, valor: h.valor})) : [];
            } catch { stats.horario = []; }
            return json(res, stats);
        }

        // GET /iurd360/programacao — Programação TV e Rádio pro dashboard
        if (req.method === 'GET' && pathname === '/iurd360/programacao') {
            const tv = sql(`SELECT * FROM programacao_tv WHERE ativo = 1 ORDER BY
                CASE dias
                    WHEN 'Domingo' THEN 0 WHEN 'Segunda' THEN 1 WHEN 'Terça' THEN 2
                    WHEN 'Quarta' THEN 3 WHEN 'Quinta' THEN 4 WHEN 'Sexta' THEN 5
                    WHEN 'Sábado' THEN 6 ELSE 7 END, horario LIMIT 50`);
            const radio = sql(`SELECT * FROM programacao_radio WHERE ativo = 1 ORDER BY
                CASE dias
                    WHEN 'Domingo' THEN 0 WHEN 'Segunda' THEN 1 WHEN 'Terça' THEN 2
                    WHEN 'Quarta' THEN 3 WHEN 'Quinta' THEN 4 WHEN 'Sexta' THEN 5
                    WHEN 'Sábado' THEN 6 ELSE 7 END, horario LIMIT 50`);
            return json(res, { tv, tv_total: tv.length, radio, radio_total: radio.length });
        }

        // GET /iurd360/mensagens — Últimas mensagens pro dashboard
        if (req.method === 'GET' && pathname === '/iurd360/mensagens') {
            const q = url.parse(req.url, true).query;
            const limite = Math.min(parseInt(q.ultimas) || 10, 50);
            const mensagens = sql(`SELECT m.*, p.telefone as contato_telefone, p.nome as contato_nome, p.igreja_id, i.nome as igreja_nome 
                FROM mensagens m 
                LEFT JOIN pessoas p ON m.pessoa_id = p.id 
                LEFT JOIN igrejas i ON p.igreja_id = i.id 
                ORDER BY m.data_envio DESC LIMIT ${limite}`);
            const total = sql('SELECT COUNT(*) as total FROM mensagens')[0]?.total || 0;
            return json(res, { mensagens, total });
        }

        // GET /iurd360/pessoas — Contatos pro dashboard
        if (req.method === 'GET' && pathname === '/iurd360/pessoas') {
            const q = url.parse(req.url, true).query;
            const limite = Math.min(parseInt(q.limite) || 50, 100);
            const pessoas = sql(`SELECT p.*, i.nome as igreja_nome, i.cidade as igreja_cidade, 
                (SELECT COUNT(*) FROM mensagens WHERE pessoa_id = p.id) as total_mensagens 
                FROM pessoas p 
                LEFT JOIN igrejas i ON p.igreja_id = i.id 
                ORDER BY p.data_ultimo_contato DESC LIMIT ${limite}`);
            const total = sql('SELECT COUNT(*) as total FROM pessoas')[0]?.total || 0;
            return json(res, { pessoas, total });
        }

        // GET /iurd360/correntes — Correntes do dia
        if (req.method === 'GET' && pathname === '/iurd360/correntes') {
            const correntes = [
                { dia: 0, nome: 'DOMINGO - DIA DEL SENOR', versiculo: 'Este es el dia que hizo Jehova - Salmo 118:24' },
                { dia: 1, nome: 'LUNES DE FE - Cree y recibiras!', versiculo: 'Todo lo que pidiereis orando, creed que lo recibireis - Marcos 11:24' },
                { dia: 2, nome: 'MARTES DE LIBERACION - Libre eres', versiculo: 'Conocereis la verdad, y la verdad os hara libres - Juan 8:32' },
                { dia: 3, nome: 'MIERCOLES DE SALUD - Sana tus heridas', versiculo: 'Yo soy Jehova tu sanador - Exodo 15:26' },
                { dia: 4, nome: 'JUEVES DE FAMILIA - Hogar bendecido', versiculo: 'Cree en el Senor Jesucristo, y seras salvo tu y tu casa - Hechos 16:31' },
                { dia: 5, nome: 'VIERNES DE PROSPERIDAD - Tu milagro llega', versiculo: 'Jehova es mi pastor; nada me faltara - Salmo 23:1' },
                { dia: 6, nome: 'SABADO - Preparate para el domingo', versiculo: 'Bendecire a Jehova en todo tiempo - Salmo 34:1' }
            ];
            const hoje = new Date().getDay();
            return json(res, { correntes, hoje, atual: correntes[hoje] });
        }

        // GET /pessoas — Lista pessoas com cidade, última mensagem, consentimento
        // Usa a view 'pessoas_com_cidade' que já existe no banco
        if (req.method === 'GET' && pathname === '/pessoas') {
            const q = url.parse(req.url, true).query;
            const { cidade, origem, consentimento, limite } = q;
            let query = `SELECT id, telefone, nome, cidade, igreja_nome, consentimento, 
               data_consentimento, data_ultimo_contato, origem, 
               substr(ultima_mensagem, 1, 100) as ultima_mensagem,
               data_ultima_mensagem, total_mensagens 
               FROM pessoas_com_cidade WHERE 1=1`;

            if (cidade) { query += ` AND cidade LIKE '%${esc(cidade)}%'`; }
            if (origem) { query += ` AND origem = '${esc(origem)}'`; }
            if (consentimento === '1') { query += ` AND consentimento = 1`; }
            if (consentimento === '0') { query += ` AND (consentimento = 0 OR consentimento IS NULL)`; }

            query += ` ORDER BY data_ultimo_contato DESC`;
            if (limite) query += ` LIMIT ${parseInt(limite)}`;

            const rows = sql(query);
            return json(res, { pessoas: rows, total: rows.length });
        }

        // GET / — Health
        if (req.method === 'GET' && (pathname === '/' || pathname === '/health')) {
            return json(res, { status: 'ok', db: DB, time: new Date().toISOString() }, 200, req);
        }

        // ===== AGENDAMENTOS COM PASTOR =====

        // POST /agendar — Criar novo agendamento
        if (req.method === 'POST' && pathname === '/agendar') {
            const d = await parseBody(req);
            if (!d.telefone) return json(res, { error: 'telefone required' }, 400);
            if (!d.data_agendada) return json(res, { error: 'data_agendada required' }, 400);
            if (!d.hora_agendada) return json(res, { error: 'hora_agendada required' }, 400);

            // Verificar se pessoa existe, criar se nao
            let pessoa = sql(`SELECT id, igreja_id FROM pessoas WHERE telefone = '${esc(d.telefone)}' LIMIT 1`);
            let pessoa_id;
            if (pessoa.length === 0) {
                sql(`INSERT INTO pessoas (telefone, origem, data_primeiro_contato, data_ultimo_contato, ativo) VALUES ('${esc(d.telefone)}', 'WHATSAPP', datetime('now', '-4 hours'), datetime('now', '-4 hours'), 1)`);
                pessoa = sql(`SELECT id FROM pessoas WHERE telefone = '${esc(d.telefone)}' LIMIT 1`);
                pessoa_id = pessoa.length > 0 ? pessoa[0].id : 'NULL';
            } else {
                pessoa_id = pessoa[0].id;
                sql(`UPDATE pessoas SET data_ultimo_contato = datetime('now', '-4 hours') WHERE id = ${pessoa_id}`);
            }

            // Usar igreja_id do request ou da pessoa
            const igreja_id = d.igreja_id || (pessoa.length > 0 && pessoa[0].igreja_id ? pessoa[0].igreja_id : 'NULL');

            // Buscar pastor da igreja
            let pastor_id = 'NULL';
            let pastor_nome = '';
            let pastor_telefone = '';
            if (igreja_id !== 'NULL') {
                const pastor = sql(`SELECT id, nome, telefone FROM pastores WHERE igreja_id = ${igreja_id} AND ativo = 1 LIMIT 1`);
                if (pastor.length > 0) {
                    pastor_id = pastor[0].id;
                    pastor_nome = pastor[0].nome;
                    pastor_telefone = pastor[0].telefone || '';
                }
            }

            sql(`INSERT INTO agendamentos (pessoa_id, pessoa_telefone, igreja_id, pastor_id, data_solicitacao, data_agendada, hora_agendada, status, motivo) VALUES (
                ${pessoa_id}, '${esc(d.telefone)}', ${igreja_id}, ${pastor_id},
                datetime('now', '-4 hours'), '${esc(d.data_agendada)}', '${esc(d.hora_agendada)}',
                'pendente', '${esc(d.motivo || '')}'
            )`);

            // Enviar confirmacao via WhatsApp
            const msgPessoa = '¡Su cita fue creada con éxito!\n\nFecha: ' + d.data_agendada + '\nHora: ' + d.hora_agendada + 'h\nPastor: ' + (pastor_nome || 'disponible') + '\n\nEsperando confirmación. ¡Nos pondremos en contacto pronto!';
            sendWhatsApp(d.telefone, msgPessoa);

            return json(res, {
                status: 'criado',
                pastor: { id: pastor_id, nome: pastor_nome, telefone: pastor_telefone }
            });
        }

        // GET /agendamentos — Listar agendamentos com filtros
        if (req.method === 'GET' && pathname === '/agendamentos') {
            const q = url.parse(req.url, true).query;
            let query = `SELECT a.*, p.nome as pessoa_nome, i.nome as igreja_nome, pr.nome as pastor_nome
                FROM agendamentos a
                LEFT JOIN pessoas p ON a.pessoa_id = p.id
                LEFT JOIN igrejas i ON a.igreja_id = i.id
                LEFT JOIN pastores pr ON a.pastor_id = pr.id
                WHERE 1=1`;

            if (q.igreja_id) query += ` AND a.igreja_id = ${parseInt(q.igreja_id)}`;
            if (q.data) query += ` AND a.data_agendada = '${esc(q.data)}'`;
            if (q.status) query += ` AND a.status = '${esc(q.status)}'`;
            if (q.telefone) query += ` AND a.pessoa_telefone LIKE '%${esc(q.telefone)}%'`;

            query += ` ORDER BY a.data_agendada ASC, a.hora_agendada ASC`;

            const limite = parseInt(q.limite) || 50;
            query += ` LIMIT ${Math.min(limite, 200)}`;

            const rows = sql(query);
            const total = sql('SELECT COUNT(*) as total FROM agendamentos')[0]?.total || 0;
            return json(res, { agendamentos: rows, total, filtrados: rows.length });
        }

        // GET /agendamentos/pendentes — Agendamentos pendentes (para pastor ver)
        if (req.method === 'GET' && pathname === '/agendamentos/pendentes') {
            const q = url.parse(req.url, true).query;
            let query = `SELECT a.*, p.nome as pessoa_nome, p.telefone as pessoa_telefone, i.nome as igreja_nome
                FROM agendamentos a
                LEFT JOIN pessoas p ON a.pessoa_id = p.id
                LEFT JOIN igrejas i ON a.igreja_id = i.id
                WHERE a.status = 'pendente'`;

            if (q.igreja_id) query += ` AND a.igreja_id = ${parseInt(q.igreja_id)}`;
            if (q.pastor_id) query += ` AND a.pastor_id = ${parseInt(q.pastor_id)}`;

            query += ` ORDER BY a.data_agendada ASC, a.hora_agendada ASC`;

            const limite = parseInt(q.limite) || 50;
            query += ` LIMIT ${Math.min(limite, 200)}`;

            const rows = sql(query);
            return json(res, { pendentes: rows, total: rows.length });
        }

        // POST /agendamentos/:id/confirmar — Confirmar agendamento
        if (req.method === 'POST' && pathname.startsWith('/agendamentos/') && pathname.endsWith('/confirmar')) {
            const id = parseInt(pathname.split('/')[2]);
            if (!id) return json(res, { error: 'id invalido' }, 400);

            const agendamento = sql(`SELECT a.*, p.nome as pessoa_nome FROM agendamentos a LEFT JOIN pessoas p ON a.pessoa_id = p.id WHERE a.id = ${id} LIMIT 1`);
            if (agendamento.length === 0) return json(res, { error: 'agendamento nao encontrado' }, 404);

            sql(`UPDATE agendamentos SET status = 'confirmado' WHERE id = ${id}`);

            // Notificar pessoa via WhatsApp
            const telefone = agendamento[0].pessoa_telefone;
            if (telefone) {
                const msg = '¡Su cita fue CONFIRMADA por el pastor!\n\nFecha: ' + agendamento[0].data_agendada + '\nHora: ' + agendamento[0].hora_agendada + 'h\n\n¡Dios bendiga su conversación!';
                sendWhatsApp(telefone, msg);
            }

            return json(res, { status: 'confirmado', agendamento: agendamento[0] });
        }

        // POST /agendamentos/:id/concluir — Marcar como realizado
        if (req.method === 'POST' && pathname.startsWith('/agendamentos/') && pathname.endsWith('/concluir')) {
            const id = parseInt(pathname.split('/')[2]);
            if (!id) return json(res, { error: 'id invalido' }, 400);

            const agendamento = sql(`SELECT * FROM agendamentos WHERE id = ${id} LIMIT 1`);
            if (agendamento.length === 0) return json(res, { error: 'agendamento nao encontrado' }, 404);

            sql(`UPDATE agendamentos SET status = 'realizado' WHERE id = ${id}`);
            return json(res, { status: 'realizado', agendamento: agendamento[0] });
        }

        // GET /qrcode-img — Servir imagem QR code por igreja_id
        if (req.method === 'GET' && pathname === '/qrcode-img') {
            const q = url.parse(req.url, true).query;
            const igreja_id = parseInt(q.id);
            if (!igreja_id) return json(res, { error: 'id required' }, 400);
            const row = sql(`SELECT caminho_arquivo FROM qrcodes_arquivos WHERE igreja_id = ${igreja_id} LIMIT 1`);
            if (row.length === 0) return json(res, { error: 'qr nao encontrado' }, 404);
            const filePath = row[0].caminho_arquivo;
            if (!fs.existsSync(filePath)) return json(res, { error: 'arquivo nao existe' }, 404);
            const img = fs.readFileSync(filePath);
            res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': img.length, 'Cache-Control': 'public, max-age=86400' });
            return res.end(img);
        }

        // GET /qrcodes — Listar QR codes de todas as igrejas
        if (req.method === 'GET' && pathname === '/qrcodes') {
            const qrcodes = sql(`SELECT qa.*, i.nome as igreja_nome, i.cidade
                FROM qrcodes_arquivos qa 
                JOIN igrejas i ON qa.igreja_id = i.id 
                ORDER BY i.nome`);
            const total = qrcodes.length;
            return json(res, { qrcodes, total });
        }

        // ===== ENDPOINTS DE CAMPANHA/BROADCAST =====

        // POST /campanha — Criar e enviar campanha
        if (req.method === 'POST' && pathname === '/campanha') {
            const d = await parseBody(req);
            if (!d.titulo) return json(res, { error: 'titulo required' }, 400);
            if (!d.texto) return json(res, { error: 'texto required' }, 400);
            if (!d.tipo) return json(res, { error: 'tipo required' }, 400);

            const igreja_id = d.igreja_id;
            const criado_por = d.criado_por || 'API';
            const data_envio = new Date().toISOString().replace('T', ' ').substring(0, 19);

            // Buscar pessoas destino (apenas com consentimento e telefone valido)
            let pessoas = [];
            if (igreja_id === 'todas' || igreja_id === undefined || igreja_id === null || igreja_id === '') {
                pessoas = sql(`SELECT id, telefone, igreja_id FROM pessoas WHERE consentimento = 1 AND telefone NOT LIKE '%@%'`);
            } else {
                const igId = parseInt(igreja_id);
                if (isNaN(igId)) return json(res, { error: 'igreja_id invalido' }, 400);
                pessoas = sql(`SELECT id, telefone, igreja_id FROM pessoas WHERE igreja_id = ${igId} AND consentimento = 1 AND telefone NOT LIKE '%@%'`);
            }

            const total_destinos = pessoas.length;
            let total_enviados = 0;
            let erros = [];

            // Enviar WhatsApp para cada pessoa
            for (const pessoa of pessoas) {
                let telefone = pessoa.telefone;
                if (!telefone.includes('@')) {
                    telefone = telefone + '@s.whatsapp.net';
                }
                const ok = sendWhatsApp(telefone, d.texto);
                if (ok) {
                    total_enviados++;
                } else {
                    erros.push({ telefone: pessoa.telefone, motivo: 'falha no envio' });
                }
            }

            // Salvar no banco
            const igreja_save = (igreja_id === 'todas' || igreja_id === undefined || igreja_id === null || igreja_id === '') ? 'NULL' : parseInt(igreja_id);
            sql(`INSERT INTO comunicados (titulo, texto, tipo, igreja_id, data_envio, data_agendado, enviado, total_destinos, total_entregues, criado_por) VALUES (
                '${esc(d.titulo)}',
                '${esc(d.texto)}',
                '${esc(d.tipo)}',
                ${igreja_save},
                '${data_envio}',
                ${d.data_agendado ? `'${esc(d.data_agendado)}'` : 'NULL'},
                1,
                ${total_destinos},
                ${total_enviados},
                '${esc(criado_por)}'
            )`);

            const comunicado = sql("SELECT MAX(id) as id FROM comunicados");
            const id_comunicado = comunicado.length > 0 ? comunicado[0].id : null;

            return json(res, {
                status: 'enviado',
                id_comunicado,
                total_destinos,
                total_enviados,
                erros: erros.length > 0 ? erros : undefined
            });
        }

        // GET /campanhas — Listar campanhas enviadas
        if (req.method === 'GET' && pathname === '/campanhas') {
            const q = url.parse(req.url, true).query;
            const limite = Math.min(parseInt(q.limite) || 20, 100);

            let query = `SELECT c.*, i.nome as igreja_nome
                FROM comunicados c
                LEFT JOIN igrejas i ON c.igreja_id = i.id
                WHERE 1=1`;

            if (q.igreja_id) {
                query += ` AND (c.igreja_id = ${parseInt(q.igreja_id)} OR c.igreja_id IS NULL)`;
            }

            query += ` ORDER BY c.data_envio DESC LIMIT ${limite}`;

            const comunicados = sql(query);
            const total = sql("SELECT COUNT(*) as total FROM comunicados")[0]?.total || 0;
            return json(res, { comunicados, total, limite });
        }

        // GET /campanhas/templates — Listar templates (correntes)
        if (req.method === 'GET' && pathname === '/campanhas/templates') {
            const correntes = sql("SELECT * FROM correntes ORDER BY dia_semana");
            const templates = correntes.map(c => {
                let horarios = c.horario;
                if (typeof horarios === 'string') {
                    try { horarios = JSON.parse(horarios); } catch { horarios = [horarios]; }
                }
                return {
                    id: c.id,
                    dia: c.dia_semana,
                    nome: c.nome,
                    descricao: c.tema || c.nome,
                    versiculo: c.versiculo,
                    horarios
                };
            });
            return json(res, { templates });
        }

        // GET /campanhas/hoje — Retornar a corrente do dia de hoje
        if (req.method === 'GET' && pathname === '/campanhas/hoje') {
            const diaSemana = new Date().getDay();
            const correntes = sql(`SELECT * FROM correntes WHERE dia_semana = ${diaSemana} LIMIT 1`);

            if (correntes.length === 0) {
                return json(res, { error: 'nenhuma corrente encontrada para hoje' }, 404);
            }

            const c = correntes[0];
            let horarios = c.horario;
            if (typeof horarios === 'string') {
                try { horarios = JSON.parse(horarios); } catch { horarios = [horarios]; }
            }

            return json(res, {
                corrente: {
                    id: c.id,
                    nome: c.nome,
                    descricao: c.tema || c.nome,
                    versiculo: c.versiculo,
                    horarios
                },
                dia_semana: diaSemana
            });
        }

        // POST /campanhas/enviar-corrente — Enviar corrente (por dia ou hoje) para igreja(s)
        if (req.method === 'POST' && pathname === '/campanhas/enviar-corrente') {
            const d = await parseBody(req);
            const diaSemana = d.dia_semana !== undefined && d.dia_semana !== null
                ? parseInt(d.dia_semana)
                : new Date().getDay();

            // Validar dia_semana (0-6)
            if (diaSemana < 0 || diaSemana > 6) {
                return json(res, { error: 'dia_semana deve ser 0 (domingo) a 6 (sabado)' }, 400);
            }

            // Buscar corrente do dia
            const correntes = sql(`SELECT * FROM correntes WHERE dia_semana = ${diaSemana} LIMIT 1`);
            if (correntes.length === 0) {
                return json(res, { error: 'nenhuma corrente encontrada para hoje' }, 404);
            }

            const corrente = correntes[0];
            const titulo = `${corrente.nome}${corrente.tema ? ' — ' + corrente.tema : ''}`;
            const texto = `🙏 *${corrente.nome}*\n\n📖 ${corrente.versiculo}\n${corrente.tema ? '\n' + corrente.tema : ''}`;

            const igreja_id = d.igreja_id;

            // Buscar pessoas destino
            let pessoas = [];
            if (igreja_id === 'todas' || igreja_id === undefined || igreja_id === null || igreja_id === '') {
                pessoas = sql(`SELECT id, telefone, igreja_id FROM pessoas WHERE consentimento = 1 AND telefone NOT LIKE '%@%'`);
            } else {
                const igId = parseInt(igreja_id);
                if (isNaN(igId)) return json(res, { error: 'igreja_id invalido' }, 400);
                pessoas = sql(`SELECT id, telefone, igreja_id FROM pessoas WHERE igreja_id = ${igId} AND consentimento = 1 AND telefone NOT LIKE '%@%'`);
            }

            const total_destinos = pessoas.length;
            let total_enviados = 0;
            let erros = [];

            // Enviar para cada pessoa
            for (const pessoa of pessoas) {
                let telefone = pessoa.telefone;
                if (!telefone.includes('@')) {
                    telefone = telefone + '@s.whatsapp.net';
                }
                const ok = sendWhatsApp(telefone, texto);
                if (ok) {
                    total_enviados++;
                } else {
                    erros.push({ telefone: pessoa.telefone, motivo: 'falha no envio' });
                }
            }

            // Salvar no banco
            const igreja_save = (igreja_id === 'todas' || igreja_id === undefined || igreja_id === null || igreja_id === '') ? 'NULL' : parseInt(igreja_id);
            const data_envio = new Date().toISOString().replace('T', ' ').substring(0, 19);

            sql(`INSERT INTO comunicados (titulo, texto, tipo, igreja_id, data_envio, enviado, total_destinos, total_entregues, criado_por) VALUES (
                '${esc(titulo)}',
                '${esc(texto)}',
                'corrente',
                ${igreja_save},
                '${data_envio}',
                1,
                ${total_destinos},
                ${total_enviados},
                'API'
            )`);

            const comunicado = sql("SELECT MAX(id) as id FROM comunicados");
            const id_comunicado = comunicado.length > 0 ? comunicado[0].id : null;

            return json(res, {
                status: 'enviado',
                id_comunicado,
                corrente: corrente.nome,
                total_destinos,
                total_enviados,
                erros: erros.length > 0 ? erros : undefined
            });
        }

        // ===== RESP0STAS IA — Painel de Auditoria =====

        // GET /respostas-ia — Listar respostas com filtros
        if (req.method === 'GET' && pathname === '/respostas-ia') {
            const q = url.parse(req.url, true).query;
            let query = `SELECT r.*, p.nome as pessoa_nome FROM respostas_ia r
                LEFT JOIN pessoas p ON r.remetente = p.telefone
                WHERE 1=1`;

            if (q.status) {
                query += ` AND r.status = '${esc(q.status)}'`;
            }
            if (q.remetente) {
                query += ` AND r.remetente LIKE '%${esc(q.remetente)}%'`;
            }

            query += ` ORDER BY r.created_at DESC`;

            const limite = Math.min(parseInt(q.limite) || 50, 200);
            query += ` LIMIT ${limite}`;

            const rows = sql(query);
            const pendentes = sql("SELECT COUNT(*) as total FROM respostas_ia WHERE status = 'rascunho'")[0]?.total || 0;
            return json(res, { respostas: rows, pendentes, total: rows.length });
        }

        // POST /respostas-ia/:id/aprovar — Aprova + envia WhatsApp
        const aprovarMatch = pathname.match(/^\/respostas-ia\/(\d+)\/aprovar$/);
        if (req.method === 'POST' && aprovarMatch) {
            const id = parseInt(aprovarMatch[1]);
            const d = await parseBody(req);
            if (!id) return json(res, { error: 'id invalido' }, 400);

            const row = sql(`SELECT * FROM respostas_ia WHERE id = ${id} LIMIT 1`);
            if (row.length === 0) return json(res, { error: 'resposta nao encontrada' }, 404);

            const resposta = row[0];
            const textoEnvio = resposta.resposta_final || resposta.resposta_gerada;
            const remetente = resposta.remetente;

            // Enviar via WhatsApp
            const enviado = sendWhatsApp(remetente, textoEnvio);

            // Atualizar status
            const revisado_por = d.revisado_por || 'dashboard';
            sql(`UPDATE respostas_ia SET status = '${enviado ? 'enviada' : 'aprovada'}', resposta_final = '${esc(textoEnvio)}', revisado_por = '${esc(revisado_por)}', updated_at = datetime('now', '-4 hours') WHERE id = ${id}`);

            return json(res, { status: enviado ? 'enviada' : 'aprovada', enviado, resposta: resposta });
        }

        // POST /respostas-ia/:id/rejeitar — Rejeita com motivo
        const rejeitarMatch = pathname.match(/^\/respostas-ia\/(\d+)\/rejeitar$/);
        if (req.method === 'POST' && rejeitarMatch) {
            const id = parseInt(rejeitarMatch[1]);
            const d = await parseBody(req);
            if (!id) return json(res, { error: 'id invalido' }, 400);

            const row = sql(`SELECT * FROM respostas_ia WHERE id = ${id} LIMIT 1`);
            if (row.length === 0) return json(res, { error: 'resposta nao encontrada' }, 404);

            const motivo = d.motivo || 'Rejeitada pelo moderador';
            const revisado_por = d.revisado_por || 'dashboard';

            sql(`UPDATE respostas_ia SET status = 'rejeitada', resposta_final = '${esc(motivo)}', revisado_por = '${esc(revisado_por)}', updated_at = datetime('now', '-4 hours') WHERE id = ${id}`);

            return json(res, { status: 'rejeitada', motivo });
        }

        // POST /respostas-ia/:id/editar — Salva edição
        const editarMatch = pathname.match(/^\/respostas-ia\/(\d+)\/editar$/);
        if (req.method === 'POST' && editarMatch) {
            const id = parseInt(editarMatch[1]);
            const d = await parseBody(req);
            if (!id) return json(res, { error: 'id invalido' }, 400);

            const novoTexto = d.resposta_final || d.resposta;
            if (!novoTexto) return json(res, { error: 'resposta_final required' }, 400);

            const row = sql(`SELECT * FROM respostas_ia WHERE id = ${id} LIMIT 1`);
            if (row.length === 0) return json(res, { error: 'resposta nao encontrada' }, 404);

            const revisado_por = d.revisado_por || 'dashboard';

            sql(`UPDATE respostas_ia SET status = 'editada', resposta_final = '${esc(novoTexto)}', revisado_por = '${esc(revisado_por)}', updated_at = datetime('now', '-4 hours') WHERE id = ${id}`);

            // Se auto_enviar=true, envia também
            if (d.auto_enviar) {
                const remetente = row[0].remetente;
                sendWhatsApp(remetente, novoTexto);
                sql(`UPDATE respostas_ia SET status = 'enviada' WHERE id = ${id}`);
            }

            return json(res, { status: d.auto_enviar ? 'enviada' : 'editada', resposta: row[0] });
        }

        // GET /modo-aprendizagem — Retorna modo atual
        if (req.method === 'GET' && pathname === '/modo-aprendizagem') {
            const modo = getModoAprendizagem();
            return json(res, modo);
        }

        // POST /modo-aprendizagem — Altera modo
        if (req.method === 'POST' && pathname === '/modo-aprendizagem') {
            const d = await parseBody(req);
            const valor = d.modo_aprendizagem !== undefined ? !!d.modo_aprendizagem : false;
            const data = setModoAprendizagem(valor);
            console.log(`🧪 Modo Aprendizagem alterado para: ${data.modo_aprendizagem ? 'ON' : 'OFF'}`);
            return json(res, data);
        }

        // GET /config-modo — Retorna conteúdo do arquivo JSON (config)
        if (req.method === 'GET' && pathname === '/config-modo') {
            const modo = getModoAprendizagem();
            return json(res, modo);
        }

        // ===== GAP 1: EMERGÊNCIAS — endpoints para o dashboard =====

        // GET /iurd360/emergencias — Retorna msgs de emergência e contador
        if (req.method === 'GET' && pathname === '/iurd360/emergencias') {
            const q = url.parse(req.url, true).query;
            const limite = Math.min(parseInt(q.limite) || 10, 50);
            const emergencias = sql(`SELECT m.*, p.nome as contato_nome, p.telefone as contato_telefone
                FROM mensagens m
                LEFT JOIN pessoas p ON m.pessoa_id = p.id
                WHERE m.classificacao = 'emergencia'
                ORDER BY m.data_envio DESC LIMIT ${limite}`);
            const total = sql("SELECT COUNT(*) as total FROM mensagens WHERE classificacao = 'emergencia'")[0]?.total || 0;
            return json(res, {
                emergencias,
                total,
                alertas_recentes: ultimasEmergencias,
                contador: emergenciasCounter
            });
        }

        // POST /iurd360/emergencias/limpar — Zera contador (dashboard já viu)
        if (req.method === 'POST' && pathname === '/iurd360/emergencias/limpar') {
            emergenciasCounter = 0;
            return json(res, { status: 'ok', contador: 0 });
        }

        // ===== GAP 2: SESSIONS — endpoint para ver sessões =====

        // GET /iurd360/sessoes — Lista sessões ativas
        if (req.method === 'GET' && pathname === '/iurd360/sessoes') {
            const sessoes = sql("SELECT remetente, updated_at FROM sessions ORDER BY updated_at DESC LIMIT 50");
            return json(res, { sessoes, total: sessoes.length });
        }

        // ===== BROADCAST MULTI-CANAL =====

        // GET /iurd360/templates — Lista templates de mensagem
        if (req.method === 'GET' && pathname === '/iurd360/templates') {
            const q = url.parse(req.url, true).query;
            let query = 'SELECT * FROM templates_mensagem WHERE 1=1';
            if (q.tipo) query += ` AND tipo = '${esc(q.tipo)}'`;
            query += ' ORDER BY tipo, nome';
            const templates = sql(query);
            return json(res, { templates, total: templates.length });
        }

        // POST /iurd360/templates — Cria novo template
        if (req.method === 'POST' && pathname === '/iurd360/templates') {
            const d = await parseBody(req);
            if (!d.nome || !d.texto) return json(res, { error: 'nome e texto required' }, 400);
            sql(`INSERT INTO templates_mensagem (nome, titulo, texto, tipo) VALUES (
                '${esc(d.nome)}',
                '${esc(d.titulo || d.nome)}',
                '${esc(d.texto)}',
                '${esc(d.tipo || 'personalizado')}'
            )`);
            const rows = sql('SELECT MAX(id) as id FROM templates_mensagem');
            const id = rows.length > 0 ? rows[0].id : null;
            return json(res, { status: 'criado', id });
        }

        // GET /iurd360/templates/byname/:name — Busca template pelo nome (para n8n workflow)
        const bynameMatch = pathname.match(/^\/iurd360\/templates\/byname\/(.+)$/);
        if (req.method === 'GET' && bynameMatch) {
            const templateName = decodeURIComponent(bynameMatch[1]);
            // Procurar primeiro em templates_mensagem
            let templates = sql(`SELECT * FROM templates_mensagem WHERE nome = '${esc(templateName)}' LIMIT 1`);
            if (templates.length > 0) {
                return json(res, { template: templates[0] });
            }
            // Se não encontrar, usar a corrente do dia (campanhas/hoje)
            const diaSemana = new Date().getDay();
            const correntes = sql(`SELECT * FROM correntes WHERE dia_semana = ${diaSemana} LIMIT 1`);
            if (correntes.length > 0) {
                const c = correntes[0];
                let horarios = c.horario;
                if (typeof horarios === 'string') {
                    try { horarios = JSON.parse(horarios); } catch { horarios = [horarios]; }
                }
                const horarioStr = Array.isArray(horarios) ? horarios.join(', ') : horarios;
                const texto = `🙏 *${c.nome} — ${c.tema}*\n\n📖 ${c.versiculo}\n\n🕐 Horarios: ${horarioStr}\n\n📍 IURD Bolivia — ¡Dios te bendiga!`;
                return json(res, { template: { id: c.id, nome: c.nome, titulo: `${c.nome} — ${c.tema}`, texto, tipo: 'corrente' } });
            }
            return json(res, { error: 'template nao encontrado' }, 404);
        }

        // GET /iurd360/agendamentos — Lista agendamentos de mensagem
        if (req.method === 'GET' && pathname === '/iurd360/agendamentos') {
            const q = url.parse(req.url, true).query;
            let query = `SELECT a.*, t.nome as template_nome, t.tipo as template_tipo
                FROM agendamentos_mensagem a
                LEFT JOIN templates_mensagem t ON a.template_id = t.id
                WHERE 1=1`;
            if (q.canal) query += ` AND a.canal = '${esc(q.canal)}'`;
            if (q.enviado !== undefined) query += ` AND a.enviado = ${parseInt(q.enviado)}`;
            if (q.escopo) query += ` AND a.escopo = '${esc(q.escopo)}'`;
            query += ' ORDER BY a.data_agendado DESC';
            const limite = Math.min(parseInt(q.limite) || 50, 200);
            query += ` LIMIT ${limite}`;
            const rows = sql(query);
            const total = sql('SELECT COUNT(*) as total FROM agendamentos_mensagem')[0]?.total || 0;
            return json(res, { agendamentos: rows, total, filtrados: rows.length });
        }

        // POST /iurd360/agendamentos — Cria novo agendamento
        if (req.method === 'POST' && pathname === '/iurd360/agendamentos') {
            const d = await parseBody(req);
            if (!d.template_id || !d.canal || !d.escopo || !d.data_agendado) {
                return json(res, { error: 'template_id, canal, escopo e data_agendado required' }, 400);
            }
            if (!['whatsapp', 'telegram', 'ambos'].includes(d.canal)) {
                return json(res, { error: 'canal deve ser whatsapp, telegram ou ambos' }, 400);
            }
            if (!['pais', 'igreja', 'engajados'].includes(d.escopo)) {
                return json(res, { error: 'escopo deve ser pais, igreja ou engajados' }, 400);
            }
            sql(`INSERT INTO agendamentos_mensagem (template_id, canal, escopo, igreja_id, data_agendado, enviado) VALUES (
                ${parseInt(d.template_id)},
                '${esc(d.canal)}',
                '${esc(d.escopo)}',
                ${d.igreja_id ? parseInt(d.igreja_id) : 'NULL'},
                '${esc(d.data_agendado)}',
                0
            )`);
            const rows = sql('SELECT MAX(id) as id FROM agendamentos_mensagem');
            const id = rows.length > 0 ? rows[0].id : null;
            return json(res, { status: 'agendado', id });
        }

        // GET /iurd360/historico — Histórico unificado
        if (req.method === 'GET' && pathname === '/iurd360/historico') {
            const q = url.parse(req.url, true).query;
            let query = `SELECT h.*, p.telefone as pessoa_telefone, p.nome as pessoa_nome, i.nome as igreja_nome
                FROM historico_mensagens h
                LEFT JOIN pessoas p ON h.pessoa_id = p.id
                LEFT JOIN igrejas i ON h.igreja_id = i.id
                WHERE 1=1`;
            if (q.canal) query += ` AND h.canal = '${esc(q.canal)}'`;
            if (q.escopo) query += ` AND h.escopo = '${esc(q.escopo)}'`;
            if (q.status) query += ` AND h.status = '${esc(q.status)}'`;
            if (q.data_inicio) query += ` AND h.created_at >= '${esc(q.data_inicio)}'`;
            if (q.data_fim) query += ` AND h.created_at <= '${esc(q.data_fim)}'`;
            query += ' ORDER BY h.created_at DESC';
            const limite = Math.min(parseInt(q.limite) || 50, 200);
            query += ` LIMIT ${limite}`;
            const rows = sql(query);
            const total = sql('SELECT COUNT(*) as total FROM historico_mensagens')[0]?.total || 0;
            return json(res, { historico: rows, total, filtrados: rows.length });
        }

        // POST /iurd360/historico — Registrar entrada no histórico
        if (req.method === 'POST' && pathname === '/iurd360/historico') {
            const d = await parseBody(req);
            // Aceitar ambos formatos: mensagem_original OU template_id (workflow broadcast)
            const texto = d.mensagem_original || d.canal + ' - template_id:' + (d.template_id || '?') + (d.total_destinos ? ` (${d.total_destinos} destinos)` : '');
            if (!d.canal) {
                return json(res, { error: 'canal required' }, 400);
            }
            sql(`INSERT INTO historico_mensagens (mensagem_original, canal, escopo, igreja_id, pessoa_id, status) VALUES (
                '${esc(texto)}',
                '${esc(d.canal)}',
                '${esc(d.escopo || 'individual')}',
                ${d.igreja_id ? parseInt(d.igreja_id) : 'NULL'},
                ${d.pessoa_id ? parseInt(d.pessoa_id) : 'NULL'},
                '${esc(d.status || 'enviada')}'
            )`);
            const rows = sql('SELECT MAX(id) as id FROM historico_mensagens');
            const id = rows.length > 0 ? rows[0].id : null;
            return json(res, { status: 'registrado', id });
        }

        // POST /iurd360/broadcast — Envia mensagem para múltiplos canais
        // Input: { template_id, canal, escopo, igreja_id (opcional) }
        if (req.method === 'POST' && pathname === '/iurd360/broadcast') {
            const d = await parseBody(req);
            if (!d.template_id && !d.texto_direto) {
                return json(res, { error: 'template_id ou texto_direto required' }, 400);
            }
            if (!d.canal) return json(res, { error: 'canal required (whatsapp, telegram, ambos)' }, 400);
            if (!d.escopo) return json(res, { error: 'escopo required (pais, igreja, engajados)' }, 400);

            // Buscar template
            let textoParaEnviar = d.texto_direto || '';
            let templateInfo = null;
            if (d.template_id) {
                const tpl = sql(`SELECT * FROM templates_mensagem WHERE id = ${parseInt(d.template_id)} LIMIT 1`);
                if (tpl.length === 0) return json(res, { error: 'template nao encontrado' }, 404);
                templateInfo = tpl[0];
                textoParaEnviar = templateInfo.texto;
            }

            // Determinar pessoas destino baseado no escopo
            let queryPessoas = 'SELECT id, telefone, igreja_id FROM pessoas WHERE consentimento = 1 AND ativo = 1';
            if (d.escopo === 'igreja' && d.igreja_id) {
                queryPessoas += ` AND igreja_id = ${parseInt(d.igreja_id)}`;
            } else if (d.escopo === 'engajados') {
                queryPessoas += ` AND id IN (SELECT pessoa_id FROM mensagens GROUP BY pessoa_id HAVING COUNT(*) >= 3)`;
            }
            // pais = todos (sem filtro adicional)

            const pessoas = sql(queryPessoas);
            const total_destinos = pessoas.length;
            let total_enviados = 0;
            let erros = [];

            // Enviar via WhatsApp se canal for whatsapp ou ambos
            if (d.canal === 'whatsapp' || d.canal === 'ambos') {
                for (const pessoa of pessoas) {
                    let telefone = pessoa.telefone;
                    if (!telefone) continue;
                    if (!telefone.includes('@')) {
                        telefone = telefone + '@s.whatsapp.net';
                    }
                    const ok = sendWhatsApp(telefone, textoParaEnviar);
                    if (ok) {
                        total_enviados++;
                    } else {
                        erros.push({ pessoa_id: pessoa.id, telefone: pessoa.telefone, canal: 'whatsapp', motivo: 'falha no envio' });
                    }
                }
            }

            // Se canal for telegram ou ambos, preparar log (Telegram é externo)
            if (d.canal === 'telegram' || d.canal === 'ambos') {
                console.log(`📨 Broadcast Telegram preparado (${total_destinos} destinos): ${textoParaEnviar.substring(0, 60)}...`);
            }

            // Registrar no histórico (uma entrada resumida)
            const canalHistorico = d.canal === 'ambos' ? 'whatsapp_grupo' : (d.canal === 'whatsapp' ? 'whatsapp_grupo' : 'telegram');
            sql(`INSERT INTO historico_mensagens (mensagem_original, canal, escopo, igreja_id, status) VALUES (
                '${esc(textoParaEnviar)}',
                '${canalHistorico}',
                '${esc(d.escopo)}',
                ${d.igreja_id ? parseInt(d.igreja_id) : 'NULL'},
                'enviada'
            )`);

            // Registrar em comunicados também (compatibilidade)
            if (templateInfo) {
                const data_envio = new Date().toISOString().replace('T', ' ').substring(0, 19);
                const igreja_save = d.igreja_id ? parseInt(d.igreja_id) : 'NULL';
                sql(`INSERT INTO comunicados (titulo, texto, tipo, igreja_id, data_envio, enviado, total_destinos, total_entregues, criado_por) VALUES (
                    '${esc(templateInfo.titulo || templateInfo.nome)}',
                    '${esc(textoParaEnviar)}',
                    '${esc(templateInfo.tipo || 'broadcast')}',
                    ${igreja_save},
                    '${data_envio}',
                    1,
                    ${total_destinos},
                    ${total_enviados},
                    'broadcast_api'
                )`);
            }

            const rows = sql('SELECT MAX(id) as id FROM historico_mensagens');
            const historico_id = rows.length > 0 ? rows[0].id : null;

            return json(res, {
                status: 'broadcast_enviado',
                historico_id,
                canal: d.canal,
                escopo: d.escopo,
                total_destinos,
                total_enviados,
                erros: erros.length > 0 ? erros : undefined
            });
        }

        // POST /iurd360/consentimento/{pessoa_id} — Registra consentimento automático
        const consentimentoPessoaMatch = pathname.match(/^\/iurd360\/consentimento\/(\d+)$/);
        if (req.method === 'POST' && consentimentoPessoaMatch) {
            const pessoa_id = parseInt(consentimentoPessoaMatch[1]);
            const d = await parseBody(req);
            const consentimento = d.consentimento !== undefined ? (d.consentimento ? 1 : 0) : 1;

            sql(`UPDATE pessoas SET
                consentimento = ${consentimento},
                consentimento_automatico = 1,
                tipo_consentimento = '${esc(d.tipo || 'automatico')}',
                data_consentimento = datetime('now', '-4 hours')
                WHERE id = ${pessoa_id}`);

            return json(res, { status: 'consentimento_atualizado', pessoa_id, consentimento: !!consentimento });
        }

        // POST /iurd360/consentimento-check — Verifica e solicita consentimento para pessoa NOVA
        if (req.method === 'POST' && pathname === '/iurd360/consentimento-check') {
            const d = await parseBody(req);
            if (!d.telefone) return json(res, { error: 'telefone required' }, 400);
            if (!d.texto) return json(res, { error: 'texto required' }, 400);

            const pessoa = sql(`SELECT id, consentimento, consentimento_automatico FROM pessoas WHERE telefone = '${esc(d.telefone)}' LIMIT 1`);

            // Se pessoa não existe, registrar nova
            if (pessoa.length === 0) {
                sql(`INSERT INTO pessoas (telefone, origem, data_primeiro_contato, data_ultimo_contato, ativo, consentimento, consentimento_automatico) VALUES (
                    '${esc(d.telefone)}',
                    '${esc(d.origem || 'WHATSAPP')}',
                    datetime('now', '-4 hours'),
                    datetime('now', '-4 hours'),
                    1, 0, 0
                )`);
                // Pessoa NOVA — solicitar consentimento
                const resposta = '🙏 ¡Gracias por escribirnos! Para continuar recibiendo mensajes de la IURD, necesitamos tu confirmación. ¿Aceptas recibir noticias y mensajes de fe? Responde SI o NO 🙏';
                return json(res, {
                    precisa_consentimento: true,
                    resposta_automatica: resposta,
                    mensagem: 'Nova pessoa — consentimento necessário'
                });
            }

            const p = pessoa[0];
            // Se já tem consentimento, retornar
            if (p.consentimento === 1) {
                return json(res, { consentimento: true, pessoa_id: p.id, mensagem: 'Já possui consentimento' });
            }

            // Verificar se o texto é resposta de consentimento
            const textoUpper = d.texto.trim().toUpperCase();
            if (textoUpper === 'SI' || textoUpper === 'SIM') {
                sql(`UPDATE pessoas SET consentimento = 1, data_consentimento = datetime('now', '-4 hours'), consentimento_automatico = 1, tipo_consentimento = 'automatico' WHERE id = ${p.id}`);
                return json(res, { consentimento: true, pessoa_id: p.id, mensagem: 'Consentimento registrado via fluxo automático', resposta: '🙏 ¡Gracias! A partir de ahora recibirás noticias y mensajes de la IURD. ¡Dios te bendiga!' });
            }
            if (textoUpper === 'NO' || textoUpper === 'NÃO' || textoUpper === 'NAO') {
                sql(`UPDATE pessoas SET consentimento = 0, data_consentimento = datetime('now', '-4 hours'), consentimento_automatico = 1, tipo_consentimento = 'automatico' WHERE id = ${p.id}`);
                return json(res, { consentimento: false, pessoa_id: p.id, mensagem: 'Consentimento recusado', resposta: '🙏 Está bien. No te enviaremos noticias. Si cambias de opinión, solo escribe SI. ¡Dios te bendiga!' });
            }

            // Se não tem consentimento e não respondeu SI/NO, solicitar
            return json(res, {
                precisa_consentimento: true,
                pessoa_id: p.id,
                resposta_automatica: '🙏 Para continuar recibiendo mensajes de la IURD, necesitamos tu confirmación. ¿Aceptas? Responde SI o NO 🙏',
                mensagem: 'Consentimento pendente'
            });
        }

        // GET /iurd360/consentimentos-pendentes — Lista pessoas que precisam de consentimento
        if (req.method === 'GET' && pathname === '/iurd360/consentimentos-pendentes') {
            const q = url.parse(req.url, true).query;
            const limite = Math.min(parseInt(q.limite) || 20, 100);
            const pendentes = sql(`SELECT id, telefone, nome, igreja_id, data_primeiro_contato
                FROM pessoas
                WHERE (consentimento IS NULL OR consentimento = 0)
                AND ativo = 1
                ORDER BY data_primeiro_contato DESC
                LIMIT ${limite}`);
            return json(res, { pendentes, total: pendentes.length });
        }

        // ===== PAINEL IA — Config de modo por classificação =====

        // GET /api/config/ia-mode — Obtém configuração atual dos modos IA
        if (req.method === 'GET' && pathname === '/api/config/ia-mode') {
            const config = getIaModes();
            return json(res, {
                ...config,
                em_periodo_treino: emPeriodoTreino(),
                periodo_treino_dias: 15,
            });
        }

        // POST /api/config/ia-mode — Altera modo de uma classificação
        if (req.method === 'POST' && pathname === '/api/config/ia-mode') {
            const d = await parseBody(req);
            if (!d.classificacao) return json(res, { error: 'classificacao required' }, 400);
            if (!d.modo || !['auto', 'rascunho'].includes(d.modo)) {
                return json(res, { error: 'modo deve ser auto ou rascunho' }, 400);
            }
            const result = setIaMode(d.classificacao, d.modo);
            if (result.error) return json(res, result, 400);
            console.log(`⚙️ IA Mode alterado: ${d.classificacao} → ${d.modo}`);
            return json(res, result);
        }

        // ===== RASCUNHOS — Painel de revisão de respostas pendentes =====

        // GET /api/rascunhos — Lista rascunhos pendentes
        if (req.method === 'GET' && pathname === '/api/rascunhos') {
            const q = url.parse(req.url, true).query;
            let query = `SELECT r.*, p.nome as pessoa_nome, p.telefone as pessoa_telefone,
                m.texto as mensagem_original, i.nome as igreja_nome
                FROM respostas_ia r
                LEFT JOIN pessoas p ON r.remetente = p.telefone
                LEFT JOIN mensagens m ON r.mensagem_id = m.id
                LEFT JOIN pessoas p2 ON m.pessoa_id = p2.id
                LEFT JOIN igrejas i ON p2.igreja_id = i.id
                WHERE r.status = 'rascunho'`;

            if (q.classificacao) query += ` AND r.classificacao = '${esc(q.classificacao)}'`;
            if (q.remetente) query += ` AND r.remetente LIKE '%${esc(q.remetente)}%'`;

            query += ` ORDER BY r.created_at DESC`;
            const limite = Math.min(parseInt(q.limite) || 50, 200);
            query += ` LIMIT ${limite}`;

            const rascunhos = sql(query);
            const total = sql("SELECT COUNT(*) as total FROM respostas_ia WHERE status = 'rascunho'")[0]?.total || 0;
            return json(res, { rascunhos, total, filtrados: rascunhos.length });
        }

        // POST /api/rascunhos/:id/aprovar — Aprova rascunho e envia WhatsApp
        const rascunhoAprovarMatch = pathname.match(/^\/api\/rascunhos\/(\d+)\/aprovar$/);
        if (req.method === 'POST' && rascunhoAprovarMatch) {
            const id = parseInt(rascunhoAprovarMatch[1]);
            const d = await parseBody(req);
            if (!id) return json(res, { error: 'id invalido' }, 400);

            const row = sql(`SELECT * FROM respostas_ia WHERE id = ${id} LIMIT 1`);
            if (row.length === 0) return json(res, { error: 'rascunho nao encontrado' }, 404);

            const r = row[0];
            const textoEnvio = d.resposta_final || r.resposta_final || r.resposta_gerada;
            const remetente = r.remetente;
            const revisado_por = d.revisado_por || 'dashboard';

            // Enviar via WhatsApp
            const enviado = sendWhatsApp(remetente, textoEnvio);

            // Atualizar status
            sql(`UPDATE respostas_ia SET
                status = '${enviado ? 'enviado' : 'aprovado'}',
                resposta_final = '${esc(textoEnvio)}',
                revisado_por = '${esc(revisado_por)}',
                updated_at = datetime('now', '-4 hours')
                WHERE id = ${id}`);

            // Atualizar mensagem relacionada
            if (r.mensagem_id) {
                sql(`UPDATE mensagens SET
                    respondida = 1,
                    resposta_texto = '${esc(textoEnvio)}',
                    data_resposta = datetime('now', '-4 hours'),
                    revisado_por = '${esc(revisado_por)}'
                    WHERE id = ${r.mensagem_id}`);
            }

            return json(res, {
                status: enviado ? 'enviado' : 'aprovado',
                enviado,
                rascunho_id: id,
                mensagem: enviado ? '¡Respuesta enviada con éxito!' : 'Respuesta aprobada (WhatsApp temporalmente no disponible)'
            });
        }

        // POST /api/rascunhos/:id/rejeitar — Rejeita rascunho (humano vai editar)
        const rascunhoRejeitarMatch = pathname.match(/^\/api\/rascunhos\/(\d+)\/rejeitar$/);
        if (req.method === 'POST' && rascunhoRejeitarMatch) {
            const id = parseInt(rascunhoRejeitarMatch[1]);
            const d = await parseBody(req);
            if (!id) return json(res, { error: 'id invalido' }, 400);

            const row = sql(`SELECT * FROM respostas_ia WHERE id = ${id} LIMIT 1`);
            if (row.length === 0) return json(res, { error: 'rascunho nao encontrado' }, 404);

            const motivo = d.motivo || 'Rejeitado pelo moderador';
            const revisado_por = d.revisado_por || 'dashboard';
            const novoTexto = d.resposta_final || null;

            if (novoTexto) {
                // Se forneceu nova resposta, salva como editada
                sql(`UPDATE respostas_ia SET
                    status = 'rejeitado',
                    resposta_final = '${esc(novoTexto)}',
                    revisado_por = '${esc(revisado_por)}',
                    updated_at = datetime('now', '-4 hours')
                    WHERE id = ${id}`);

                // Se auto_enviar, envia a nova versão
                if (d.auto_enviar) {
                    const remetente = row[0].remetente;
                    sendWhatsApp(remetente, novoTexto);
                    sql(`UPDATE respostas_ia SET status = 'enviado' WHERE id = ${id}`);
                }

                return json(res, { status: novoTexto ? 'editado' : 'rejeitado', motivo, resposta_alternativa: novoTexto });
            }

            sql(`UPDATE respostas_ia SET
                status = 'rejeitado',
                resposta_final = '${esc(motivo)}',
                revisado_por = '${esc(revisado_por)}',
                updated_at = datetime('now', '-4 hours')
                WHERE id = ${id}`);

            return json(res, { status: 'rejeitado', motivo });
        }

        // ===== AGENDAMENTO DE CORRENTES =====

        // POST /api/agendar-corrente — Agenda envio de corrente
        if (req.method === 'POST' && pathname === '/api/agendar-corrente') {
            const d = await parseBody(req);
            if (d.dia_semana === undefined && d.dia_semana === null) {
                return json(res, { error: 'dia_semana required (0=Domingo, 1=Segunda...)' }, 400);
            }
            if (!d.hora) return json(res, { error: 'hora required (HH:MM)' }, 400);
            if (!d.template) return json(res, { error: 'template required (mensagem a ser enviada)' }, 400);

            const dia_semana = parseInt(d.dia_semana);
            if (dia_semana < 0 || dia_semana > 6) {
                return json(res, { error: 'dia_semana deve ser 0 (Domingo) a 6 (Sabado)' }, 400);
            }

            // Validar formato hora
            const horaMatch = d.hora.match(/^(\d{1,2}):(\d{2})$/);
            if (!horaMatch) return json(res, { error: 'hora deve estar no formato HH:MM' }, 400);
            const hora = horaMatch[1].padStart(2, '0') + ':' + horaMatch[2];

            const igreja_id = d.igreja_id ? parseInt(d.igreja_id) : 'NULL';
            const ativo = d.ativo !== undefined ? (d.ativo ? 1 : 0) : 1;

            // Inserir na tabela agendamentos (reutilizando para correntes)
            sql(`INSERT INTO agendamentos_mensagem (template_id, canal, escopo, igreja_id, data_agendado, enviado) VALUES (
                NULL,
                'whatsapp',
                'igreja',
                ${igreja_id},
                datetime('now', '-4 hours', '+7 days'),
                0
            )`);

            // Salvar o template da corrente em templates_mensagem
            const nomesDias = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];
            const nomeTemplate = `Corrente ${nomesDias[dia_semana]} - ${hora}h`;

            sql(`INSERT INTO templates_mensagem (nome, titulo, texto, tipo) VALUES (
                '${esc(nomeTemplate)}',
                '${esc(nomeTemplate)}',
                '${esc(d.template)}',
                'corrente_agendada'
            )`);

            const tmpl = sql('SELECT MAX(id) as id FROM templates_mensagem')[0];
            const template_id = tmpl ? tmpl.id : null;

            // Gerar data_agendado para o próximo dia da semana escolhido
            const hoje = new Date();
            const diasAte = (dia_semana - hoje.getDay() + 7) % 7;
            const proximaData = new Date(hoje);
            proximaData.setDate(hoje.getDate() + diasAte);
            const dataAgendada = proximaData.toISOString().split('T')[0] + ' ' + hora + ':00';

            // Salvar agendamento principal
            sql(`INSERT INTO agendamentos_mensagem (template_id, canal, escopo, igreja_id, data_agendado, enviado) VALUES (
                ${template_id || 'NULL'},
                'whatsapp',
                'corrente',
                ${igreja_id},
                '${dataAgendada}',
                0
            )`);

            const ag = sql('SELECT MAX(id) as id FROM agendamentos_mensagem')[0];
            const agendamento_id = ag ? ag.id : null;

            // Salvar também na tabela comunicados para compatibilidade com n8n
            sql(`INSERT INTO comunicados (titulo, texto, tipo, igreja_id, data_envio, data_agendado, enviado, total_destinos, criado_por) VALUES (
                '${esc(nomeTemplate)}',
                '${esc(d.template)}',
                'corrente_agendada',
                ${igreja_id},
                datetime('now', '-4 hours'),
                '${dataAgendada}',
                0,
                0,
                'agendamento_corrente'
            )`);

            console.log(`📅 Corrente agendada: ${nomesDias[dia_semana]} às ${hora} — template_id=${template_id}, agendamento_id=${agendamento_id}`);

            return json(res, {
                status: 'agendado',
                agendamento_id,
                template_id,
                dia_semana,
                dia_nome: nomesDias[dia_semana],
                hora,
                data_proximo_envio: dataAgendada,
                template: d.template.substring(0, 100)
            });
        }

        // ===== ROTEAMENTO POR IGREJA — Mensagens filtradas =====

        // GET /api/mensagens — Mensagens com filtro por igreja_id ou cidade
        if (req.method === 'GET' && pathname === '/api/mensagens') {
            const q = url.parse(req.url, true).query;
            let query = `SELECT m.*, p.telefone as contato_telefone, p.nome as contato_nome,
                p.igreja_id, i.nome as igreja_nome, i.cidade as igreja_cidade
                FROM mensagens m
                LEFT JOIN pessoas p ON m.pessoa_id = p.id
                LEFT JOIN igrejas i ON p.igreja_id = i.id
                WHERE 1=1`;

            if (q.igreja_id) {
                query += ` AND p.igreja_id = ${parseInt(q.igreja_id)}`;
            }
            if (q.cidade) {
                query += ` AND i.cidade LIKE '%${esc(q.cidade)}%'`;
            }
            if (q.severidade) {
                query += ` AND (m.severidade = '${esc(q.severidade)}' OR m.prioridade = 'alta')`;
            }
            if (q.prioridade) {
                query += ` AND m.prioridade = '${esc(q.prioridade)}'`;
            }
            if (q.classificacao) {
                query += ` AND m.classificacao = '${esc(q.classificacao)}'`;
            }
            if (q.remetente) {
                query += ` AND m.remetente LIKE '%${esc(q.remetente)}%'`;
            }
            if (q.data_inicio) {
                query += ` AND m.data_envio >= '${esc(q.data_inicio)}'`;
            }
            if (q.data_fim) {
                query += ` AND m.data_envio <= '${esc(q.data_fim)}'`;
            }

            query += ` ORDER BY m.data_envio DESC`;
            const limite = Math.min(parseInt(q.limite) || 50, 200);
            query += ` LIMIT ${limite}`;

            const rows = sql(query);
            const total = sql('SELECT COUNT(*) as total FROM mensagens')[0]?.total || 0;

            // Estatísticas
            const porIgreja = sql(`SELECT i.nome, COUNT(*) as total
                FROM mensagens m
                JOIN pessoas p ON m.pessoa_id = p.id
                JOIN igrejas i ON p.igreja_id = i.id
                GROUP BY i.nome
                ORDER BY total DESC LIMIT 10`);

            const porSeveridade = sql(`SELECT severidade, COUNT(*) as total
                FROM mensagens GROUP BY severidade`);

            return json(res, {
                mensagens: rows,
                total,
                filtrados: rows.length,
                por_igreja: porIgreja,
                por_severidade: porSeveridade
            });
        }

        // ===== MULTI-NÚMEROS AUTORIZADOS =====

        // POST /numeros-autorizados — Cria um número autorizado
        if (req.method === 'POST' && pathname === '/numeros-autorizados') {
            const d = await parseBody(req);
            if (!d.telefone || !d.tipo) return json(res, { error: 'telefone e tipo required' }, 400);
            const existente = sql(`SELECT id FROM numeros_autorizados WHERE telefone = '${esc(d.telefone)}' AND tipo = '${esc(d.tipo)}' AND entidade_id ${d.entidade_id ? `= ${parseInt(d.entidade_id)}` : 'IS NULL'}`);
            if (existente.length > 0) return json(res, { error: 'número já existe para esta entidade' }, 409);
            sql(`INSERT INTO numeros_autorizados (telefone, tipo, entidade_id, entidade_nome, descricao, criado_por)
                VALUES ('${esc(d.telefone)}', '${esc(d.tipo)}', ${d.entidade_id ? parseInt(d.entidade_id) : 'NULL'}, '${esc(d.entidade_nome || '')}', '${esc(d.descricao || '')}', 'api')`);
            return json(res, { status: 'criado', telefone: d.telefone, tipo: d.tipo });
        }

        // GET /numeros-autorizados — Lista todos, com filtro opcional ?tipo=
        if (req.method === 'GET' && pathname === '/numeros-autorizados') {
            const q = url.parse(req.url, true).query;
            let query = 'SELECT * FROM numeros_autorizados';
            const wheres = [];
            if (q.tipo) wheres.push(`tipo = '${esc(q.tipo)}'`);
            if (q.entidade_id) wheres.push(`entidade_id = ${parseInt(q.entidade_id)}`);
            if (q.telefone) wheres.push(`telefone = '${esc(q.telefone)}'`);
            if (wheres.length) query += ' WHERE ' + wheres.join(' AND ');
            query += ' ORDER BY criado_em DESC';
            const rows = sql(query);
            return json(res, { numeros_autorizados: rows, total: rows.length });
        }

        // GET /numeros-autorizados/verificar — Verifica se número está autorizado
        if (req.method === 'GET' && pathname === '/numeros-autorizados/verificar') {
            const q = url.parse(req.url, true).query;
            if (!q.telefone || !q.tipo) return json(res, { error: 'telefone e tipo são required (query string)' }, 400);
            let query = `SELECT id FROM numeros_autorizados WHERE telefone = '${esc(q.telefone)}' AND tipo = '${esc(q.tipo)}' AND ativo = 1`;
            if (q.entidade_id) query += ` AND entidade_id = ${parseInt(q.entidade_id)}`;
            const rows = sql(query);
            return json(res, { autorizado: rows.length > 0 });
        }

        // ===== CADEIAS =====

        // POST /cadeias — Cria uma nova cadeia
        if (req.method === 'POST' && pathname === '/cadeias') {
            const d = await parseBody(req);
            if (!d.nome) return json(res, { error: 'nome required' }, 400);
            sql(`INSERT INTO cadeias (nome, descricao, igreja_id)
                VALUES ('${esc(d.nome)}', '${esc(d.descricao || '')}', ${d.igreja_id ? parseInt(d.igreja_id) : 'NULL'})`);
            return json(res, { status: 'criado', nome: d.nome });
        }

        // GET /cadeias — Lista cadeias com contagem de membros
        if (req.method === 'GET' && pathname === '/cadeias') {
            const rows = sql(`SELECT c.*,
                (SELECT COUNT(*) FROM membros_cadeia WHERE cadeia_id = c.id AND ativo = 1) as total_membros
                FROM cadeias c ORDER BY c.criado_em DESC`);
            const total = sql('SELECT COUNT(*) as total FROM cadeias')[0]?.total || 0;
            return json(res, { cadeias: rows, total });
        }

        // ===== MEMBROS CADEIA =====

        // POST /membros-cadeia — Adiciona membro à cadeia
        if (req.method === 'POST' && pathname === '/membros-cadeia') {
            const d = await parseBody(req);
            if (!d.cadeia_id || !d.pessoa_id) return json(res, { error: 'cadeia_id e pessoa_id required' }, 400);
            const existente = sql(`SELECT id FROM membros_cadeia WHERE cadeia_id = ${parseInt(d.cadeia_id)} AND pessoa_id = ${parseInt(d.pessoa_id)}`);
            if (existente.length > 0) return json(res, { error: 'membro já existe nesta cadeia' }, 409);
            sql(`INSERT INTO membros_cadeia (cadeia_id, pessoa_id) VALUES (${parseInt(d.cadeia_id)}, ${parseInt(d.pessoa_id)})`);
            return json(res, { status: 'adicionado', cadeia_id: parseInt(d.cadeia_id), pessoa_id: parseInt(d.pessoa_id) });
        }

        // GET /membros-cadeia/:cadeia_id — Lista membros de uma cadeia
        if (req.method === 'GET' && pathname.match(/^\/membros-cadeia\/\d+$/)) {
            const cadeiaId = parseInt(pathname.split('/')[2]);
            const rows = sql(`SELECT mc.*, p.nome as pessoa_nome, p.telefone as pessoa_telefone
                FROM membros_cadeia mc
                LEFT JOIN pessoas p ON mc.pessoa_id = p.id
                WHERE mc.cadeia_id = ${cadeiaId} AND mc.ativo = 1
                ORDER BY mc.data_entrada DESC`);
            const cadeia = sql(`SELECT nome FROM cadeias WHERE id = ${cadeiaId}`)[0];
            return json(res, { cadeia: cadeia || null, membros: rows, total: rows.length });
        }

        // ===== GEOLOCALIZAÇÃO =====

        // GET /geolocalizar — Geolocalização por código de área
        if (req.method === 'GET' && pathname === '/geolocalizar') {
            const q = url.parse(req.url, true).query;
            if (!q.telefone) return json(res, { error: 'telefone required (query string)' }, 400);
            const tel = q.telefone.replace(/\D/g, '');
            let cidade = 'Desconhecido';
            let estado = '';
            let pais = 'Bolivia';
            // Mapeamento de prefixos (código de área boliviano: 591 + 1 dígito departamento)
            if (tel.startsWith('59144')) { cidade = 'Santa Cruz (Valle Alto)'; estado = 'Santa Cruz'; }
            else if (tel.startsWith('59164')) { cidade = 'Oruro'; estado = 'Oruro'; }
            else if (tel.startsWith('5912')) { cidade = 'La Paz'; estado = 'La Paz'; }
            else if (tel.startsWith('5913')) { cidade = 'Santa Cruz de la Sierra'; estado = 'Santa Cruz'; }
            else if (tel.startsWith('5914')) { cidade = 'Cochabamba'; estado = 'Cochabamba'; }
            else if (tel.startsWith('5916')) { cidade = 'Beni'; estado = 'Beni'; }
            else if (tel.startsWith('5917')) { cidade = 'Potosí / Sucre / Tarija'; estado = 'Potosí/Chuquisaca/Tarija'; }
            else if (tel.startsWith('591')) { cidade = 'Outra região'; estado = 'Bolivia'; }
            return json(res, { telefone: tel, cidade, estado, pais, codigo_area: '591' });
        }

        // ===== PÁGINA 1 — PASTOR LOGIN (8 endpoints) =====
        // Helper: extrai pastor_id e igreja_id do token JWT
        function getPastorFromToken(req) {
            const auth = req.headers['authorization'] || '';
            if (!auth.startsWith('Bearer ')) return null;
            try {
                const decoded = jwt.verify(auth.substring(7), JWT_SECRET);
                return { pastor_id: decoded.pastor_id, igreja_id: decoded.igreja_id, email: decoded.email, nome: decoded.nome };
            } catch {
                return null;
            }
        }

        // POST /pastor/login — Autenticação do Pastor
        if (req.method === 'POST' && pathname === '/pastor/login') {
            const d = await parseBody(req);
            if (!d.email || !d.senha) return json(res, { error: 'email e senha required' }, 400);

            const login = sql(`SELECT pl.*, p.nome as pastor_nome, p.igreja_id, i.nome as igreja_nome
                FROM pastores_login pl
                JOIN pastores p ON pl.pastor_id = p.id
                JOIN igrejas i ON p.igreja_id = i.id
                WHERE pl.email = '${esc(d.email)}' AND pl.ativo = 1
                LIMIT 1`);
            if (login.length === 0) return json(res, { error: 'email ou senha invalidos' }, 401);

            const user = login[0];
            const senhaValida = bcrypt.compareSync(d.senha, user.senha_hash);
            if (!senhaValida) return json(res, { error: 'email ou senha invalidos' }, 401);

            // Gerar JWT
            const token = jwt.sign(
                { pastor_id: user.pastor_id, igreja_id: user.igreja_id, email: user.email, nome: user.pastor_nome },
                JWT_SECRET,
                { expiresIn: '24h' }
            );
            const expiracao = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

            // Salvar token no banco
            sql(`UPDATE pastores_login SET token = '${esc(token)}', token_expiracao = '${expiracao}', ultimo_acesso = datetime('now', '-4 hours') WHERE id = ${user.id}`);

            return json(res, {
                token,
                pastor: {
                    nome: user.pastor_nome,
                    igreja_nome: user.igreja_nome,
                    igreja_id: user.igreja_id,
                    email: user.email
                }
            });
        }

        // POST /pastor/alterar-senha — Altera senha do pastor
        if (req.method === 'POST' && pathname === '/pastor/alterar-senha') {
            const d = await parseBody(req);
            if (!d.email || !d.senha_atual || !d.senha_nova) return json(res, { error: 'email, senha_atual e senha_nova required' }, 400);

            const login = sql(`SELECT * FROM pastores_login WHERE email = '${esc(d.email)}' AND ativo = 1 LIMIT 1`);
            if (login.length === 0) return json(res, { error: 'email nao encontrado' }, 404);

            const senhaValida = bcrypt.compareSync(d.senha_atual, login[0].senha_hash);
            if (!senhaValida) return json(res, { error: 'senha atual incorreta' }, 401);

            const novaHash = bcrypt.hashSync(d.senha_nova, 10);
            sql(`UPDATE pastores_login SET senha_hash = '${esc(novaHash)}', token = NULL, token_expiracao = NULL WHERE id = ${login[0].id}`);

            return json(res, { status: 'senha alterada com sucesso' });
        }

        // GET /pastor/dashboard — Dashboard do pastor (stats da igreja)
        if (req.method === 'GET' && pathname === '/pastor/dashboard') {
            const pastor = getPastorFromToken(req);
            if (!pastor) return json(res, { error: 'token invalido ou expirado' }, 401);

            const igrejaId = pastor.igreja_id;
            const igreja = sql(`SELECT nome FROM igrejas WHERE id = ${igrejaId}`)[0];
            const totalMembros = sql(`SELECT COUNT(*) as total FROM pessoas WHERE igreja_id = ${igrejaId} AND ativo = 1`)[0]?.total || 0;
            const totalMsgHoje = sql(`SELECT COUNT(*) as total FROM mensagens m
                JOIN pessoas p ON m.pessoa_id = p.id
                WHERE p.igreja_id = ${igrejaId} AND date(m.data_envio) = date('now', '-4 hours')`)[0]?.total || 0;
            const msgPendentes = sql(`SELECT COUNT(*) as total FROM respostas_ia r
                JOIN pessoas p ON r.remetente = p.telefone
                WHERE p.igreja_id = ${igrejaId} AND r.status = 'rascunho'`)[0]?.total || 0;

            return json(res, {
                igreja_nome: igreja?.nome || 'Desconhecida',
                total_membros: totalMembros,
                total_msg_hoje: totalMsgHoje,
                msg_pendentes: msgPendentes,
                pastor_nome: pastor.nome
            });
        }

        // GET /pastor/mensagens — Mensagens da igreja do pastor
        if (req.method === 'GET' && pathname === '/pastor/mensagens') {
            const pastor = getPastorFromToken(req);
            if (!pastor) return json(res, { error: 'token invalido ou expirado' }, 401);

            const rows = sql(`SELECT m.*, p.nome as pessoa_nome, p.telefone as pessoa_telefone
                FROM mensagens m
                JOIN pessoas p ON m.pessoa_id = p.id
                WHERE p.igreja_id = ${pastor.igreja_id}
                ORDER BY m.data_envio DESC LIMIT 20`);

            return json(res, { mensagens: rows, total: rows.length });
        }

        // GET /pastor/membros — Membros da igreja do pastor
        if (req.method === 'GET' && pathname === '/pastor/membros') {
            const pastor = getPastorFromToken(req);
            if (!pastor) return json(res, { error: 'token invalido ou expirado' }, 401);

            const rows = sql(`SELECT id, nome, telefone, consentimento, data_ultimo_contato as ultimo_contato, data_primeiro_contato
                FROM pessoas
                WHERE igreja_id = ${pastor.igreja_id} AND ativo = 1
                ORDER BY nome ASC`);

            return json(res, { membros: rows, total: rows.length });
        }

        // POST /pastor/enviar — Envia mensagem para membros consentidos
        if (req.method === 'POST' && pathname === '/pastor/enviar') {
            const pastor = getPastorFromToken(req);
            if (!pastor) return json(res, { error: 'token invalido ou expirado' }, 401);

            const d = await parseBody(req);
            if (!d.texto) return json(res, { error: 'texto required' }, 400);

            const apenasConsentidos = d.apenas_consentidos !== false;
            const condConsentimento = apenasConsentidos ? 'AND consentimento = 1' : '';

            const pessoas = sql(`SELECT id, nome, telefone FROM pessoas WHERE igreja_id = ${pastor.igreja_id} ${condConsentimento} AND ativo = 1`);
            if (pessoas.length === 0) return json(res, { status: 'sem_destinos', total_envios: 0 });

            let enviados = 0;
            const erros = [];
            const lotes = [];
            for (let i = 0; i < pessoas.length; i += 5) {
                lotes.push(pessoas.slice(i, i + 5));
            }

            for (const lote of lotes) {
                for (const pessoa of lote) {
                    const ok = sendWhatsApp(pessoa.telefone, d.texto);
                    if (ok) enviados++;
                    else erros.push(pessoa.telefone);
                }
                // Pequena pausa entre lotes
                await new Promise(r => setTimeout(r, 500));
            }

            // Salvar em comunicados
            const data_envio = new Date().toISOString().replace('T', ' ').substring(0, 19);
            sql(`INSERT INTO comunicados (titulo, texto, tipo, igreja_id, data_envio, enviado, total_destinos, total_entregues, criado_por)
                VALUES ('Mensagem do Pastor', '${esc(d.texto)}', 'pastor', ${pastor.igreja_id}, '${data_envio}', 1, ${pessoas.length}, ${enviados}, '${esc(pastor.nome)}')`);

            return json(res, {
                status: enviados > 0 ? 'enviado' : 'erro',
                total_envios: enviados,
                total_destinos: pessoas.length,
                erros: erros.length > 0 ? erros : undefined
            });
        }

        // GET /pastor/respostas-pendentes — Respostas IA pendentes da igreja
        if (req.method === 'GET' && pathname === '/pastor/respostas-pendentes') {
            const pastor = getPastorFromToken(req);
            if (!pastor) return json(res, { error: 'token invalido ou expirado' }, 401);

            const rows = sql(`SELECT r.*, p.nome as pessoa_nome, p.telefone as pessoa_telefone
                FROM respostas_ia r
                JOIN pessoas p ON r.remetente = p.telefone
                WHERE p.igreja_id = ${pastor.igreja_id} AND r.status = 'rascunho'
                ORDER BY r.created_at DESC LIMIT 20`);

            return json(res, { respostas: rows, total: rows.length });
        }

        // POST /pastor/respostas/:id/aprovar — Aprova resposta + envia WhatsApp
        const aprovarPastorMatch = pathname.match(/^\/pastor\/respostas\/(\d+)\/aprovar$/);
        if (req.method === 'POST' && aprovarPastorMatch) {
            const pastor = getPastorFromToken(req);
            if (!pastor) return json(res, { error: 'token invalido ou expirado' }, 401);

            const id = parseInt(aprovarPastorMatch[1]);
            const d = await parseBody(req);

            const row = sql(`SELECT r.*, p.igreja_id FROM respostas_ia r
                JOIN pessoas p ON r.remetente = p.telefone
                WHERE r.id = ${id} LIMIT 1`);
            if (row.length === 0) return json(res, { error: 'resposta nao encontrada' }, 404);
            if (row[0].igreja_id !== pastor.igreja_id) return json(res, { error: 'resposta nao pertence a sua igreja' }, 403);

            const resposta = row[0];
            const textoEnvio = resposta.resposta_final || resposta.resposta_gerada;
            const enviado = sendWhatsApp(resposta.remetente, textoEnvio);

            sql(`UPDATE respostas_ia SET status = '${enviado ? 'enviada' : 'aprovada'}', resposta_final = '${esc(textoEnvio)}', revisado_por = '${esc(pastor.nome)}', updated_at = datetime('now', '-4 hours') WHERE id = ${id}`);

            return json(res, { status: enviado ? 'enviada' : 'aprovada', enviado });
        }

        // ===== CORRENTE DO DIA PRONTA PARA ENVIO =====
        // GET /corrente-hoje — Retorna a corrente do dia formatada para envio WhatsApp
        if (req.method === 'GET' && pathname === '/corrente-hoje') {
            const diaSemana = new Date().getDay();
            const nomesDias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
            const correntes = sql(`SELECT * FROM correntes WHERE dia_semana = ${diaSemana} LIMIT 1`);

            if (correntes.length === 0) {
                return json(res, { error: 'nenhuma corrente encontrada para hoje' }, 404);
            }

            const c = correntes[0];
            const diaNome = nomesDias[diaSemana];

            let horarios = c.horario;
            if (typeof horarios === 'string') {
                try { horarios = JSON.parse(horarios); } catch { horarios = [horarios]; }
            }

            const mensagem = `🙏 *${diaNome} — ${c.tema || c.nome}*\n\n📖 ${c.versiculo}\n\n🕐 Horários: ${Array.isArray(horarios) ? horarios.join(', ') : horarios}\n\n✨ ¡Te esperamos en la IURD! Dios tiene un propósito para ti hoy.`;

            return json(res, {
                corrente: {
                    id: c.id,
                    nome: c.nome,
                    dia: diaNome,
                    tema: c.tema,
                    versiculo: c.versiculo,
                    horarios
                },
                mensagem_pronta: mensagem,
                dia_semana: diaSemana
            });
        }

        json(res, { error: 'rota nao encontrada' }, 404);
    } catch (e) {
        console.error('Erro:', e.message);
        json(res, { error: e.message }, 500);
    }
});

// Criar tabela respostas_ia se não existir
sql(`CREATE TABLE IF NOT EXISTS respostas_ia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mensagem_id INTEGER,
  remetente TEXT,
  pergunta TEXT,
  resposta_gerada TEXT,
  resposta_final TEXT,
  status TEXT DEFAULT 'rascunho',
  agente TEXT,
  classificacao TEXT DEFAULT 'oracao',
  revisado_por TEXT,
  created_at TEXT DEFAULT (datetime('now', '-4 hours')),
  updated_at TEXT
)`);

// Adicionar coluna classificacao se não existir (banco já criado)
// Coluna classificacao já existe na tabela

// Criar tabela sessions se não existir (GAP 2 — Memória de Conversação)
sql(`CREATE TABLE IF NOT EXISTS sessions (
    remetente TEXT PRIMARY KEY,
    contexto TEXT,
    updated_at TEXT DEFAULT (datetime('now', '-4 hours'))
)`);

server.listen(PORT, '0.0.0.0', () => {
    // 🗓️ Iniciar período de treino de 15 dias se não existir
    registrarInicioTreino();
    if (emPeriodoTreino()) {
        console.log(`🧪 Período de TREINO (15 dias) ativo — todas as respostas vão para rascunho`);
    } else {
        console.log(`🤖 Período de TREINO concluído — IA pode enviar respostas automaticamente`);
    }

    console.log(`🏛️ API IURD 360 rodando em http://0.0.0.0:${PORT}`);
    console.log(`   POST /contato       — Novo contato (telefone, origem, igreja)`);
    console.log(`   POST /mensagem      — Salvar mensagem (remetente, texto, resposta_texto)`);
    console.log(`   GET  /contato/:tel  — Buscar contato (com nome da igreja)`);
    console.log(`   POST /consentimento — Atualizar consentimento (telefone, consentimento)`);
    console.log(`   GET  /stats         — Estatísticas`);
    console.log(`   GET  /health        — Health check`);
    console.log(`   POST /campanha      — Criar e enviar campanha/broadcast`);
    console.log(`   GET  /campanhas     — Listar campanhas enviadas`);
    console.log(`   GET  /campanhas/templates — Templates de corrente`);
    console.log(`   GET  /campanhas/hoje — Corrente do dia de hoje`);
    console.log(`   GET  /corrente-hoje  — Corrente do dia formatada para envio`);
    console.log(`   POST /campanhas/enviar-corrente — Enviar corrente do dia`);
    console.log(`   GET  /respostas-ia — Listar respostas da IA (painel auditoria)`);
    console.log(`   POST /respostas-ia/:id/aprovar — Aprovar + enviar WhatsApp`);
    console.log(`   POST /respostas-ia/:id/rejeitar — Rejeitar resposta`);
    console.log(`   POST /respostas-ia/:id/editar — Editar resposta`);
    console.log(`   GET  /modo-aprendizagem — Retorna modo atual`);
    console.log(`   POST /modo-aprendizagem — Altera modo (true/false)`);
    console.log(`   GET  /config-modo — Config do modo aprendizagem`);
    console.log(`   ===== SMART CHAT SYSTEM =====`);
    console.log(`   GET  /api/config/ia-mode — Config dos modos IA`);
    console.log(`   POST /api/config/ia-mode — Alterar modo IA (classificacao, modo)`);
    console.log(`   GET  /api/rascunhos — Rascunhos pendentes de revisão`);
    console.log(`   POST /api/rascunhos/:id/aprovar — Aprovar rascunho e enviar`);
    console.log(`   POST /api/rascunhos/:id/rejeitar — Rejeitar rascunho`);
    console.log(`   POST /api/agendar-corrente — Agendar envio de corrente`);
    console.log(`   GET  /api/mensagens — Mensagens (filtro: igreja_id, cidade)`);
    console.log(`   ===== BROADCAST MULTI-CANAL =====`);
    console.log(`   GET  /iurd360/templates — Lista templates`);
    console.log(`   POST /iurd360/templates — Cria template`);
    console.log(`   GET  /iurd360/agendamentos — Lista agendamentos`);
    console.log(`   POST /iurd360/agendamentos — Cria agendamento`);
    console.log(`   GET  /iurd360/historico — Histórico unificado`);
    console.log(`   POST /iurd360/historico — Registra no histórico`);
    console.log(`   POST /iurd360/broadcast — Envio multi-canal`);
    console.log(`   POST /iurd360/consentimento/:id — Registra consentimento automático`);
    console.log(`   POST /iurd360/consentimento-check — Fluxo de consentimento automático`);
    console.log(`   GET  /iurd360/consentimentos-pendentes — Pessoas sem consentimento`);
});
