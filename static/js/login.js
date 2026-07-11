// 英语听力听写网站 - 登录页逻辑
document.addEventListener('DOMContentLoaded', () => {
    const btnGuest = document.getElementById('btn-guest');
    const btnWechat = document.getElementById('btn-wechat');
    const btnAdmin = document.getElementById('btn-admin');
    const statusEl = document.getElementById('login-status');

    // 管理员登录模态框
    const overlay = document.getElementById('admin-modal-overlay');
    const btnAdminCancel = document.getElementById('btn-admin-cancel');
    const btnAdminSubmit = document.getElementById('btn-admin-submit');
    const adminForm = document.getElementById('admin-login-form');
    const adminUsername = document.getElementById('admin-username');
    const adminPassword = document.getElementById('admin-password');
    const adminError = document.getElementById('admin-login-error');

    function showStatus(msg, type) {
        statusEl.textContent = msg;
        statusEl.className = `login-status ${type}`;
    }

    function showAdminError(msg) {
        adminError.textContent = msg;
        adminError.classList.remove('hidden');
    }

    function hideAdminError() {
        adminError.classList.add('hidden');
    }

    function openAdminModal() {
        overlay.classList.remove('hidden');
        adminUsername.value = '';
        adminPassword.value = '';
        hideAdminError();
        adminUsername.focus();
    }

    function closeAdminModal() {
        overlay.classList.add('hidden');
    }

    // 游客登录
    btnGuest.addEventListener('click', async () => {
        btnGuest.disabled = true;
        showStatus('正在创建游客会话...', 'loading');
        try {
            const resp = await fetch('/api/auth/guest', { method: 'POST' });
            const data = await resp.json();
            if (resp.ok) {
                window.location.href = '/';
            } else {
                showStatus(data.error || '登录失败', 'error');
                btnGuest.disabled = false;
            }
        } catch (err) {
            showStatus('网络错误，请重试', 'error');
            btnGuest.disabled = false;
        }
    });

    // 微信登录
    btnWechat.addEventListener('click', async () => {
        btnWechat.disabled = true;
        showStatus('正在获取微信授权链接...', 'loading');
        try {
            const resp = await fetch('/api/auth/wechat/url');
            const data = await resp.json();
            if (resp.ok && data.url) {
                window.location.href = data.url;
            } else {
                showStatus(data.error || '获取授权链接失败', 'error');
                btnWechat.disabled = false;
            }
        } catch (err) {
            showStatus('网络错误，请重试', 'error');
            btnWechat.disabled = false;
        }
    });

    // 管理员登录 - 打开模态框
    btnAdmin.addEventListener('click', () => {
        openAdminModal();
    });

    // 管理员登录 - 取消
    btnAdminCancel.addEventListener('click', () => {
        closeAdminModal();
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeAdminModal();
    });

    // 管理员登录 - 提交
    adminForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = adminUsername.value.trim();
        const password = adminPassword.value;

        if (!username || !password) {
            showAdminError('请输入账号和密码');
            return;
        }

        hideAdminError();
        btnAdminSubmit.disabled = true;
        btnAdminSubmit.textContent = '登录中...';

        try {
            const resp = await fetch('/api/auth/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await resp.json();
            if (resp.ok && data.success) {
                window.location.href = '/admin';
            } else {
                showAdminError(data.error || '登录失败');
                btnAdminSubmit.disabled = false;
                btnAdminSubmit.textContent = '登录';
            }
        } catch (err) {
            showAdminError('网络错误，请重试');
            btnAdminSubmit.disabled = false;
            btnAdminSubmit.textContent = '登录';
        }
    });
});
