"""
英语听力听写网站 - Flask 主程序
提供 RESTful API，按九级能力等级管理练习集和听写句
支持游客试用和微信扫码登录，学习进度追踪
"""

import os
import uuid
import random
import string
from datetime import datetime

import requests
from flask import Flask, request, jsonify, send_file, session, redirect, url_for
from flask_cors import CORS
from database import get_db, init_db

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app, supports_credentials=True)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, 'uploads')
AUDIO_DIR = os.path.join(BASE_DIR, 'audio')

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(AUDIO_DIR, exist_ok=True)

# ==================== 配置 ====================

# 微信开放平台配置（部署前替换为真实值）
WECHAT_APP_ID = os.environ.get('WECHAT_APP_ID', 'your_app_id_here')
WECHAT_APP_SECRET = os.environ.get('WECHAT_APP_SECRET', 'your_app_secret_here')
WECHAT_REDIRECT_URI = os.environ.get(
    'WECHAT_REDIRECT_URI',
    'http://localhost:5000/api/auth/wechat/callback'
)

app.secret_key = os.environ.get('SECRET_KEY', os.urandom(24).hex())


# ==================== 装饰器 ====================

def login_required(f):
    """要求登录的装饰器（游客也可通过）"""
    from functools import wraps

    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': '请先登录', 'code': 'NOT_LOGGED_IN'}), 401
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    """要求管理员权限的装饰器"""
    from functools import wraps

    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': '请先登录', 'code': 'NOT_LOGGED_IN'}), 401
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT is_admin FROM users WHERE id = ?", (session['user_id'],))
        user = cur.fetchone()
        conn.close()
        if not user or not user['is_admin']:
            return jsonify({'error': '需要管理员权限', 'code': 'ADMIN_REQUIRED'}), 403
        return f(*args, **kwargs)
    return decorated


# ==================== 静态页面 ====================

@app.route('/')
def index():
    if 'user_id' not in session:
        return app.send_static_file('login.html')
    return app.send_static_file('index.html')


@app.route('/login')
def login():
    return app.send_static_file('login.html')


# ==================== API：登录 / 用户 ====================

@app.route('/api/auth/guest', methods=['POST'])
def guest_login():
    """创建游客会话"""
    conn = get_db()
    cur = conn.cursor()

    # 为游客生成唯一临时标识
    guest_id = 'guest_' + uuid.uuid4().hex[:16]
    cur.execute(
        "INSERT INTO users (openid, nickname, role) VALUES (?, ?, ?)",
        (guest_id, '游客' + guest_id[-4:], 'user')
    )
    conn.commit()
    user_id = cur.lastrowid
    conn.close()

    session['user_id'] = user_id
    session['is_guest'] = True

    return jsonify({
        'user_id': user_id,
        'nickname': '游客',
        'is_guest': True,
        'message': '游客登录成功'
    })


@app.route('/api/auth/wechat/url', methods=['GET'])
def wechat_auth_url():
    """返回微信 OAuth 授权 URL"""
    state = ''.join(random.choices(string.ascii_letters + string.digits, k=32))
    session['wechat_state'] = state

    auth_url = (
        'https://open.weixin.qq.com/connect/qrconnect'
        f'?appid={WECHAT_APP_ID}'
        f'&redirect_uri={requests.utils.quote(WECHAT_REDIRECT_URI, safe="")}'
        f'&response_type=code'
        f'&scope=snsapi_login'
        f'&state={state}'
        '#wechat_redirect'
    )

    return jsonify({'url': auth_url})


