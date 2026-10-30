import http.server
import socketserver
import os
import json
import urllib.parse
from datetime import datetime
import database

PORT = int(os.environ.get('PORT', 8080))
STATIC_DIR = os.path.join(os.path.dirname(__file__), 'static')

# Support Render, Railway, and other cloud hosts
RENDER_EXTERNAL_URL = os.environ.get('RENDER_EXTERNAL_URL', '')
RAILWAY_PUBLIC_DOMAIN = os.environ.get('RAILWAY_PUBLIC_DOMAIN', '')

MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.csv': 'text/csv; charset=utf-8'
}

def get_lan_ip():
    try:
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'

def get_public_url():
    """Get the public URL of this deployment (cloud URL or LAN IP for local)."""
    # Cloud Hosts (Render, Railway, Fly, Heroku, etc.)
    if RENDER_EXTERNAL_URL:
        return RENDER_EXTERNAL_URL.rstrip('/')
    if RAILWAY_PUBLIC_DOMAIN:
        return f'https://{RAILWAY_PUBLIC_DOMAIN}'
    if os.environ.get('PUBLIC_URL'):
        return os.environ.get('PUBLIC_URL').rstrip('/')

    # Active local tunnel (for cellular mobile access during dev)
    tunnel_file = os.path.join(os.path.dirname(__file__), '.tunnel_url')
    if os.path.exists(tunnel_file):
        try:
            with open(tunnel_file, 'r') as f:
                turl = f.read().strip()
                if turl:
                    return turl.rstrip('/')
        except Exception:
            pass

    # Local fallback
    return f'http://{get_lan_ip()}:{PORT}'

