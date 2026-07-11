// 管理后台 JS
const API = {
    status: '/api/auth/status',
    logout: '/api/auth/logout',
    adminLogin: '/api/auth/admin/login',
    users: '/api/admin/users',
    usersCount: '/api/admin/users/count',
    userProgress: (id) => `/api/admin/users/${id}/progress`,
    audios: '/api/admin/audios',
    audioUpload: '/api/admin/audios/upload',
    audioUpdate: (id) => `/api/admin/audios/${id}`,
    audioDelete: (fname) => `/api/admin/audios/${fname}`,
};

let state = {
    currentTab: 'users',
    usersPage: 1,
    usersKeyword: '',
    audios: [],
    exercises: [],
    allDictations: [],
    pendingUploadFile: null,
};

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', async () => {
    await checkAdminAuth();
    bindNavTabs();
    bindUserSearch();
    bindAudioUpload();
    bindModals();
    bindLogout();
    loadUsers();
    loadAudios();
});

async function checkAdminAuth() {
    const resp = await fetch(API.status);
    const data = await resp.json();
    if (!data.logged_in || !data.is_admin) {
        window.location.href = '/login';
        return;
    }
    document.getElementById('admin-nickname').textContent = data.nickname || '管理员';
}

// ==================== Tab 切换 ====================
function bindNavTabs() {
    document.querySelectorAll('.admin-nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const tab = link.dataset.tab;
            if (!tab) return;
            state.currentTab = tab;
            document.querySelectorAll('.admin-nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.add('hidden'));
            document.getElementById(`tab-${tab}`).classList.remove('hidden');
        });
    });
}

// ==================== 用户管理 ====================
function bindUserSearch() {
    const input = document.getElementById('user-search');
    const btn = document.getElementById('btn-user-search');
    btn.addEventListener('click', () => {
        state.usersKeyword = input.value.trim();
        state.usersPage = 1;
        loadUsers();
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { btn.click(); }
    });
}

async function loadUsers() {
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = '<tr><td colspan="8" class="admin-table-loading">加载中...</td></tr>';

    const params = new URLSearchParams({
        page: state.usersPage,
        keyword: state.usersKeyword,
    });
    const resp = await fetch(`${API.users}?${params}`);
    const data = await resp.json();

    // 统计
    const countResp = await fetch(API.usersCount);
    const countData = await countResp.json();
    document.getElementById('users-stats').innerHTML =
        `用户总数：<strong>${countData.total}</strong>`;

    if (!data.users || data.users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="admin-table-empty">暂无用户</td></tr>';
        renderUsersPagination(0, 1, 20);
        return;
    }

    tbody.innerHTML = data.users.map(u => `
        <tr>
            <td>${u.id}</td>
            <td>${escHtml(u.nickname || '-')}</td>
            <td>${escHtml(u.username || '-')}</td>
            <td>${u.is_admin ? '<span class="admin-tag admin-tag-admin">管理员</span>' : '<span class="admin-tag admin-tag-user">普通用户</span>'}</td>
            <td>${formatTime(u.created_at)}</td>
            <td>${formatTime(u.last_login)}</td>
            <td>记录 ${u.progress_count || 0} 条</td>
            <td>
                <button class="admin-btn admin-btn-sm admin-btn-link" onclick="viewUserProgress(${u.id})">查看进度</button>
            </td>
        </tr>
    `).join('');

    renderUsersPagination(countData.total, data.page, data.per_page);
}

function renderUsersPagination(total, page, perPage) {
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const el = document.getElementById('users-pagination');
    if (totalPages <= 1) { el.innerHTML = ''; return; }
    let html = `<button ${page <= 1 ? 'disabled' : ''} onclick="goUserPage(${page - 1})">上一页</button>`;
    html += `<span class="page-info">第 ${page} / ${totalPages} 页（共 ${total} 人）</span>`;
    html += `<button ${page >= totalPages ? 'disabled' : ''} onclick="goUserPage(${page + 1})">下一页</button>`;
    el.innerHTML = html;
}

window.goUserPage = (p) => {
    state.usersPage = p;
    loadUsers();
};

