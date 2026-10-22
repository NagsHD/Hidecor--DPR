#!/usr/bin/env python3
"""Local test server for SiteLog.

    python3 serve.py            then open http://localhost:8080

Service workers are allowed on localhost without HTTPS, so install and
offline behaviour can both be tested here before deploying.
To test from a phone on the same Wi-Fi, use the LAN address printed below —
note that the service worker will not register over plain http on a
non-localhost address, so the app will run but not cache offline until
it is on a real HTTPS host.
"""
import http.server, socketserver, socket, os

PORT = int(os.environ.get("PORT", 8080))
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = dict(http.server.SimpleHTTPRequestHandler.extensions_map)
    extensions_map.update({
        ".json": "application/json",
        ".webmanifest": "application/manifest+json",
        ".js": "text/javascript",
    })
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("Service-Worker-Allowed", "/")
        super().end_headers()
    def log_message(self, fmt, *a):
        pass

def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80)); ip = s.getsockname()[0]; s.close()
        return ip
    except Exception:
        return "127.0.0.1"

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), H) as httpd:
    print("SiteLog running")
    print("  this machine : http://localhost:%d" % PORT)
    print("  same Wi-Fi   : http://%s:%d" % (lan_ip(), PORT))
    print("Ctrl+C to stop")
    httpd.serve_forever()