@app.route('/api/auth/wechat/callback', methods=['GET'])
def wechat_callback():
    """微信 OAuth 回调：用 code 换取 access_token，获取用户信息"""
    code = request.args.get('code')
    state = request.args.get('state')

    if not code:
        return jsonify({'error': '缺少 code 参数'}), 400

    # 校验 state（防 CSRF）
    saved_state = session.pop('wechat_state', None)
    if saved_state and state != saved_state:
        return jsonify({'error': 'state 校验失败'}), 403

    # 1. 用 code 换取 access_token
    token_url = 'https://api.weixin.qq.com/sns/oauth2/access_token'
    token_params = {
        'appid': WECHAT_APP_ID,
        'secret': WECHAT_APP_SECRET,
        'code': code,
        'grant_type': 'authorization_code',
    }
    try:
        token_resp = requests.get(token_url, params=token_params, timeout=10)
        token_data = token_resp.json()
    except Exception:
        return jsonify({'error': '请求微信服务器失败'}), 502

    if 'errcode' in token_data:
        return jsonify({'error': token_data.get('errmsg', '微信认证失败')}), 400

    access_token = token_data.get('access_token')
    openid = token_data.get('openid')
    unionid = token_data.get('unionid', '')

    # 2. 用 access_token 获取用户信息
    userinfo_url = 'https://api.weixin.qq.com/sns/userinfo'
    userinfo_params = {
        'access_token': access_token,
        'openid': openid,
    }
    try:
        userinfo_resp = requests.get(userinfo_url, params=userinfo_params, timeout=10)
        userinfo = userinfo_resp.json()
    except Exception:
        userinfo = {}

    nickname = userinfo.get('nickname', '微信用户')
    avatar_url = userinfo.get('headimgurl', '')

    # 3. 查找或创建用户
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE openid = ?", (openid,))
    row = cur.fetchone()

    if row:
        user_id = row['id']
        cur.execute(
            "UPDATE users SET nickname=?, avatar_url=?, unionid=?, last_login=CURRENT_TIMESTAMP WHERE id=?",
            (nickname, avatar_url, unionid, user_id)
        )
    else:
        cur.execute(
            "INSERT INTO users (openid, unionid, nickname, avatar_url) VALUES (?,?,?,?)",
            (openid, unionid, nickname, avatar_url)
        )
        user_id = cur.lastrowid

    conn.commit()
    conn.close()

    session['user_id'] = user_id
    session['is_guest'] = False

    # 重定向回首页
    return redirect('/')


@app.route('/api/auth/status', methods=['GET'])
def auth_status():
    """返回当前登录状态"""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'logged_in': False})

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, nickname, avatar_url, role, is_admin, openid FROM users WHERE id = ?", (user_id,))
    user = cur.fetchone()
    conn.close()

    if not user:
        session.clear()
        return jsonify({'logged_in': False})

    is_guest = session.get('is_guest', False) or (user['openid'] or '').startswith('guest_')
    return jsonify({
        'logged_in': True,
        'user_id': user['id'],
        'nickname': user['nickname'],
        'avatar_url': user['avatar_url'],
        'role': user['role'],
        'is_admin': bool(user['is_admin']),
        'is_guest': is_guest,
    })


@app.route('/api/auth/logout', methods=['POST'])
def logout():
    """清除 session"""
    session.clear()
    return jsonify({'message': '已退出登录'})


# ==================== API：管理员登录 ====================

@app.route('/api/auth/admin/login', methods=['POST'])
def admin_login():
    """管理员账号密码登录"""
    import hashlib
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'error': '账号和密码不能为空'}), 400

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, nickname, role, is_admin FROM users WHERE username = ? AND is_admin = 1",
        (username,)
    )
    user = cur.fetchone()

    if not user:
        conn.close()
        return jsonify({'error': '账号不存在或无管理员权限'}), 401

    pw_hash = hashlib.sha256(password.encode()).hexdigest()
    cur.execute("SELECT password_hash FROM users WHERE id = ?", (user['id'],))
    stored = cur.fetchone()
    conn.close()

    if stored['password_hash'] != pw_hash:
        return jsonify({'error': '密码错误'}), 401

    session['user_id'] = user['id']
    session['is_guest'] = False
    session['is_admin'] = True

    return jsonify({
        'success': True,
        'user_id': user['id'],
        'nickname': user['nickname'],
        'role': user['role'],
        'is_admin': True,
        'message': '管理员登录成功'
    })


# ==================== 管理后台页面 ====================

@app.route('/admin')
def admin_page():
    """管理后台入口，非管理员重定向到首页"""
    if 'user_id' not in session:
        return redirect('/login')
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT is_admin FROM users WHERE id = ?", (session['user_id'],))
    user = cur.fetchone()
    conn.close()
    if not user or not user['is_admin']:
        return redirect('/')
    return app.send_static_file('admin.html')


# ==================== API：学习进度 ====================

