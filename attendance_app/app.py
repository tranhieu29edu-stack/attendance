import os
import time
import threading
import requests
import json
import base64
from datetime import datetime, timezone
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# GitHub Config (Primary Storage)
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')
GITHUB_REPO = os.getenv('GITHUB_REPO') # format: username/repo
GITHUB_PATH = os.getenv('GITHUB_PATH', 'attendance_data.json')

# JSONBin Config (Backup Storage)
JSONBIN_API_KEY = os.getenv('JSONBIN_API_KEY', '$2b$10$EXAMPLE_KEY')
JSONBIN_BIN_ID = os.getenv('JSONBIN_BIN_ID')
JSONBIN_URL = f'https://api.jsonbin.io/v3/b/{JSONBIN_BIN_ID}'

# Local fallback
LOCAL_DATA_FILE = 'attendance_data.json'

def get_data_github():
    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{GITHUB_PATH}"
    headers = {"Authorization": f"token {GITHUB_TOKEN}"}
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            content = base64.b64decode(response.json()['content']).decode('utf-8')
            data = json.loads(content)
            return data, response.json()['sha']
        return {'logs': [], 'active_sessions': {}}, None
    except Exception as e:
        print(f"GitHub Get Error: {e}")
        return {'logs': [], 'active_sessions': {}}, None

def save_data_github(data, sha):
    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{GITHUB_PATH}"
    headers = {"Authorization": f"token {GITHUB_TOKEN}", "Content-Type": "application/json"}
    content_base64 = base64.b64encode(json.dumps(data, indent=2, ensure_ascii=False).encode('utf-8')).decode('utf-8')
    payload = {
        "message": f"Update attendance data {datetime.now().isoformat()}",
        "content": content_base64,
        "sha": sha
    }
    try:
        requests.put(url, headers=headers, json=payload)
    except Exception as e:
        print(f"GitHub Save Error: {e}")

