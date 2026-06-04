/**
 * Gateway WhatsApp — IURD Bolívia
 * Número: +591 78440353
 * Porta: 3002
 * 
 * Usa Baileys (self-hosted)
 * Conecta com n8n via webhook
 */

const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const http = require('http');
const { WebSocketServer } = require('ws');
const { promises: fs } = require('fs');
const path = require('path');
const { toBuffer } = require('qrcode');

const SESSION_DIR = '/home/catedral/whatsapp-gateway/session';
const WEBHOOK_URL = 'http://localhost:3003/whatsapp-webhook';
const HTTP_PORT = 3004;
const WS_PORT = 3005;
const NUMERO = '59178440353';

// Estado
let sock = null;
let ultimaMensagem = '';

// Cache anti-duplicata: impede processar a mesma msg duas vezes
const msgCache = new Set();
const CACHE_TTL = 10000; // 10 segundos

// WebSocket clients
const wsClients = new Set();

function broadcastToWS(data) {
    const payload = JSON.stringify(data);
    for (const ws of wsClients) {
        if (ws.readyState === ws.OPEN) {
            try {
                ws.send(payload);
            } catch (e) {
                console.log(`⚠️ Erro ao enviar WS: ${e.message}`);
            }
        }
    }
}

async function start() {
    console.log('🤖 Iniciando gateway WhatsApp IURD...');
    console.log(`📱 Número: +${NUMERO}`);
    
    // Garantir diretório de sessão
    await fs.mkdir(SESSION_DIR, { recursive: true });
    
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: ['Chrome', 'Windows', '10.0.0'],
        syncFullHistory: false,
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: false,
        patch: true,
        connectTimeoutMs: 30000,
        keepAliveIntervalMs: 25000
    });
    
    // QR Code - primeira conexão
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('\n📱 ESCANEIE O QR CODE COM O WHATSAPP DO NÚMERO +591 78440353');
            console.log('   1. Abra WhatsApp > 3 pontos > WhatsApp Web');
            console.log('   2. Escaneie o QR abaixo:\n');
            
            // Salvar QR em arquivo
            const qrPath = '/home/catedral/whatsapp-gateway/qr-code.txt';
            const qrPngPath = '/home/catedral/whatsapp-gateway/qr-code.png';
            
            try {
                const QR = require('qrcode-terminal');
                QR.generate(qr, { small: true });
                
                // Salvar texto
                QR.generate(qr, { small: false }, async (qrcode_str) => {
                    await fs.writeFile(qrPath, qrcode_str);
                    console.log(`\n📄 QR salvo em: ${qrPath}`);
                });
                
                // Salvar PNG
                toBuffer(qr, { type: 'png', width: 400, margin: 2 })
                    .then(async (buf) => {
                        await fs.writeFile(qrPngPath, buf);
                        console.log(`🖼️  QR PNG salvo em: ${qrPngPath}`);
                    })
                    .catch(e => console.log('Erro ao salvar PNG:', e.message));
            } catch(e) {
                console.log(`QR: ${qr}`);
                // Salvar raw mesmo
                fs.writeFile(qrPath, qr).catch(()=>{});
            }
        }
        
        if (connection === 'open') {
            console.log('\n✅ WhatsApp conectado!');
            console.log(`📱 Número: +${NUMERO}`);
        }
        
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log(`❌ Conexão fechada: ${reason}`);
            
            if (reason === DisconnectReason.loggedOut) {
                console.log('⚠️ Sessão expirada. Remova a pasta session/ e reconecte.');
            } else if (reason === 515) {
                console.log('🔧 Erro 515 (WebSocket). Tentando novamente em 10s...');
                setTimeout(() => {
                    server.close(() => start());
                }, 10000);
            } else {
                console.log('🔄 Reconectando em 5 segundos...');
                setTimeout(start, 5000);
            }
        }
    });
    
    // Salvar credenciais
    sock.ev.on('creds.update', saveCreds);
    
    // Mensagens recebidas
    sock.ev.on('messages.upsert', async (msg) => {
        const message = msg.messages[0];
        if (!message.key || !message.message) return;
        
        // Ignorar mensagens enviadas por nós mesmos
        if (message.key.fromMe) return;
        
        // ANTI-DUPLICATA: verificar se já processamos esta msg
        const msgId = message.key.id;
        if (msgCache.has(msgId)) {
            console.log(`⏭️  Ignorando duplicata: ${msgId}`);
            return;
        }
        msgCache.add(msgId);
        setTimeout(() => msgCache.delete(msgId), CACHE_TTL);
        
        const sender = message.key.remoteJid;
        const text = message.message.conversation || 
                     message.message.extendedTextMessage?.text || '';
        
        // Ignorar mensagens vazias (confirmação, status, etc)
        if (!text.trim()) {
            console.log(`⏭️  Ignorando msg vazia de ${sender}`);
            return;
        }
        
        const timestamp = new Date().toISOString();
        
        console.log(`📩 [${timestamp}] De: ${sender}`);
        console.log(`💬 Msg: ${text}`);
        console.log(`🔑 ID: ${msgId}`);

        // Broadcast para clientes WebSocket
        broadcastToWS({
            tipo: 'nova_mensagem',
            remetente: sender,
            texto: text,
            timestamp: timestamp,
            id: msgId
        });

        // Encaminhar para n8n
        try {
            const body = JSON.stringify({
                remetente: sender,
                texto: text,
                numero: NUMERO,
                timestamp: timestamp
            });
            
            const res = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: body
            });
            
            if (res.ok) {
                const reply = await res.json();
                if (reply?.resposta) {
                    await sock.sendMessage(sender, { text: reply.resposta });
                    console.log(`✅ Resposta enviada para ${sender}`);
                }
            }
        } catch(e) {
            console.log(`⚠️ Erro ao encaminhar para n8n: ${e.message}`);
        }
    });
    
    // Servidor HTTP simples para o n8n enviar mensagens
    const server = http.createServer(async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        
        if (req.method === 'POST' && req.url === '/enviar') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const { para, texto } = data;
                    
                    if (!para || !texto) {
                        res.statusCode = 400;
                        res.end(JSON.stringify({ erro: 'campos obrigatorios: para, texto' }));
                        return;
                    }
                    
                    // Normalizar JID: @lid → @s.whatsapp.net
                    let jid = para;
                    if (jid.includes('@lid')) {
                        const numPart = jid.split('@')[0].replace(/\D/g, '');
                        if (numPart.length >= 7) {
                            jid = numPart + '@s.whatsapp.net';
                            console.log(`🔁 JID normalizado: ${para} → ${jid}`);
                        } else {
                            res.statusCode = 400;
                            res.end(JSON.stringify({ erro: `JID @lid invalido: ${para}` }));
                            return;
                        }
                    }
                    
                    await sock.sendMessage(jid, { text: texto });
                    res.end(JSON.stringify({ status: 'enviado', para, texto }));
                } catch(e) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ erro: e.message }));
                }
            });
        }
        else if (req.method === 'GET' && req.url === '/qrcode') {
            const qrPngPath = '/home/catedral/whatsapp-gateway/qr-code.png';
            try {
                const buf = await fs.readFile(qrPngPath);
                res.setHeader('Content-Type', 'image/png');
                res.setHeader('Cache-Control', 'no-cache');
                res.statusCode = 200;
                res.end(buf);
            } catch(e) {
                res.statusCode = 404;
                res.end(JSON.stringify({ erro: 'QR code nao encontrado. Aguarde o gateway gerar um novo.', detalhe: e.message }));
            }
        }
        else if (req.method === 'POST' && req.url === '/reconnect') {
            console.log('🔄 Forçando reconexão para gerar novo QR...');
            // Limpar sessão para forçar novo QR
            try {
                const dir = '/home/catedral/whatsapp-gateway/session';
                const files = await fs.readdir(dir);
                for (const f of files) {
                    await fs.unlink(path.join(dir, f));
                }
                console.log('🧹 Sessão limpa.');
            } catch(e) {
                console.log('⚠️ Erro ao limpar sessão:', e.message);
            }
            // Encerrar socket e reiniciar
            if (sock) {
                try { sock.end(); } catch(e) {}
                sock = null;
            }
            // A reconexão acontece automaticamente via reconnect handler
            res.end(JSON.stringify({ status: 'reconectando', mensagem: 'Sessão limpa. Novo QR será gerado em instantes.' }));
            
            // Forçar restart da conexão
            setTimeout(() => {
                start().catch(e => console.log('Erro no restart:', e.message));
            }, 1000);
        }
        else if (req.method === 'GET' && req.url === '/status') {
            res.end(JSON.stringify({
                status: sock?.user ? 'conectado' : 'desconectado',
                numero: NUMERO,
                numero_conectado: sock?.user?.id || null
            }));
        }
        else {
            res.statusCode = 404;
            res.end(JSON.stringify({ erro: 'rota nao encontrada' }));
        }
    });
    
    server.listen(HTTP_PORT, '0.0.0.0', () => {
        console.log(`\n🌐 Gateway HTTP: http://0.0.0.0:${HTTP_PORT}`);
        console.log(`   POST /enviar  → Enviar mensagem WhatsApp`);
        console.log(`   GET  /status  → Status da conexão`);
    });

    // WebSocket Server (porta separada)
    const wss = new WebSocketServer({ port: WS_PORT, host: '0.0.0.0' });

    wss.on('connection', (ws) => {
        wsClients.add(ws);
        console.log(`🔌 Cliente WebSocket conectado (${wsClients.size} conectados)`);

        // Enviar status atual ao conectar
        ws.send(JSON.stringify({
            tipo: 'conectado',
            status: sock?.user ? 'conectado' : 'desconectado',
            numero: NUMERO
        }));

        ws.on('message', async (raw) => {
            try {
                const data = JSON.parse(raw.toString());
                
                if (data.tipo === 'enviar') {
                    const { para, texto } = data;
                    
                    if (!para || !texto) {
                        ws.send(JSON.stringify({
                            tipo: 'enviado',
                            status: 'erro',
                            erro: 'campos obrigatorios: para, texto'
                        }));
                        return;
                    }

                    // Normalizar JID: @lid → @s.whatsapp.net
                    let jid = para;
                    if (jid.includes('@lid')) {
                        const numPart = jid.split('@')[0].replace(/\\D/g, '');
                        if (numPart.length >= 7) {
                            jid = numPart + '@s.whatsapp.net';
                            console.log(`🔁 [WS] JID normalizado: ${para} → ${jid}`);
                        } else {
                            ws.send(JSON.stringify({
                                tipo: 'enviado',
                                status: 'erro',
                                erro: `JID @lid invalido: ${para}`
                            }));
                            return;
                        }
                    }

                    await sock.sendMessage(jid, { text: texto });
                    console.log(`✅ [WS] Mensagem enviada para ${jid}`);
                    
                    ws.send(JSON.stringify({
                        tipo: 'enviado',
                        status: 'ok',
                        para: jid,
                        texto
                    }));
                }
            } catch (e) {
                console.log(`⚠️ Erro no WS: ${e.message}`);
                ws.send(JSON.stringify({
                    tipo: 'erro',
                    mensagem: e.message
                }));
            }
        });

        ws.on('close', () => {
            wsClients.delete(ws);
            console.log(`🔌 Cliente WebSocket desconectado (${wsClients.size} conectados)`);
        });

        ws.on('error', (e) => {
            console.log(`⚠️ Erro no WebSocket: ${e.message}`);
            wsClients.delete(ws);
        });
    });

    console.log(`🔌 Gateway WebSocket: ws://0.0.0.0:${WS_PORT}`);
}

// Iniciar
start().catch(e => {
    console.error('Erro fatal:', e);
    process.exit(1);
});
