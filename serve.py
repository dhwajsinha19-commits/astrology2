#!/usr/bin/env python3
"""Tiny no-cache static server:  python3 serve.py [port]  ->  http://localhost:5311"""
import http.server, socketserver, sys

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 5311
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', port), Handler) as srv:
    print(f'Jyotish on http://localhost:{port}')
    srv.serve_forever()
