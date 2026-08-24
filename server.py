"""
Servidor local de "Mi Entrenamiento" (PWA).
Sirve la app en la red local y recibe la sincronización desde el celular.

Uso:
    python server.py [puerto]        (por defecto 8787)
    python server.py 8787

Endpoints:
    GET  /        → app (index.html)
    GET  /datos   → JSON consolidado {comidas, entrenos}
    POST /sync    → merge por id y guardado; devuelve datos consolidados
    GET  /health  → {ok: true}

Dependencias: solo stdlib. Sin instalación.
"""
import json
import os
import shutil
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "datos"
COMIDAS_FILE = DATA_DIR / "comidas.json"
ENTRENOS_FILE = DATA_DIR / "entrenos.json"
PORT = 8787

MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".ico": "image/x-icon",
}

LOCK = threading.Lock()


def load_json(path):
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        # ante un archivo corrupto, respaldo y partimos de cero
        backup = path.with_suffix(path.suffix + ".bak")
        shutil.copy2(path, backup)
        return []


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def merge_by_id(local, incoming):
    """Merge consolidando por id. El servidor es la fuente de verdad final:
    si llega un registro con el mismo id, se reemplaza (refleja ediciones)."""
    by_id = {r["id"]: r for r in local}
    for r in incoming:
        if isinstance(r, dict) and isinstance(r.get("id"), str):
            by_id[r["id"]] = r
    merged = sorted(by_id.values(), key=lambda r: (r.get("fecha", ""), r.get("hora", "")))
    return merged


def as_list(value):
    return value if isinstance(value, list) else []


def get_all():
    return load_json(COMIDAS_FILE), load_json(ENTRENOS_FILE)


def do_sync(payload):
    with LOCK:
        comidas = merge_by_id(load_json(COMIDAS_FILE), as_list(payload.get("comidas")))
        entrenos = merge_by_id(load_json(ENTRENOS_FILE), as_list(payload.get("entrenos")))
        save_json(COMIDAS_FILE, comidas)
        save_json(ENTRENOS_FILE, entrenos)
        return {"comidas": comidas, "entrenos": entrenos}


class Handler(BaseHTTPRequestHandler):
    server_version = "MiEntrenamiento/1.0"

    def log_message(self, fmt, *args):
        print(f"[{time.strftime('%H:%M:%S')}] {self.address_string()} {fmt % args}")

    def _send_json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _serve_static(self, path):
        # seguridad: evitar path traversal (commonpath, no startswith)
        rel = path.lstrip("/")
        if not rel or rel == "index.html":
            rel = "index.html"
        file_path = (BASE_DIR / rel).resolve()
        try:
            common = Path(os.path.commonpath([str(BASE_DIR.resolve()), str(file_path)]))
        except ValueError:
            common = Path(".")
        if common != BASE_DIR.resolve():
            self._send_json(403, {"error": "forbidden"})
            return
        if not file_path.exists() or not file_path.is_file():
            self._send_json(404, {"error": "not found"})
            return
        mime = MIME.get(file_path.suffix.lower(), "application/octet-stream")
        body = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            return self._send_json(200, {"ok": True})
        if self.path == "/datos":
            comidas, entrenos = get_all()
            return self._send_json(200, {"comidas": comidas, "entrenos": entrenos})
        path = self.path.split("?")[0]
        self._serve_static(path)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        if self.path.split("?")[0] != "/sync":
            return self._send_json(404, {"error": "not found"})
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length <= 0:
                return self._send_json(400, {"error": "empty body"})
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(payload, dict):
                return self._send_json(400, {"error": "invalid payload"})
            result = do_sync(payload)
            return self._send_json(200, result)
        except (json.JSONDecodeError, UnicodeDecodeError):
            return self._send_json(400, {"error": "invalid json"})
        except Exception as exc:  # noqa: BLE001 — responder siempre, nunca dejar la conexión colgada
            return self._send_json(500, {"error": "internal: " + type(exc).__name__})


def main():
    import sys

    global PORT
    if len(sys.argv) > 1:
        try:
            PORT = int(sys.argv[1])
        except ValueError:
            print(f"Puerto inválido: {sys.argv[1]}")
            sys.exit(1)

    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    ip = "0.0.0.0"
    print("=" * 52)
    print("  Mi Entrenamiento — servidor local")
    print("=" * 52)
    print(f"  Servidor:  http://{ip}:{PORT}")
    print("  Datos:     " + str(DATA_DIR))
    print("  Detén con: Ctrl+C")
    print("=" * 52)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nDetenido.")


if __name__ == "__main__":
    main()
