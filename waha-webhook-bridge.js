/**
 * WAHA Webhook Bridge — IURD Bolívia
 * 
 * WAHA CORE edition (free) NÃO envia webhooks para mensagens recebidas
 * (recurso Plus). Este script faz polling na API do WAHA e encaminha
 * mensagens recebidas para o webhook do api-iurd360.js.
 * 
 * Portas:
 *   WAHA API: 3002
 *   Webhook (api-iurd360.js): 3003
 */

const http = require('http');

const WAHA_PORT = 3002;
const WAHA_KEY = 'ebb0879aae964a61bd612cebd4d11b55';
const WEBHOOK_URL = 'http://localhost:3099/ia/receber';
const SESSION = 'default';

const POLL_INTERVAL_MS = 3000; // 3 segundos

// Cache de IDs de mensagens já processadas
const processedIds = new Set();

// Timestamp de inicio — 10 minutos atras (aceita mensagens recentes, ignora historico antigo)
const START_TIME = Math.floor(Date.now() / 1000) - 600; // 10 min atras

// Cache de mapeamento lid → telefone
let lidToPhone = {};

function wahaRequest(path) {
    return new Promise((resolve, reject) => {
        const opts = {
            hostname: 'localhost',
            port: WAHA_PORT,
            path,
            method: 'GET',
            headers: { 'X-API-Key': WAHA_KEY }
        };
        const req = http.request(opts, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error(`JSON parse error: ${data.substring(0,100)}`)); }
            });
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.end();
    });
}

function postWebhook(payload) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(payload);
        const urlObj = new URL(WEBHOOK_URL);
        const opts = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        };
        const req = http.request(opts, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', reject);
        req.setTimeout(5000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.write(body);
        req.end();
    });
}

// Atualiza mapeamento lid → telefone a partir dos chats
async function updateLidMapping() {
    try {
        const chats = await wahaRequest(`/api/${SESSION}/chats`);
        if (!Array.isArray(chats)) return;
        for (const chat of chats) {
            const id = chat.id?._serialized || chat.id;
            const name = chat.name || '';
            // Extrair número do chat name (formato: "+591 78440354")
            if (name.startsWith('+')) {
                const digits = name.replace(/\D/g, '');
                if (digits.length >= 7) {
                    lidToPhone[id] = digits;
                }
            }
        }
    } catch (e) {
        // Silêncio — reconnect na próxima iteração
    }
}

// Tenta obter telefone para um @lid
function getPhoneForLid(lid) {
    // Se já está em formato @c.us, retorna direto
    if (lid.endsWith('@c.us')) return lid;
    // Tenta lookup no cache
    if (lidToPhone[lid]) return lidToPhone[lid] + '@c.us';
    // Se tem @lid, tenta extrair e buscar
    if (lid.endsWith('@lid')) {
        // Fallback: tenta o próprio lid como identificador
        // O webhook aceita qualquer string como remetente
        return lid;
    }
    return lid;
}

async function pollMessages() {
    try {
        // 1. Atualiza mapeamento periodicamente
        await updateLidMapping();

        // 2. Pega lista de chats
        const chats = await wahaRequest(`/api/${SESSION}/chats`);
        if (!Array.isArray(chats)) return;

        for (const chat of chats) {
            const chatId = chat.id?._serialized || chat.id;
            if (!chatId) continue;

            // Pula chats que são do próprio número (nosso bot)
            if (chatId.endsWith('@lid') && lidToPhone[chatId] === '59178440353') continue;

            try {
                // 3. Pega mensagens recentes deste chat
                const messages = await wahaRequest(
                    `/api/${SESSION}/chats/${encodeURIComponent(chatId)}/messages?limit=10`
                );
                if (!Array.isArray(messages)) continue;

                for (const msg of messages) {
                    // Só processa mensagens RECEBIDAS (não enviadas pelo bot)
                    if (msg.fromMe) continue;
                    if (!msg.body || msg.body.trim() === '') continue;

                    const msgId = msg.id;
                    if (processedIds.has(msgId)) continue;
                    processedIds.add(msgId);

                    // Ignora mensagens anteriores ao inicio do bridge (evita historico)
                    const msgTimestamp = msg.timestamp || 0;
                    if (msgTimestamp > 0 && msgTimestamp < START_TIME) continue;

                    // Limitar cache a 5000 IDs
                    if (processedIds.size > 5000) {
                        const arr = Array.from(processedIds);
                        for (let i = 0; i < 1000; i++) processedIds.delete(arr[i]);
                    }

                    // Converter remetente para formato aceito pelo webhook
                    const remetente = getPhoneForLid(msg.from);

                    // 4. Monta payload no formato do IA Service
                    const payload = {
                        remetente: remetente,
                        texto: msg.body,
                        pessoa_id: 0  // IA service vai buscar/criar no Directus
                    };

                    // 5. Envia para o webhook
                    const result = await postWebhook(payload);
                    const ts = new Date().toISOString().substring(11, 19);
                    const statusIcon = result.status === 200 ? '✅' : '❌';
                    console.log(`${ts} ${statusIcon} MSG [${remetente}] "${msg.body.substring(0,60)}" → ${result.status}`);
                }
            } catch (e) {
                // Silêncio por chat — continua com o próximo
            }
        }
    } catch (e) {
        const ts = new Date().toISOString().substring(11, 19);
        console.log(`${ts} ⚠️ Poll error: ${e.message}`);
    }
}

// Iniciar
console.log('🚀 WAHA Webhook Bridge iniciado');
console.log(`📡 WAHA API: localhost:${WAHA_PORT}`);
console.log(`🎯 Webhook: ${WEBHOOK_URL}`);
console.log(`⏱️  Poll interval: ${POLL_INTERVAL_MS}ms`);
console.log('─────────────────────────────');

// Primeiro polling imediato
pollMessages();

// Loop contínuo
setInterval(pollMessages, POLL_INTERVAL_MS);

// Graceful shutdown
process.on('SIGINT', () => { console.log('\n👋 Bridge encerrado'); process.exit(0); });
process.on('SIGTERM', () => { console.log('\n👋 Bridge encerrado'); process.exit(0); });
