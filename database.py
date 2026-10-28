import sqlite3
import os
import json
import uuid
from datetime import datetime, date, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), 'gym.db')

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_connection()
    c = conn.cursor()

    c.execute('''
    CREATE TABLE IF NOT EXISTS plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        duration_days INTEGER NOT NULL,
        price REAL NOT NULL,
        description TEXT
    )''')

    c.execute('''
    CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        photo_url TEXT,
        plan_id INTEGER,
        join_date TEXT NOT NULL,
        start_date TEXT NOT NULL,
        expiry_date TEXT NOT NULL,
        status TEXT NOT NULL, -- 'active', 'expired', 'expiring_soon', 'frozen'
        emergency_contact TEXT,
        notes TEXT,
        qr_code_token TEXT UNIQUE NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (plan_id) REFERENCES plans (id)
    )''')

    c.execute('''
    CREATE TABLE IF NOT EXISTS attendance_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id TEXT NOT NULL,
        date TEXT NOT NULL, -- YYYY-MM-DD
        in_time TEXT NOT NULL, -- HH:MM:SS or ISO
        out_time TEXT, -- HH:MM:SS or ISO
        duration_minutes INTEGER,
        status TEXT NOT NULL, -- 'inside', 'completed'
        scan_method TEXT DEFAULT 'qr_scan', -- 'qr_scan', 'manual', 'rfid'
        notes TEXT,
        FOREIGN KEY (member_id) REFERENCES members (id)
    )''')

    # Indices for performance
    c.execute('CREATE INDEX IF NOT EXISTS idx_members_qr ON members (qr_code_token)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_members_status ON members (status)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_logs_date ON attendance_logs (date)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_logs_member ON attendance_logs (member_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_logs_status ON attendance_logs (status)')

    conn.commit()

    # Seed initial plans if empty
    c.execute('SELECT COUNT(*) as cnt FROM plans')
    if c.fetchone()['cnt'] == 0:
        seed_initial_data(conn)

    conn.close()

