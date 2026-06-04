#!/usr/bin/env python3
"""
Ponte: api-iurd360.js → IA Supervisionada
Recebe webhooks do api-iurd360 e encaminha pro script IA.

Webhook esperado do api-iurd360.js:
  POST /webhook-incoming  { remetente, texto, pessoa_id, chatId }
"""
import json, http.server, urllib.request

IA_URL = "http://localhost:3099/ia/receber"
PORT = 3098

class BridgeHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length > 0 else b"{}"
        
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            self._respond(400, {"error": "JSON invalido"})
            return
        
        # Forward para IA
        payload = json.dumps({
            "remetente": data.get("remetente", data.get("from", "")),
            "texto": data.get("texto", data.get("body", "")),
            "pessoa_id": data.get("pessoa_id", data.get("id", 0))
        }).encode()
        
        req = urllib.request.Request(IA_URL, data=payload,
            headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                result = json.loads(resp.read())
                self._respond(200, {"status": "forwarded", "ia": result})
        except Exception as e:
            print(f"[Bridge] Erro: {e}")
            self._respond(502, {"error": str(e)})
    
    def do_GET(self):
        self._respond(200, {"status": "bridge_ok", "forward": IA_URL})
    
    def _respond(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def log_message(self, format, *args):
        pass

if __name__ == "__main__":
    server = http.server.HTTPServer(("0.0.0.0", PORT), BridgeHandler)
    print(f"[Bridge] Ponte WAHA→IA rodando na porta {PORT}")
    print(f"[Bridge] Forward: → {IA_URL}")
    server.serve_forever()