class GymRequestHandler(http.server.BaseHTTPRequestHandler):
    def send_json(self, data, status_code=200):
        body = json.dumps(data).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_HEAD(self):
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        params = urllib.parse.parse_qs(parsed.query)

        # API Routes
        if path == '/api/health':
            return self.send_json({'status': 'ok', 'timestamp': datetime.now().isoformat()})

        if path == '/api/network-info':
            return self.send_json({'lan_ip': get_lan_ip(), 'port': PORT, 'public_url': get_public_url()})

        if path == '/api/stats':
            stats = database.get_dashboard_stats()
            return self.send_json(stats)

        if path == '/api/plans':
            plans = database.get_plans()
            return self.send_json(plans)

        if path == '/api/inside':
            inside = database.get_currently_inside()
            return self.send_json(inside)

        if path == '/api/members':
            search = params.get('search', [''])[0]
            status = params.get('status', [''])[0]
            plan_id = params.get('plan_id', [None])[0]
            if plan_id:
                try:
                    plan_id = int(plan_id)
                except ValueError:
                    plan_id = None
            members = database.get_members(search=search, status=status, plan_id=plan_id)
            return self.send_json(members)

        if path.startswith('/api/members/'):
            member_id = path.replace('/api/members/', '').strip('/')
            member = database.get_member(member_id)
            if member:
                return self.send_json(member)
            else:
                return self.send_json({'error': 'Member not found'}, status_code=404)

        if path == '/api/attendance':
            filter_date = params.get('date', [None])[0]
            start_date = params.get('start_date', [None])[0]
            end_date = params.get('end_date', [None])[0]
            member_id = params.get('member_id', [None])[0]
            logs = database.get_attendance_logs(
                filter_date=filter_date,
                start_date=start_date,
                end_date=end_date,
                member_id=member_id
            )
            return self.send_json(logs)

        if path == '/api/backup':
            db_path = database.DB_PATH
            if not os.path.exists(db_path):
                return self.send_json({'error': 'Database file not found'}, status_code=404)
            with open(db_path, 'rb') as f:
                db_data = f.read()
            filename = f"sprint_fitness_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
            self.send_response(200)
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
            self.send_header('Content-Length', str(len(db_data)))
            self.end_headers()
            self.wfile.write(db_data)
            return

        if path == '/api/members/export':
            members = database.get_members()
            csv_lines = ['Member ID,Name,Phone,Email,Plan,Price,Join Date,Expiry Date,Days Left,Status,Emergency Contact,Notes']
            for m in members:
                line = f"{m['id']},\"{m['name']}\",{m['phone']},{m['email']},\"{m['plan_name']}\",{m['plan_price']},{m['join_date']},{m['expiry_date']},{m['days_left']},{m['status']},\"{m.get('emergency_contact','')}\",\"{m.get('notes','')}\""
                csv_lines.append(line)
            csv_data = '\n'.join(csv_lines).encode('utf-8')
            filename = f"sprint_members_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            self.send_response(200)
            self.send_header('Content-Type', 'text/csv; charset=utf-8')
            self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
            self.send_header('Content-Length', str(len(csv_data)))
            self.end_headers()
            self.wfile.write(csv_data)
            return

        if path == '/api/attendance/export':
            filter_date = params.get('date', [None])[0]
            start_date = params.get('start_date', [None])[0]
            end_date = params.get('end_date', [None])[0]
            logs = database.get_attendance_logs(
                filter_date=filter_date,
                start_date=start_date,
                end_date=end_date,
                limit=10000
            )

            # Build CSV
            csv_lines = ['Log ID,Member ID,Name,Phone,Plan,Date,In Time,Out Time,Duration (Mins),Status,Scan Method,Notes']
            for l in logs:
                dur = l['duration_minutes'] if l['duration_minutes'] is not None else ''
                out_t = l['out_time'] or ''
                notes = (l['notes'] or '').replace(',', ';')
                line = f"{l['id']},{l['member_id']},\"{l['member_name']}\",{l['member_phone']},\"{l['plan_name']}\",{l['date']},{l['in_time']},{out_t},{dur},{l['status']},{l['scan_method']},\"{notes}\""
                csv_lines.append(line)

            csv_data = '\n'.join(csv_lines).encode('utf-8')
            filename = f"gym_attendance_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            self.send_response(200)
            self.send_header('Content-Type', 'text/csv; charset=utf-8')
            self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
            self.send_header('Content-Length', str(len(csv_data)))
            self.end_headers()
            self.wfile.write(csv_data)
            return

        # Serve static files
        return self.serve_static(path)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        content_length = int(self.headers.get('Content-Length', 0))
        post_body = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else '{}'
        try:
            payload = json.loads(post_body)
        except Exception:
            payload = {}

        if path == '/api/restore':
            raw_bytes = b''
            if isinstance(payload, dict) and payload.get('db_base64'):
                import base64
                raw_bytes = base64.b64decode(payload['db_base64'])
            elif post_body:
                raw_bytes = post_body.encode('latin1')
            if len(raw_bytes) < 100:
                return self.send_json({'success': False, 'error': 'Invalid backup file content.'}, status_code=400)
            temp_db = database.DB_PATH + '.restore'
            with open(temp_db, 'wb') as f:
                f.write(raw_bytes)
            with open(temp_db, 'rb') as f:
                if f.read(16) != b'SQLite format 3\x00':
                    os.remove(temp_db)
                    return self.send_json({'success': False, 'error': 'File is not a valid SQLite database backup.'}, status_code=400)
            os.replace(temp_db, database.DB_PATH)
            return self.send_json({'success': True, 'message': 'Database restored successfully!'})

        if path == '/api/scan':
            token = payload.get('token', '').strip()
            mode = payload.get('mode', 'auto')
            method = payload.get('method', 'qr_scan')
            if not token:
                return self.send_json({'success': False, 'error': 'No QR code or Member ID provided.'}, status_code=400)

            result = database.process_scan(token, mode=mode, scan_method=method)
            return self.send_json(result)

        if path == '/api/manual-checkout':
            log_id = payload.get('log_id')
            if not log_id:
                return self.send_json({'success': False, 'error': 'Missing log_id.'}, status_code=400)
            result = database.manual_checkout_log(log_id)
            return self.send_json(result)

        if path == '/api/members':
            if not payload.get('name') or not payload.get('phone'):
                return self.send_json({'success': False, 'error': 'Name and phone are required.'}, status_code=400)
            new_member = database.create_member(payload)
            return self.send_json(new_member, status_code=201)

        if path.startswith('/api/members/') and path.endswith('/renew'):
            parts = path.split('/')
            member_id = parts[3]
            plan_id = payload.get('plan_id', 1)
            extend_days = payload.get('extend_days', None)
            res = database.renew_membership(member_id, plan_id, extend_days)
            return self.send_json(res)

        if path == '/api/reset-data':
            res = database.clear_all_data()
            return self.send_json(res)

        return self.send_json({'error': 'Route not found'}, status_code=404)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith('/api/members/'):
            member_id = path.replace('/api/members/', '').strip('/')
            res = database.delete_member(member_id)
            return self.send_json(res)

        return self.send_json({'error': 'Route not found'}, status_code=404)

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        content_length = int(self.headers.get('Content-Length', 0))
        post_body = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else '{}'
        try:
            payload = json.loads(post_body)
        except Exception:
            payload = {}

        if path.startswith('/api/members/'):
            member_id = path.replace('/api/members/', '').strip('/')
            updated = database.update_member(member_id, payload)
            if updated:
                return self.send_json(updated)
            else:
                return self.send_json({'error': 'Member not found'}, status_code=404)

        return self.send_json({'error': 'Route not found'}, status_code=404)

    def serve_static(self, path):
        if path == '/' or path == '':
            file_path = os.path.join(STATIC_DIR, 'index.html')
        elif path == '/pass':
            file_path = os.path.join(STATIC_DIR, 'pass.html')
        else:
            rel_path = path.lstrip('/')
            file_path = os.path.join(STATIC_DIR, rel_path)

        if not os.path.exists(file_path) or os.path.isdir(file_path):
            file_path = os.path.join(STATIC_DIR, 'index.html')

        ext = os.path.splitext(file_path)[1].lower()
        content_type = MIME_TYPES.get(ext, 'application/octet-stream')

        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server error: {e}".encode('utf-8'))

    def log_message(self, format, *args):
        # Clean logging
        pass

def run():
    database.init_db()
    server_address = ('', PORT)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(server_address, GymRequestHandler)
    print(f"================================================================")
    print(f" Sprint Fitness Studio Attendance & Membership Server (Port {PORT})")
    print(f" Open http://localhost:{PORT} in your browser")
    print(f"================================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.server_close()

if __name__ == '__main__':
    run()