def seed_initial_data(conn):
    c = conn.cursor()
    plans = [
        ('1 Month Basic', 30, 49.00, 'Standard gym floor access, locker access'),
        ('3 Month Pro', 90, 129.00, 'All-access floor, free fitness assessment, sauna'),
        ('6 Month Elite', 180, 239.00, 'All-access, group classes included, towel service'),
        ('1 Year VIP All-Access', 365, 429.00, '24/7 access, VIP locker room, guest passes, 5 free PT sessions'),
        ('Student Monthly', 30, 35.00, 'Valid student ID required, access Mon-Fri 6AM-5PM')
    ]
    for p in plans:
        c.execute('INSERT INTO plans (name, duration_days, price, description) VALUES (?, ?, ?, ?)', p)

    today = date.today()

    # Create realistic sample members
    members = [
        ('GYM-1001', 'Alexander Vance', '+1 (555) 234-5678', 'alex.vance@example.com',
         'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
         4, (today - timedelta(days=120)).isoformat(), (today - timedelta(days=60)).isoformat(),
         (today + timedelta(days=305)).isoformat(), 'active', 'Sarah Vance (+1 555-987-6543)', 'Prefers morning workouts',
         'QR-GYM-1001', datetime.now().isoformat()),

        ('GYM-1002', 'Marcus Sterling', '+1 (555) 345-6789', 'marcus.s@example.com',
         'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&h=256&q=80',
         2, (today - timedelta(days=70)).isoformat(), (today - timedelta(days=70)).isoformat(),
         (today + timedelta(days=20)).isoformat(), 'active', 'Elena Sterling (+1 555-876-5432)', 'Powerlifting focus',
         'QR-GYM-1002', datetime.now().isoformat()),

        ('GYM-1003', 'Sophia Rodriguez', '+1 (555) 456-7890', 'sophia.r@example.com',
         'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&h=256&q=80',
         1, (today - timedelta(days=28)).isoformat(), (today - timedelta(days=28)).isoformat(),
         (today + timedelta(days=2)).isoformat(), 'expiring_soon', 'Carlos Rodriguez (+1 555-765-4321)', 'Yoga & HIIT enthusiast',
         'QR-GYM-1003', datetime.now().isoformat()),

        ('GYM-1004', 'David Kim', '+1 (555) 567-8901', 'david.kim@example.com',
         'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&h=256&q=80',
         1, (today - timedelta(days=45)).isoformat(), (today - timedelta(days=45)).isoformat(),
         (today - timedelta(days=15)).isoformat(), 'expired', 'Min Kim (+1 555-654-3210)', 'Membership expired, needs renewal follow-up',
         'QR-GYM-1004', datetime.now().isoformat()),

        ('GYM-1005', 'Emma Watson-Lee', '+1 (555) 678-9012', 'emma.wl@example.com',
         'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&h=256&q=80',
         3, (today - timedelta(days=40)).isoformat(), (today - timedelta(days=40)).isoformat(),
         (today + timedelta(days=140)).isoformat(), 'active', 'Mark Lee (+1 555-543-2109)', 'CrossFit training schedule',
         'QR-GYM-1005', datetime.now().isoformat()),

        ('GYM-1006', 'Liam O\'Connor', '+1 (555) 789-0123', 'liam.oc@example.com',
         'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=256&h=256&q=80',
         5, (today - timedelta(days=20)).isoformat(), (today - timedelta(days=20)).isoformat(),
         (today + timedelta(days=10)).isoformat(), 'active', 'Grace O\'Connor (+1 555-432-1098)', 'College athlete student discount',
         'QR-GYM-1006', datetime.now().isoformat()),

        ('GYM-1007', 'Chloe Bennett', '+1 (555) 890-1234', 'chloe.b@example.com',
         'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&h=256&q=80',
         4, (today - timedelta(days=90)).isoformat(), (today - timedelta(days=90)).isoformat(),
         (today + timedelta(days=275)).isoformat(), 'active', 'James Bennett (+1 555-321-0987)', 'Locker #42 assigned',
         'QR-GYM-1007', datetime.now().isoformat())
    ]

    for m in members:
        c.execute('''
        INSERT INTO members (id, name, phone, email, photo_url, plan_id, join_date, start_date, expiry_date, status, emergency_contact, notes, qr_code_token, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', m)

    now = datetime.now()
    t_inside_1 = (now - timedelta(minutes=45)).strftime('%H:%M:%S')
    t_inside_2 = (now - timedelta(minutes=25)).strftime('%H:%M:%S')

    c.execute('''
    INSERT INTO attendance_logs (member_id, date, in_time, out_time, duration_minutes, status, scan_method, notes)
    VALUES (?, ?, ?, NULL, NULL, 'inside', 'qr_scan', 'Workout in progress')
    ''', ('GYM-1001', today.isoformat(), t_inside_1))

    c.execute('''
    INSERT INTO attendance_logs (member_id, date, in_time, out_time, duration_minutes, status, scan_method, notes)
    VALUES (?, ?, ?, NULL, NULL, 'inside', 'qr_scan', 'Workout in progress')
    ''', ('GYM-1002', today.isoformat(), t_inside_2))

    t_in_earlier_1 = (now - timedelta(hours=3, minutes=30)).strftime('%H:%M:%S')
    t_out_earlier_1 = (now - timedelta(hours=2, minutes=15)).strftime('%H:%M:%S')
    c.execute('''
    INSERT INTO attendance_logs (member_id, date, in_time, out_time, duration_minutes, status, scan_method, notes)
    VALUES (?, ?, ?, ?, 75, 'completed', 'qr_scan', 'Leg day completed')
    ''', ('GYM-1005', today.isoformat(), t_in_earlier_1, t_out_earlier_1))

    t_in_earlier_2 = (now - timedelta(hours=4)).strftime('%H:%M:%S')
    t_out_earlier_2 = (now - timedelta(hours=2, minutes=40)).strftime('%H:%M:%S')
    c.execute('''
    INSERT INTO attendance_logs (member_id, date, in_time, out_time, duration_minutes, status, scan_method, notes)
    VALUES (?, ?, ?, ?, 80, 'completed', 'qr_scan', 'Cardio + sauna session')
    ''', ('GYM-1007', today.isoformat(), t_in_earlier_2, t_out_earlier_2))

    for i in range(1, 6):
        past_date = (today - timedelta(days=i)).isoformat()
        c.execute('''
        INSERT INTO attendance_logs (member_id, date, in_time, out_time, duration_minutes, status, scan_method)
        VALUES ('GYM-1001', ?, '07:15:00', '08:30:00', 75, 'completed', 'qr_scan')
        ''', (past_date,))
        c.execute('''
        INSERT INTO attendance_logs (member_id, date, in_time, out_time, duration_minutes, status, scan_method)
        VALUES ('GYM-1005', ?, '18:00:00', '19:10:00', 70, 'completed', 'qr_scan')
        ''', (past_date,))

    conn.commit()

def calculate_member_status(expiry_date_str, current_status):
    if current_status == 'frozen':
        return 'frozen'
    today = date.today()
    try:
        exp_date = datetime.strptime(expiry_date_str, '%Y-%m-%d').date()
        diff = (exp_date - today).days
        if diff < 0:
            return 'expired'
        elif diff <= 5:
            return 'expiring_soon'
        else:
            return 'active'
    except Exception:
        return current_status

def get_member_by_qr_or_id(query):
    import re
    conn = get_connection()
    c = conn.cursor()
    query = query.strip()
    clean_q = query.upper()

    # 1. Direct match (case-insensitive) on token, ID, phone, or name
    c.execute('''
    SELECT m.*, p.name as plan_name, p.duration_days, p.price as plan_price
    FROM members m
    LEFT JOIN plans p ON m.plan_id = p.id
    WHERE UPPER(m.qr_code_token) = ? 
       OR UPPER(m.id) = ? 
       OR m.phone = ?
       OR UPPER(m.name) LIKE ?
    ''', (clean_q, clean_q, query, f"%{clean_q}%"))
    row = c.fetchone()

    # 2. Extract GYM-XXXX pattern (e.g. from pass URLs or qr codes)
    if not row:
        match = re.search(r'(GYM-?\d+)', clean_q)
        if match:
            raw_id = match.group(1)
            formatted_id = raw_id if '-' in raw_id else raw_id.replace('GYM', 'GYM-')
            c.execute('''
            SELECT m.*, p.name as plan_name, p.duration_days, p.price as plan_price
            FROM members m
            LEFT JOIN plans p ON m.plan_id = p.id
            WHERE UPPER(m.id) = ? OR UPPER(m.qr_code_token) = ?
            ''', (formatted_id, f"QR-{formatted_id}"))
            row = c.fetchone()

    # 3. Numeric ID only (e.g. user typed "1009", "1007", "1001")
    if not row and clean_q.isdigit():
        num_id = f"GYM-{clean_q}"
        c.execute('''
        SELECT m.*, p.name as plan_name, p.duration_days, p.price as plan_price
        FROM members m
        LEFT JOIN plans p ON m.plan_id = p.id
        WHERE UPPER(m.id) = ? OR UPPER(m.qr_code_token) = ? OR m.phone LIKE ?
        ''', (num_id, f"QR-{num_id}", f"%{clean_q}%"))
        row = c.fetchone()

    conn.close()
    if not row:
        return None

    member = dict(row)
    member['computed_status'] = calculate_member_status(member['expiry_date'], member['status'])
    try:
        exp_date = datetime.strptime(member['expiry_date'], '%Y-%m-%d').date()
        member['days_left'] = (exp_date - date.today()).days
    except Exception:
        member['days_left'] = 0
    return member

def process_scan(token_or_id, mode='auto', scan_method='qr_scan'):
    member = get_member_by_qr_or_id(token_or_id)
    if not member:
        return {'success': False, 'error': f"Member with QR/ID '{token_or_id}' was not found."}

    conn = get_connection()
    c = conn.cursor()
    today = date.today().isoformat()
    now_dt = datetime.now()
    now_time = now_dt.strftime('%H:%M:%S')

    member_status = calculate_member_status(member['expiry_date'], member['status'])

    # Check if there is an active check-in for this member today
    c.execute('''
    SELECT * FROM attendance_logs
    WHERE member_id = ? AND date = ? AND status = 'inside'
    ORDER BY id DESC LIMIT 1
    ''', (member['id'], today))
    active_log = c.fetchone()

    # Determine action
    if mode == 'auto':
        action = 'out' if active_log else 'in'
    elif mode == 'out':
        action = 'out'
    else:
        action = 'in'

    if action == 'out':
        if not active_log:
            c.execute('''
            INSERT INTO attendance_logs (member_id, date, in_time, out_time, duration_minutes, status, scan_method, notes)
            VALUES (?, ?, ?, ?, ?, 'completed', ?, 'Direct checkout recorded')
            ''', (member['id'], today, now_time, now_time, 0, scan_method))
            log_id = c.lastrowid
            conn.commit()
            conn.close()
            return {
                'success': True,
                'action': 'out',
                'member': member,
                'log_id': log_id,
                'in_time': now_time,
                'out_time': now_time,
                'duration_minutes': 0,
                'duration_formatted': '0 mins',
                'message': f"Checked OUT: {member['name']} (Direct exit).",
                'is_expired': member_status == 'expired'
            }
        else:
            in_time_str = active_log['in_time']
            try:
                in_dt = datetime.strptime(f"{today} {in_time_str}", '%Y-%m-%d %H:%M:%S')
                duration_sec = int((now_dt - in_dt).total_seconds())
                duration_mins = max(1, duration_sec // 60)
            except Exception:
                duration_mins = 0

            hours = duration_mins // 60
            mins = duration_mins % 60
            duration_fmt = f"{hours}h {mins}m" if hours > 0 else f"{mins} mins"

            c.execute('''
            UPDATE attendance_logs
            SET out_time = ?, duration_minutes = ?, status = 'completed'
            WHERE id = ?
            ''', (now_time, duration_mins, active_log['id']))
            conn.commit()
            conn.close()

            return {
                'success': True,
                'action': 'out',
                'member': member,
                'log_id': active_log['id'],
                'in_time': in_time_str,
                'out_time': now_time,
                'duration_minutes': duration_mins,
                'duration_formatted': duration_fmt,
                'message': f"Checked OUT: {member['name']} · Workout completed in {duration_fmt}.",
                'is_expired': member_status == 'expired'
            }

    else:
        # Check-in
        if active_log:
            conn.close()
            return {
                'success': True,
                'action': 'already_inside',
                'member': member,
                'log_id': active_log['id'],
                'in_time': active_log['in_time'],
                'message': f"{member['name']} is already checked in since {active_log['in_time']}.",
                'is_expired': member_status == 'expired'
            }

        c.execute('''
        INSERT INTO attendance_logs (member_id, date, in_time, out_time, duration_minutes, status, scan_method, notes)
        VALUES (?, ?, ?, NULL, NULL, 'inside', ?, 'Workout in progress')
        ''', (member['id'], today, now_time, scan_method))
        log_id = c.lastrowid
        conn.commit()
        conn.close()

        return {
            'success': True,
            'action': 'in',
            'member': member,
            'log_id': log_id,
            'in_time': now_time,
            'message': f"Checked IN: {member['name']} at {now_time}.",
            'is_expired': member_status == 'expired'
        }

def manual_checkout_log(log_id):
    conn = get_connection()
    c = conn.cursor()
    c.execute('SELECT * FROM attendance_logs WHERE id = ?', (log_id,))
    log = c.fetchone()
    if not log:
        conn.close()
        return {'success': False, 'error': 'Log entry not found.'}

    now_dt = datetime.now()
    now_time = now_dt.strftime('%H:%M:%S')
    today = date.today().isoformat()

    try:
        in_dt = datetime.strptime(f"{log['date']} {log['in_time']}", '%Y-%m-%d %H:%M:%S')
        duration_sec = int((now_dt - in_dt).total_seconds())
        duration_mins = max(1, duration_sec // 60)
    except Exception:
        duration_mins = 0

    hours = duration_mins // 60
    mins = duration_mins % 60
    duration_fmt = f"{hours}h {mins}m" if hours > 0 else f"{mins} mins"

    c.execute('''
    UPDATE attendance_logs
    SET out_time = ?, duration_minutes = ?, status = 'completed', notes = 'Staff manual checkout'
    WHERE id = ?
    ''', (now_time, duration_mins, log_id))
    conn.commit()
    conn.close()
    return {'success': True, 'duration_minutes': duration_mins, 'duration_formatted': duration_fmt, 'out_time': now_time}

def get_currently_inside():
    conn = get_connection()
    c = conn.cursor()
    today = date.today().isoformat()
    c.execute('''
    SELECT l.*, m.name, m.phone, m.photo_url, m.expiry_date, m.status as member_status, p.name as plan_name
    FROM attendance_logs l
    JOIN members m ON l.member_id = m.id
    LEFT JOIN plans p ON m.plan_id = p.id
    WHERE l.date = ? AND l.status = 'inside'
    ORDER BY l.in_time DESC
    ''', (today,))
    rows = [dict(r) for r in c.fetchall()]
    conn.close()

    now_dt = datetime.now()
    for r in rows:
        r['computed_status'] = calculate_member_status(r['expiry_date'], r['member_status'])
        try:
            in_dt = datetime.strptime(f"{today} {r['in_time']}", '%Y-%m-%d %H:%M:%S')
            mins = max(0, int((now_dt - in_dt).total_seconds()) // 60)
            hours = mins // 60
            r['elapsed_minutes'] = mins
            r['elapsed_formatted'] = f"{hours}h {mins % 60}m" if hours > 0 else f"{mins}m"
        except Exception:
            r['elapsed_minutes'] = 0
            r['elapsed_formatted'] = '0m'

    return rows

def get_members(search='', status='', plan_id=None):
    conn = get_connection()
    c = conn.cursor()
    today = date.today().isoformat()
    query = '''
    SELECT m.*, p.name as plan_name, p.duration_days, p.price as plan_price,
           (SELECT COUNT(*) FROM attendance_logs a WHERE a.member_id = m.id) as total_visits,
           (SELECT MAX(date || ' ' || in_time) FROM attendance_logs a WHERE a.member_id = m.id) as last_visit,
           EXISTS(SELECT 1 FROM attendance_logs a WHERE a.member_id = m.id AND a.date = ? AND a.status = 'inside') as is_inside_now
    FROM members m
    LEFT JOIN plans p ON m.plan_id = p.id
    WHERE 1=1
    '''
    params = [today]

    if search:
        s = f"%{search.strip()}%"
        query += " AND (m.name LIKE ? OR m.phone LIKE ? OR m.email LIKE ? OR m.id LIKE ?)"
        params.extend([s, s, s, s])

    if plan_id:
        query += " AND m.plan_id = ?"
        params.append(plan_id)

    query += " ORDER BY m.created_at DESC"
    c.execute(query, params)
    rows = [dict(r) for r in c.fetchall()]
    conn.close()

    filtered_rows = []
    for r in rows:
        r['computed_status'] = calculate_member_status(r['expiry_date'], r['status'])
        try:
            exp_date = datetime.strptime(r['expiry_date'], '%Y-%m-%d').date()
            r['days_left'] = (exp_date - date.today()).days
        except Exception:
            r['days_left'] = 0

        if status:
            if status == 'inside':
                if not r['is_inside_now']:
                    continue
            elif r['computed_status'] != status:
                continue

        filtered_rows.append(r)

    return filtered_rows

def get_member(member_id):
    conn = get_connection()
    c = conn.cursor()
    c.execute('''
    SELECT m.*, p.name as plan_name, p.duration_days, p.price as plan_price
    FROM members m
    LEFT JOIN plans p ON m.plan_id = p.id
    WHERE m.id = ?
    ''', (member_id,))
    row = c.fetchone()
    if not row:
        conn.close()
        return None

    member = dict(row)
    member['computed_status'] = calculate_member_status(member['expiry_date'], member['status'])
    try:
        exp_date = datetime.strptime(member['expiry_date'], '%Y-%m-%d').date()
        member['days_left'] = (exp_date - date.today()).days
    except Exception:
        member['days_left'] = 0

    c.execute('''
    SELECT * FROM attendance_logs
    WHERE member_id = ?
    ORDER BY date DESC, in_time DESC LIMIT 20
    ''', (member_id,))
    member['recent_logs'] = [dict(r) for r in c.fetchall()]

    c.execute('SELECT COUNT(*) as cnt, SUM(duration_minutes) as total_min FROM attendance_logs WHERE member_id = ? AND status = "completed"', (member_id,))
    stat = c.fetchone()
    member['total_completed_workouts'] = stat['cnt'] or 0
    member['total_minutes_trained'] = stat['total_min'] or 0

    conn.close()
    return member

def create_member(data):
    conn = get_connection()
    c = conn.cursor()

    c.execute('SELECT COUNT(*) as cnt FROM members')
    count = c.fetchone()['cnt'] + 1
    new_id = f"GYM-{1000 + count}"

    plan_id = int(data.get('plan_id', 1))
    c.execute('SELECT duration_days FROM plans WHERE id = ?', (plan_id,))
    p_row = c.fetchone()
    duration_days = p_row['duration_days'] if p_row else 30

    start_date = data.get('start_date') or date.today().isoformat()
    start_dt = datetime.strptime(start_date, '%Y-%m-%d').date()
    expiry_date = data.get('expiry_date') or (start_dt + timedelta(days=duration_days)).isoformat()

    qr_token = f"QR-{new_id}"
    photo_url = data.get('photo_url') or f"https://api.dicebear.com/7.x/avataaars/svg?seed={new_id}"

    c.execute('''
    INSERT INTO members (id, name, phone, email, photo_url, plan_id, join_date, start_date, expiry_date, status, emergency_contact, notes, qr_code_token, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
    ''', (
        new_id,
        data['name'].strip(),
        data['phone'].strip(),
        data.get('email', '').strip(),
        photo_url,
        plan_id,
        date.today().isoformat(),
        start_date,
        expiry_date,
        data.get('emergency_contact', ''),
        data.get('notes', ''),
        qr_token,
        datetime.now().isoformat()
    ))
    conn.commit()
    conn.close()
    return get_member(new_id)

def update_member(member_id, data):
    conn = get_connection()
    c = conn.cursor()
    c.execute('''
    UPDATE members
    SET name = ?, phone = ?, email = ?, photo_url = ?, plan_id = ?, expiry_date = ?, status = ?, emergency_contact = ?, notes = ?
    WHERE id = ?
    ''', (
        data['name'].strip(),
        data['phone'].strip(),
        data.get('email', '').strip(),
        data.get('photo_url', ''),
        int(data.get('plan_id', 1)),
        data.get('expiry_date'),
        data.get('status', 'active'),
        data.get('emergency_contact', ''),
        data.get('notes', ''),
        member_id
    ))
    conn.commit()
    conn.close()
    return get_member(member_id)

def renew_membership(member_id, plan_id, extend_days=None):
    conn = get_connection()
    c = conn.cursor()
    c.execute('SELECT expiry_date, status FROM members WHERE id = ?', (member_id,))
    row = c.fetchone()
    if not row:
        conn.close()
        return {'success': False, 'error': 'Member not found'}

    today = date.today()
    current_expiry_str = row['expiry_date']

    if extend_days is None or extend_days == 0:
        c.execute('SELECT duration_days FROM plans WHERE id = ?', (plan_id,))
        p = c.fetchone()
        extend_days = p['duration_days'] if p else 30

    try:
        current_expiry = datetime.strptime(current_expiry_str, '%Y-%m-%d').date()
        base_date = current_expiry if current_expiry >= today else today
    except Exception:
        base_date = today

    new_expiry = (base_date + timedelta(days=extend_days)).isoformat()

    c.execute('''
    UPDATE members
    SET expiry_date = ?, plan_id = ?, status = 'active'
    WHERE id = ?
    ''', (new_expiry, plan_id, member_id))
    conn.commit()
    conn.close()
    return {'success': True, 'new_expiry': new_expiry, 'extended_days': extend_days}

def get_attendance_logs(filter_date=None, start_date=None, end_date=None, member_id=None, limit=200):
    conn = get_connection()
    c = conn.cursor()
    query = '''
    SELECT l.*, m.name as member_name, m.phone as member_phone, m.photo_url, p.name as plan_name
    FROM attendance_logs l
    JOIN members m ON l.member_id = m.id
    LEFT JOIN plans p ON m.plan_id = p.id
    WHERE 1=1
    '''
    params = []

    if filter_date:
        query += " AND l.date = ?"
        params.append(filter_date)
    elif start_date and end_date:
        query += " AND l.date BETWEEN ? AND ?"
        params.extend([start_date, end_date])
    elif start_date:
        query += " AND l.date >= ?"
        params.append(start_date)

    if member_id:
        query += " AND l.member_id = ?"
        params.append(member_id)

    query += " ORDER BY l.date DESC, l.in_time DESC LIMIT ?"
    params.append(limit)

    c.execute(query, params)
    rows = [dict(r) for r in c.fetchall()]
    conn.close()

    for r in rows:
        if r['duration_minutes'] is not None:
            hours = r['duration_minutes'] // 60
            mins = r['duration_minutes'] % 60
            r['duration_formatted'] = f"{hours}h {mins}m" if hours > 0 else f"{mins} mins"
        else:
            r['duration_formatted'] = 'In Progress'

    return rows

def get_plans():
    conn = get_connection()
    c = conn.cursor()
    c.execute('SELECT * FROM plans ORDER BY price ASC')
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

def get_dashboard_stats():
    conn = get_connection()
    c = conn.cursor()
    today = date.today().isoformat()

    c.execute('SELECT COUNT(*) as cnt FROM attendance_logs WHERE date = ? AND status = "inside"', (today,))
    inside_count = c.fetchone()['cnt']

    c.execute('SELECT COUNT(*) as cnt FROM attendance_logs WHERE date = ?', (today,))
    today_checkins = c.fetchone()['cnt']

    c.execute('SELECT expiry_date, status FROM members')
    all_members = c.fetchall()

    active_count = 0
    expiring_soon_count = 0
    expired_count = 0

    for m in all_members:
        st = calculate_member_status(m['expiry_date'], m['status'])
        if st == 'active':
            active_count += 1
        elif st == 'expiring_soon':
            expiring_soon_count += 1
        elif st == 'expired':
            expired_count += 1

    c.execute('SELECT AVG(duration_minutes) as avg_dur FROM attendance_logs WHERE date = ? AND duration_minutes IS NOT NULL', (today,))
    avg_dur = c.fetchone()['avg_dur']
    avg_minutes = int(round(avg_dur)) if avg_dur else 65

    conn.close()
    return {
        'inside_count': inside_count,
        'today_checkins': today_checkins,
        'total_members': len(all_members),
        'active_members': active_count,
        'expiring_soon': expiring_soon_count,
        'expired_members': expired_count,
        'avg_workout_minutes': avg_minutes
    }

def delete_member(member_id):
    conn = get_connection()
    c = conn.cursor()
    c.execute('DELETE FROM attendance_logs WHERE member_id = ?', (member_id,))
    c.execute('DELETE FROM members WHERE id = ?', (member_id,))
    deleted = c.rowcount > 0
    conn.commit()
    conn.close()
    return {'success': deleted}

def clear_all_data():
    conn = get_connection()
    c = conn.cursor()
    c.execute('DELETE FROM attendance_logs')
    c.execute('DELETE FROM members')
    conn.commit()
    conn.close()
    return {'success': True}