@app.route('/api/progress', methods=['POST'])
@login_required
def save_progress():
    """提交听写结果"""
    data = request.get_json()
    user_id = session['user_id']

    exercise_id = data.get('exercise_id')
    dictation_id = data.get('dictation_id')
    user_input = data.get('user_input', '')
    total_words = data.get('total_words', 0)
    correct_words = data.get('correct_words', 0)
    completed = data.get('completed', False)

    if not exercise_id or not dictation_id:
        return jsonify({'error': '缺少 exercise_id 或 dictation_id'}), 400

    conn = get_db()
    cur = conn.cursor()

    # 检查是否已有记录（用于累加 attempts）
    cur.execute(
        "SELECT id, attempts FROM progress WHERE user_id=? AND dictation_id=?",
        (user_id, dictation_id)
    )
    existing = cur.fetchone()

    if existing:
        new_attempts = existing['attempts'] + 1
        cur.execute(
            """UPDATE progress
               SET exercise_id=?, user_input=?, total_words=?, correct_words=?,
                   completed=?, attempts=?, created_at=CURRENT_TIMESTAMP
               WHERE id=?""",
            (exercise_id, user_input, total_words, correct_words, completed, new_attempts, existing['id'])
        )
    else:
        cur.execute(
            """INSERT INTO progress (user_id, exercise_id, dictation_id, user_input,
               total_words, correct_words, completed, attempts)
               VALUES (?,?,?,?,?,?,?,1)""",
            (user_id, exercise_id, dictation_id, user_input, total_words, correct_words, completed)
        )

    conn.commit()
    conn.close()

    return jsonify({'message': '进度已保存'})


@app.route('/api/progress', methods=['GET'])
@login_required
def get_progress():
    """获取当前用户在某练习集的进度"""
    user_id = session['user_id']
    exercise_id = request.args.get('exercise_id', type=int)

    conn = get_db()
    cur = conn.cursor()

    if exercise_id:
        cur.execute(
            "SELECT * FROM progress WHERE user_id=? AND exercise_id=? ORDER BY created_at DESC",
            (user_id, exercise_id)
        )
    else:
        cur.execute(
            "SELECT * FROM progress WHERE user_id=? ORDER BY created_at DESC",
            (user_id,)
        )

    rows = cur.fetchall()
    conn.close()

    return jsonify([dict(row) for row in rows])


@app.route('/api/progress/stats', methods=['GET'])
@login_required
def get_stats():
    """获取当前用户的学习统计"""
    user_id = session['user_id']

    conn = get_db()
    cur = conn.cursor()

    # 总练习句数
    cur.execute("SELECT COUNT(*) AS cnt FROM progress WHERE user_id=?", (user_id,))
    total_dictations = cur.fetchone()['cnt']

    # 总正确词数和总词数
    cur.execute(
        "SELECT SUM(correct_words) AS cw, SUM(total_words) AS tw FROM progress WHERE user_id=?",
        (user_id,)
    )
    row = cur.fetchone()
    total_correct = row['cw'] or 0
    total_words = row['tw'] or 0
    accuracy = round((total_correct / total_words) * 100, 1) if total_words > 0 else 0

    # 完成的句数
    cur.execute("SELECT COUNT(*) AS cnt FROM progress WHERE user_id=? AND completed=1", (user_id,))
    completed_count = cur.fetchone()['cnt']

    # 各阶段完成度
    cur.execute("""
        SELECT e.stage, COUNT(DISTINCT p.dictation_id) AS done
        FROM progress p
        JOIN dictations d ON p.dictation_id = d.id
        JOIN exercises e ON d.exercise_id = e.id
        WHERE p.user_id=? AND p.completed=1
        GROUP BY e.stage
    """, (user_id,))
    stage_stats = {row['stage']: row['done'] for row in cur.fetchall()}

    conn.close()

    return jsonify({
        'total_dictations': total_dictations,
        'completed_count': completed_count,
        'total_correct_words': total_correct,
        'total_words': total_words,
        'accuracy': accuracy,
        'stage_stats': stage_stats,
    })


# ==================== API：练习集 ====================