def get_data():
    if GITHUB_TOKEN and GITHUB_REPO:
        data, _ = get_data_github()
        return data
    
    if JSONBIN_BIN_ID and JSONBIN_API_KEY != '$2b$10$EXAMPLE_KEY':
        try:
            headers = {'X-Master-Key': JSONBIN_API_KEY}
            response = requests.get(JSONBIN_URL, headers=headers)
            return response.json().get('record', {'logs': [], 'active_sessions': {}})
        except Exception as e:
            print(f"JSONBin Error: {e}")
            return {'logs': [], 'active_sessions': {}}
    else:
        if os.path.exists(LOCAL_DATA_FILE):
            with open(LOCAL_DATA_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if 'active_sessions' not in data: data['active_sessions'] = {}
                if 'logs' not in data: data['logs'] = []
                return data
        return {'logs': [], 'active_sessions': {}}

def save_data(data):
    if GITHUB_TOKEN and GITHUB_REPO:
        _, sha = get_data_github()
        save_data_github(data, sha)
        return

    if JSONBIN_BIN_ID and JSONBIN_API_KEY != '$2b$10$EXAMPLE_KEY':
        try:
            headers = {'X-Master-Key': JSONBIN_API_KEY, 'Content-Type': 'application/json'}
            requests.put(JSONBIN_URL, headers=headers, json=data)
        except Exception as e:
            print(f"JSONBin Save Error: {e}")
    else:
        with open(LOCAL_DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

@app.route('/api/check_user', methods=['GET'])
def check_user():
    name = request.args.get('name', '').strip().title()
    if not name: return jsonify({'exists': False})
    data = get_data()
    exists = any(log['name'] == name for log in data.get('logs', []))
    if not exists: exists = name in data.get('active_sessions', {})
    return jsonify({'exists': exists})

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/status', methods=['GET'])
def get_status():
    name = request.args.get('name', '').strip().title()
    data = get_data()
    session_info = data.get('active_sessions', {}).get(name)
    if session_info:
        if isinstance(session_info, dict):
            return jsonify({'is_running': True, 'start_time': session_info.get('start_time'), 'job': session_info.get('job', '')})
        else:
            return jsonify({'is_running': True, 'start_time': session_info, 'job': ''})
    return jsonify({'is_running': False})

@app.route('/api/start', methods=['POST'])
def start_attendance():
    name = request.json.get('name', '').strip().title()
    job = request.json.get('job', '').strip()
    if not name: return jsonify({'success': False, 'message': 'Name is required'}), 400
    data = get_data()
    data['active_sessions'][name] = {'start_time': datetime.now().isoformat(), 'job': job}
    save_data(data)
    return jsonify({'success': True})

@app.route('/api/stop', methods=['POST'])
def stop_attendance():
    name = request.json.get('name', '').strip().title()
    data = get_data()
    session_info = data.get('active_sessions', {}).pop(name, None)
    if not session_info: return jsonify({'success': False, 'message': 'No active session'}), 400
    if isinstance(session_info, dict):
        start_time_iso = session_info['start_time']
        job = session_info.get('job', '')
    else:
        start_time_iso = session_info
        job = ''
    start_time = datetime.fromisoformat(start_time_iso)
    end_time = datetime.now()
    duration = end_time - start_time
    log_entry = {
        'name': name, 'job': job, 'date': start_time.strftime('%Y-%m-%d'),
        'start': start_time.strftime('%H:%M:%S'), 'stop': end_time.strftime('%H:%M:%S'),
        'duration_seconds': int(duration.total_seconds()), 'duration_str': str(duration).split('.')[0],
        'is_paid': False, 'payment_id': None
    }
    data['logs'].append(log_entry)
    save_data(data)
    return jsonify({'success': True})

@app.route('/api/logs', methods=['GET'])
def get_logs():
    name = request.args.get('name', '').strip().title()
    data = get_data()
    all_logs = data.get('logs', [])
    unpaid_logs = [log for log in all_logs if log['name'] == name and not log.get('is_paid', False)]
    total_seconds = sum(log['duration_seconds'] for log in unpaid_logs)
    total_minutes_rounded = round(total_seconds / 60)
    confirm_val = f"{total_minutes_rounded // 60} giờ {total_minutes_rounded % 60} phút"
    from datetime import timezone
    total_str = str(datetime.fromtimestamp(total_seconds, timezone.utc).strftime('%H:%M:%S')) if total_seconds < 86400 else f"{total_seconds//3600}h {(total_seconds%3600)//60}m"
    paid_logs = [log for log in all_logs if log['name'] == name and log.get('is_paid', False)]
    batches = {}
    for log in paid_logs:
        pid = log.get('payment_id', 'Unknown')
        if pid not in batches: batches[pid] = {'id': pid, 'logs': [], 'total_seconds': 0, 'start_date': log['date'], 'end_date': log['date']}
        b = batches[pid]
        b['logs'].append(log)
        b['total_seconds'] += log['duration_seconds']
        if log['date'] < b['start_date']: b['start_date'] = log['date']
        if log['date'] > b['end_date']: b['end_date'] = log['date']
    paid_batches = []
    for pid in sorted(batches.keys(), reverse=True):
        b = batches[pid]
        paid_batches.append({
            'date_range': f"{b['start_date']} đến {b['end_date']}", 'total_hours': round(b['total_seconds'] / 3600, 2),
            'total_str': str(datetime.fromtimestamp(b['total_seconds'], timezone.utc).strftime('%H:%M:%S')) if b['total_seconds'] < 86400 else f"{b['total_seconds']//3600}h {(b['total_seconds']%3600)//60}m"
        })
    return jsonify({'unpaid_logs': unpaid_logs, 'total_seconds': total_seconds, 'total_hours': round(total_seconds / 3600, 2), 'total_str': total_str, 'confirm_val': confirm_val, 'paid_batches': paid_batches})

@app.route('/api/pay', methods=['POST'])
def confirm_payment():
    name = request.json.get('name', '').strip().title()
    data = get_data()
    payment_id = datetime.now().strftime('%Y%m%d_%H%M%S')
    count = 0
    for log in data.get('logs', []):
        if log['name'] == name and not log.get('is_paid', False):
            log['is_paid'] = True
            log['payment_id'] = payment_id
            count += 1
    save_data(data)
    return jsonify({'success': True, 'count': count})

@app.route('/health')
def health(): return "OK", 200

def heartbeat():
    time.sleep(10)
    app_url = os.getenv('RENDER_EXTERNAL_URL') or 'http://127.0.0.1:5000'
    while True:
        try: requests.get(f"{app_url}/health")
        except: pass
        time.sleep(600)

if __name__ == '__main__':
    threading.Thread(target=heartbeat, daemon=True).start()
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