window.viewUserProgress = async (userId) => {
    const resp = await fetch(API.userProgress(userId));
    const data = await resp.json();
    const overlay = document.getElementById('progress-modal-overlay');
    document.getElementById('progress-modal-title').textContent =
        `学习进度 - ${escHtml(data.user.nickname || '用户')} (ID: ${userId})`;

    const body = document.getElementById('progress-modal-body');
    if (!data.progress || data.progress.length === 0) {
        body.innerHTML = '<div class="progress-detail-empty">暂无学习记录</div>';
    } else {
        body.innerHTML = `
            <table class="progress-detail-table">
                <thead><tr><th>练习集</th><th>听写句</th><th>正确词</th><th>总词</th><th>完成</th><th>尝试次数</th><th>时间</th></tr></thead>
                <tbody>
                    ${data.progress.map(p => `
                        <tr>
                            <td>${escHtml(p.exercise_title || '-')}</td>
                            <td>${escHtml((p.sentence || '').substring(0, 60))}</td>
                            <td>${p.correct_words || 0}</td>
                            <td>${p.total_words || 0}</td>
                            <td>${p.completed ? '✅' : '❌'}</td>
                            <td>${p.attempts || 1}</td>
                            <td>${formatTime(p.created_at)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
    overlay.classList.remove('hidden');
};

// ==================== 音频管理 ====================
async function loadAudios() {
    const resp = await fetch(API.audios);
    const data = await resp.json();
    state.audios = data.audios || [];

    // 收集练习集列表
    const exSet = {};
    state.audios.forEach(a => { exSet[a.exercise_id] = a.exercise_title; });
    state.exercises = Object.entries(exSet).map(([id, title]) => ({ id, title }));

    // 填充练习集筛选
    const sel = document.getElementById('audio-exercise-filter');
    const curVal = sel.value;
    sel.innerHTML = '<option value="">全部练习集</option>' +
        state.exercises.map(e => `<option value="${e.id}">${escHtml(e.title)}</option>`).join('');
    sel.value = curVal;

    document.getElementById('audios-stats').innerHTML =
        `音频总数：<strong>${state.audios.length}</strong>`;

    renderAudiosTable();
}

function renderAudiosTable() {
    const tbody = document.getElementById('audios-tbody');
    const filterEx = document.getElementById('audio-exercise-filter').value;

    let list = state.audios;
    if (filterEx) {
        list = list.filter(a => String(a.exercise_id) === filterEx);
    }

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="admin-table-empty">暂无音频记录</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(a => `
        <tr>
            <td data-label="ID">${a.dictation_id}</td>
            <td data-label="听写句" title="${escHtml(a.sentence)}">${escHtml((a.sentence || '').substring(0, 50))}${a.sentence && a.sentence.length > 50 ? '...' : ''}</td>
            <td data-label="音频文件">
                ${a.audio_path
                    ? `<span class="admin-audio-play" onclick="playAudio('${escAttr(a.audio_path)}')">▶ ${escHtml(a.audio_path)}</span>
                       <br><audio id="audio-${a.dictation_id}" src="/api/audio/${escAttr(a.audio_path)}" preload="none"></audio>`
                    : '<span class="admin-audio-missing">未上传</span>'
                }
            </td>
            <td data-label="所属练习集">${escHtml(a.exercise_title || '-')}</td>
            <td data-label="操作">
                <label class="admin-btn admin-btn-sm admin-btn-secondary" style="cursor:pointer">
                    替换
                    <input type="file" accept="audio/mp3,audio/wav,audio/ogg,audio/mp4" hidden onchange="replaceAudio(${a.dictation_id}, this)">
                </label>
                ${a.audio_path ? `<button class="admin-btn admin-btn-sm admin-btn-danger" onclick="deleteAudio('${escAttr(a.audio_path)}', ${a.dictation_id})">删除</button>` : ''}
            </td>
        </tr>
    `).join('');
}

window.playAudio = (filename) => {
    // 找到对应 audio 元素并播放
    const rows = document.querySelectorAll(`[id^="audio-"]`);
    for (const el of rows) {
        if (el.src.includes(filename)) {
            el.play();
            break;
        }
    }
};

window.replaceAudio = async (dictationId, input) => {
    const file = input.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch(API.audioUpdate(dictationId), { method: 'PUT', body: fd });
    const result = await r.json();
    if (r.ok) {
        showToast('音频已更新');
        loadAudios();
    } else {
        showToast(result.error || '替换失败', true);
    }
    input.value = '';
};

// PUT 请求需要用 XHR/fetch with blob；这里用简化方案：先上传再更新
// 实际上传逻辑已在 replaceAudio 中用 POST /api/admin/audios/upload 完成

window.deleteAudio = async (filename, dictationId) => {
    if (!confirm(`确认删除音频文件「${filename}」？`)) return;
    const resp = await fetch(API.audioDelete(filename), { method: 'DELETE' });
    const data = await resp.json();
    showToast(data.message || '已删除');
    loadAudios();
};

function bindAudioUpload() {
    const input = document.getElementById('audio-file-input');
    input.addEventListener('change', async () => {
        if (!input.files.length) return;
        state.pendingUploadFile = input.files[0];
        // 加载所有听写句供选择
        const resp = await fetch('/api/exercises');
        const exercises = await resp.json();
        const allDicts = [];
        for (const ex of exercises) {
            const dr = await fetch(`/api/exercises/${ex.id}`);
            const dData = await dr.json();
            dData.dictations.forEach(d => {
                allDicts.push({ id: d.id, sentence: d.sentence, exerciseTitle: ex.title });
            });
        }
        state.allDictations = allDicts;

        const sel = document.getElementById('upload-dictation-select');
        sel.innerHTML = allDicts.map(d =>
            `<option value="${d.id}">[${escHtml(d.exerciseTitle)}] ${escHtml(d.sentence.substring(0, 40))}</option>`
        ).join('');

        document.getElementById('upload-filename').textContent = state.pendingUploadFile.name;
        document.getElementById('upload-modal-overlay').classList.remove('hidden');
    });

    document.getElementById('btn-upload-cancel').addEventListener('click', () => {
        document.getElementById('upload-modal-overlay').classList.add('hidden');
        state.pendingUploadFile = null;
    });

    document.getElementById('btn-upload-confirm').addEventListener('click', async () => {
        const dictationId = document.getElementById('upload-dictation-select').value;
        if (!dictationId || !state.pendingUploadFile) return;
        const fd = new FormData();
        fd.append('file', state.pendingUploadFile);
        fd.append('dictation_id', dictationId);
        const resp = await fetch(API.audioUpload, { method: 'POST', body: fd });
        const data = await resp.json();
        if (resp.ok) {
            showToast('上传成功');
            document.getElementById('upload-modal-overlay').classList.add('hidden');
            state.pendingUploadFile = null;
            loadAudios();
        } else {
            document.getElementById('upload-error').textContent = data.error || '上传失败';
            document.getElementById('upload-error').classList.remove('hidden');
        }
    });

    document.getElementById('audio-exercise-filter').addEventListener('change', () => {
        renderAudiosTable();
    });
}

// ==================== 模态框 ====================
function bindModals() {
    document.getElementById('btn-progress-close').addEventListener('click', () => {
        document.getElementById('progress-modal-overlay').classList.add('hidden');
    });
    document.getElementById('progress-modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            e.currentTarget.classList.add('hidden');
        }
    });
}

// ==================== 退出 ====================
function bindLogout() {
    document.getElementById('btn-admin-logout').addEventListener('click', async () => {
        await fetch(API.logout, { method: 'POST' });
        window.location.href = '/login';
    });
}

// ==================== 工具函数 ====================
function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatTime(ts) {
    if (!ts) return '-';
    try {
        return new Date(ts).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return ts; }
}

function showToast(msg, isError = false) {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = `
        position: fixed; bottom: 24px; right: 24px; z-index: 9999;
        padding: 12px 20px; border-radius: 8px; font-size: 13px; font-weight: 500;
        color: ${isError ? '#B91C1C' : '#1F2937'};
        background: ${isError ? '#FEE2E2' : '#F0FDF4'};
        border: 1px solid ${isError ? '#FCA5A5' : '#BBF7D0'};
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        transition: opacity 0.3s;
    `;
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2500);
}