@app.route('/api/exercises', methods=['GET'])
def get_exercises():
    conn = get_db()
    cur = conn.cursor()

    level = request.args.get('level', type=int)

    if level:
        cur.execute('''
            SELECT e.*, COUNT(d.id) AS dictation_count
            FROM exercises e
            LEFT JOIN dictations d ON e.id = d.exercise_id
            WHERE e.level = ?
            GROUP BY e.id
            ORDER BY e.level ASC
        ''', (level,))
    else:
        cur.execute('''
            SELECT e.*, COUNT(d.id) AS dictation_count
            FROM exercises e
            LEFT JOIN dictations d ON e.id = d.exercise_id
            GROUP BY e.id
            ORDER BY e.level ASC
        ''')

    rows = cur.fetchall()

    # 获取用户进度（如果已登录）
    user_id = session.get('user_id')
    progress_map = {}
    if user_id:
        cur.execute("""
            SELECT e.id, COUNT(p.id) AS done
            FROM progress p
            JOIN dictations d ON p.dictation_id = d.id
            JOIN exercises e ON d.exercise_id = e.id
            WHERE p.user_id=? AND p.completed=1
            GROUP BY e.id
        """, (user_id,))
        progress_map = {row['id']: row['done'] for row in cur.fetchall()}

    conn.close()

    exercises = []
    for row in rows:
        ex = {
            'id': row['id'],
            'title': row['title'],
            'level': row['level'],
            'stage': row['stage'],
            'description': row['description'],
            'dictation_count': row['dictation_count'],
            'completed_count': progress_map.get(row['id'], 0),
            'created_at': row['created_at'],
        }
        exercises.append(ex)
    return jsonify(exercises)


@app.route('/api/exercises/<int:exercise_id>', methods=['GET'])
def get_exercise_detail(exercise_id):
    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT * FROM exercises WHERE id = ?", (exercise_id,))
    exercise = cur.fetchone()
    if not exercise:
        conn.close()
        return jsonify({'error': '练习集不存在'}), 404

    cur.execute(
        "SELECT * FROM dictations WHERE exercise_id = ? ORDER BY sort_order ASC",
        (exercise_id,)
    )
    dictations = [dict(row) for row in cur.fetchall()]

    conn.close()

    return jsonify({
        'exercise': dict(exercise),
        'dictations': dictations,
    })


# ==================== API：音频文件流 ====================

@app.route('/api/audio/<path:filename>', methods=['GET'])
def serve_audio(filename):
    if filename.startswith('http://') or filename.startswith('https://'):
        return jsonify({'url': filename})

    file_path = os.path.join(UPLOAD_DIR, filename)
    if os.path.exists(file_path):
        return send_file(file_path, mimetype='audio/mpeg')

    file_path = os.path.join(AUDIO_DIR, filename)
    if os.path.exists(file_path):
        return send_file(file_path, mimetype='audio/mpeg')

    return jsonify({'error': '音频文件不存在'}), 404


# ==================== 管理 API ====================

@app.route('/api/admin/exercises', methods=['POST'])
def create_exercise():
    data = request.get_json()
    title = data.get('title', '').strip()
    level = int(data.get('level', 1))
    stage = data.get('stage', '').strip()
    description = data.get('description', '').strip()

    if not title:
        return jsonify({'error': '标题不能为空'}), 400
    if level < 1 or level > 9:
        return jsonify({'error': '级别范围 1-9'}), 400
    if not stage:
        return jsonify({'error': '教育阶段不能为空'}), 400

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO exercises (title, level, stage, description) VALUES (?,?,?,?)",
        (title, level, stage, description)
    )
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return jsonify({'id': new_id, 'message': '练习集创建成功'}), 201


@app.route('/api/admin/dictations', methods=['POST'])
def create_dictation():
    data = request.get_json()
    exercise_id = data.get('exercise_id')
    sentence = data.get('sentence', '').strip()
    note = data.get('note', '').strip()
    sort_order = data.get('sort_order', 0)
    audio_url = data.get('audio_url', '').strip()

    if not exercise_id or not sentence:
        return jsonify({'error': '练习集ID和句子不能为空'}), 400

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id FROM exercises WHERE id = ?", (exercise_id,))
    if not cur.fetchone():
        conn.close()
        return jsonify({'error': '练习集不存在'}), 404

    cur.execute(
        "INSERT INTO dictations (exercise_id, sentence, audio_path, note, sort_order) VALUES (?,?,?,?,?)",
        (exercise_id, sentence, audio_url, note, sort_order)
    )
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return jsonify({'id': new_id, 'message': '听写句创建成功'}), 201


@app.route('/api/admin/upload-audio', methods=['POST'])
def upload_audio():
    if 'file' not in request.files:
        return jsonify({'error': '未收到文件'}), 400

    file = request.files['file']
    dictation_id = request.form.get('dictation_id')
    if not dictation_id:
        return jsonify({'error': '缺少 dictation_id'}), 400
    if file.filename == '':
        return jsonify({'error': '文件名为空'}), 400

    ext = os.path.splitext(file.filename)[1] or '.mp3'
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    file.save(filepath)

    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE dictations SET audio_path = ? WHERE id = ?", (filename, dictation_id))
    conn.commit()
    conn.close()
    return jsonify({'filename': filename, 'url': f'/api/audio/{filename}', 'message': '音频上传成功'}), 200


@app.route('/api/admin/dictations/<int:dictation_id>', methods=['PUT'])
def update_dictation(dictation_id):
    data = request.get_json()
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM dictations WHERE id = ?", (dictation_id,))
    if not cur.fetchone():
        conn.close()
        return jsonify({'error': '听写句不存在'}), 404

    updates = {}
    for field in ['sentence', 'audio_path', 'note', 'sort_order']:
        if field in data:
            val = data[field]
            if isinstance(val, str):
                val = val.strip()
            updates[field] = val

    if updates:
        set_clause = ', '.join(f"{k} = ?" for k in updates)
        values = list(updates.values()) + [dictation_id]
        cur.execute(f"UPDATE dictations SET {set_clause} WHERE id = ?", values)

    conn.commit()
    conn.close()
    return jsonify({'message': '听写句更新成功'})


@app.route('/api/admin/exercises/<int:exercise_id>', methods=['DELETE'])
def delete_exercise(exercise_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id FROM exercises WHERE id = ?", (exercise_id,))
    if not cur.fetchone():
        conn.close()
        return jsonify({'error': '练习集不存在'}), 404
    cur.execute("DELETE FROM exercises WHERE id = ?", (exercise_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': '练习集已删除'})


@app.route('/api/admin/dictations/<int:dictation_id>', methods=['DELETE'])
def delete_dictation(dictation_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id FROM dictations WHERE id = ?", (dictation_id,))
    if not cur.fetchone():
        conn.close()
        return jsonify({'error': '听写句不存在'}), 404
    cur.execute("DELETE FROM dictations WHERE id = ?", (dictation_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': '听写句已删除'})


# ==================== 管理 API：用户管理 ====================

@app.route('/api/admin/users', methods=['GET'])
@admin_required
def admin_list_users():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    keyword = request.args.get('keyword', '').strip()
    per_page = min(per_page, 100)
    offset = (page - 1) * per_page

    conn = get_db()
    cur = conn.cursor()

    where = ''
    params = []
    if keyword:
        where = "WHERE nickname LIKE ? OR username LIKE ? OR openid LIKE ?"
        kw = f'%{keyword}%'
        params = [kw, kw, kw]

    cur.execute(f"SELECT COUNT(*) AS cnt FROM users {where}", params)
    total = cur.fetchone()['cnt']

    cur.execute(f'''
        SELECT id, nickname, username, role, is_admin, created_at, last_login
        FROM users {where}
        ORDER BY id DESC LIMIT ? OFFSET ?
    ''', params + [per_page, offset])
    users = [dict(row) for row in cur.fetchall()]

    # 为每个用户附加学习统计
    for u in users:
        cur.execute("SELECT COUNT(*) AS cnt FROM progress WHERE user_id = ?", (u['id'],))
        u['progress_count'] = cur.fetchone()['cnt']
        cur.execute("SELECT SUM(correct_words) AS c, SUM(total_words) AS t FROM progress WHERE user_id = ?", (u['id'],))
        row = cur.fetchone()
        u['total_correct'] = row['c'] or 0
        u['total_words'] = row['t'] or 0

    conn.close()
    return jsonify({'users': users, 'total': total, 'page': page, 'per_page': per_page})


@app.route('/api/admin/users/count', methods=['GET'])
@admin_required
def admin_users_count():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) AS cnt FROM users")
    total = cur.fetchone()['cnt']
    cur.execute("SELECT COUNT(*) AS cnt FROM users WHERE is_admin = 1")
    admin_count = cur.fetchone()['cnt']
    conn.close()
    return jsonify({'total': total, 'admin_count': admin_count})


@app.route('/api/admin/users/<int:user_id>/progress', methods=['GET'])
@admin_required
def admin_user_progress(user_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = cur.fetchone()
    if not user:
        conn.close()
        return jsonify({'error': '用户不存在'}), 404
    cur.execute('''
        SELECT p.*, d.sentence, e.title AS exercise_title
        FROM progress p
        JOIN dictations d ON p.dictation_id = d.id
        JOIN exercises e ON p.exercise_id = e.id
        WHERE p.user_id = ?
        ORDER BY p.created_at DESC
        LIMIT 200
    ''', (user_id,))
    rows = [dict(row) for row in cur.fetchall()]
    conn.close()
    return jsonify({'user': dict(user), 'progress': rows})


# ==================== 管理 API：音频管理 ====================

@app.route('/api/admin/audios', methods=['GET'])
@admin_required
def admin_list_audios():
    conn = get_db()
    cur = conn.cursor()
    cur.execute('''
        SELECT d.id, d.sentence, d.audio_path, d.note, e.id AS exercise_id, e.title AS exercise_title
        FROM dictations d
        JOIN exercises e ON d.exercise_id = e.id
        ORDER BY d.id ASC
    ''')
    rows = cur.fetchall()
    audios = []
    for row in rows:
        audios.append({
            'dictation_id': row['id'],
            'sentence': row['sentence'],
            'audio_path': row['audio_path'],
            'note': row['note'],
            'exercise_id': row['exercise_id'],
            'exercise_title': row['exercise_title'],
        })
    conn.close()
    return jsonify({'audios': audios})


@app.route('/api/admin/audios/upload', methods=['POST'])
@admin_required
def admin_upload_audio():
    """上传音频文件，关联到指定 dictation_id"""
    if 'file' not in request.files:
        return jsonify({'error': '未收到文件'}), 400
    file = request.files['file']
    dictation_id = request.form.get('dictation_id', type=int)
    if not dictation_id:
        return jsonify({'error': '缺少 dictation_id'}), 400
    if file.filename == '':
        return jsonify({'error': '文件名为空'}), 400

    ext = os.path.splitext(file.filename)[1].lower() or '.mp3'
    if ext not in ('.mp3', '.wav', '.ogg', '.m4a'):
        return jsonify({'error': '仅支持 MP3/WAV/OGG/M4A 格式'}), 400

    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    file.save(filepath)

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id FROM dictations WHERE id = ?", (dictation_id,))
    if not cur.fetchone():
        conn.close()
        os.remove(filepath)
        return jsonify({'error': '听写句不存在'}), 404

    cur.execute("UPDATE dictations SET audio_path = ? WHERE id = ?", (filename, dictation_id))
    conn.commit()
    conn.close()
    return jsonify({'filename': filename, 'url': f'/api/audio/{filename}', 'message': '上传成功'})


@app.route('/api/admin/audios/<int:dictation_id>', methods=['PUT', 'POST'])
@admin_required
def admin_update_audio(dictation_id):
    """替换指定听写句的音频（通过上传新文件）"""
    if 'file' not in request.files:
        return jsonify({'error': '未收到文件'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '文件名为空'}), 400

    ext = os.path.splitext(file.filename)[1].lower() or '.mp3'
    if ext not in ('.mp3', '.wav', '.ogg', '.m4a'):
        return jsonify({'error': '仅支持 MP3/WAV/OGG/M4A 格式'}), 400

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT audio_path FROM dictations WHERE id = ?", (dictation_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': '听写句不存在'}), 404

    # 删除旧文件
    old_path = row['audio_path']
    if old_path:
        old_full = os.path.join(UPLOAD_DIR, old_path)
        if os.path.exists(old_full):
            os.remove(old_full)

    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    file.save(filepath)

    cur.execute("UPDATE dictations SET audio_path = ? WHERE id = ?", (filename, dictation_id))
    conn.commit()
    conn.close()
    return jsonify({'filename': filename, 'url': f'/api/audio/{filename}', 'message': '音频已更新'})


@app.route('/api/admin/audios/<path:filename>', methods=['DELETE'])
@admin_required
def admin_delete_audio(filename):
    """删除音频文件（仅从 uploads 目录删除，同时清除 dictations 中引用）"""
    # 安全检查：防止路径穿越
    if '..' in filename or filename.startswith('/'):
        return jsonify({'error': '非法文件名'}), 400

    file_path = os.path.join(UPLOAD_DIR, filename)
    deleted = False
    if os.path.exists(file_path):
        os.remove(file_path)
        deleted = True

    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE dictations SET audio_path = '' WHERE audio_path = ?", (filename,))
    conn.commit()
    conn.close()

    return jsonify({'message': '音频已删除' if deleted else '文件不存在，已清除数据库引用'})


# ==================== 启动 ====================

if __name__ == '__main__':
    init_db()
    print("=" * 50)
    print("  英语听力听写网站已启动")
    print("  访问 http://localhost:5000")
    print("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=5000)
