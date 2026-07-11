// 英语听力听写网站 - 前端主逻辑（单元格式逐词输入）
class DictationApp {
    constructor() {
        this.exercises = [];
        this.currentExercise = null;
        this.currentDictIndex = 0;
        this.dictations = [];
        this.results = [];        // per-sentence result: 'correct' | 'wrong' | null
        this.wordResults = [];    // per-word results for current sentence
        this.cells = [];           // DOM references to current cell inputs
        this.audio = null;
        this.isPlaying = false;
        this.apiBase = '';
        this.user = null;         // current user info from /api/auth/status
        this.isGuest = true;

        this.init();
    }

    // ==================== Init ====================
    init() {
        this.el = {
            pageList: document.getElementById('page-list'),
            pagePractice: document.getElementById('page-practice'),
            pageComplete: document.getElementById('page-complete'),
            stageContainer: document.getElementById('stage-container'),
            btnBack: document.getElementById('btn-back'),
            btnPlay: document.getElementById('btn-play'),
            btnCheck: document.getElementById('btn-check'),
            btnHint: document.getElementById('btn-hint'),
            btnReveal: document.getElementById('btn-reveal'),
            btnReset: document.getElementById('btn-reset'),
            btnNext: document.getElementById('btn-next'),
            btnRetry: document.getElementById('btn-retry'),
            btnBackList: document.getElementById('btn-back-list'),
            cellGrid: document.getElementById('cell-grid'),
            accuracyArea: document.getElementById('accuracy-area'),
            toolbarProgress: document.getElementById('toolbar-progress'),
            playHintText: document.getElementById('play-hint-text'),
            dictNoteDisplay: document.getElementById('dict-note-display'),
            progressText: document.getElementById('progress-text'),
            progressFill: document.getElementById('progress-fill'),
            practiceTitle: document.getElementById('practice-title'),
            practiceLevel: document.getElementById('practice-level'),
            dictIndex: document.getElementById('dict-index'),
            scorePercent: document.getElementById('score-percent'),
            scoreCorrect: document.getElementById('score-correct'),
            scoreTotal: document.getElementById('score-total'),
            scoreWrong: document.getElementById('score-wrong'),
            headerUser: document.getElementById('header-user'),
            guestBanner: document.getElementById('guest-banner'),
            btnWechatBanner: document.getElementById('btn-wechat-banner'),
        };
        this.bindEvents();
        this.checkAuthStatus().then(() => this.loadExercises());
    }

    bindEvents() {
        this.el.btnBack.addEventListener('click', () => this.goToList());
        this.el.btnPlay.addEventListener('click', () => this.togglePlay());
        this.el.btnCheck.addEventListener('click', () => this.checkAnswer());
        this.el.btnHint.addEventListener('click', () => this.showHint());
        this.el.btnReveal.addEventListener('click', () => this.revealAnswer());
        this.el.btnReset.addEventListener('click', () => this.resetSentence());
        this.el.btnNext.addEventListener('click', () => this.nextDictation());
        this.el.btnRetry.addEventListener('click', () => this.retryPractice());
        this.el.btnBackList.addEventListener('click', () => this.goToList());

        if (this.el.btnWechatBanner) {
            this.el.btnWechatBanner.addEventListener('click', () => this.wechatLogin());
        }

        document.querySelector('.logo').addEventListener('click', () => {
            if (!this.el.pageList.classList.contains('active')) this.goToList();
        });

        const adminBtn = document.getElementById('btn-admin');
        if (adminBtn) {
            adminBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.open('/admin', '_blank');
            });
        }
    }

    // ==================== Auth ====================

    async checkAuthStatus() {
        try {
            const resp = await fetch(`${this.apiBase}/api/auth/status`);
            if (resp.ok) {
                const data = await resp.json();
                if (data.logged_in) {
                    this.user = data;
                    this.isGuest = data.is_guest;
                    this.renderUserInfo();
                    if (this.isGuest && this.el.guestBanner) {
                        this.el.guestBanner.classList.remove('hidden');
                    }
                } else {
                    this.user = null;
                    this.isGuest = true;
                }
            }
        } catch (err) {
            this.user = null;
            this.isGuest = true;
        }
    }

    renderUserInfo() {
        if (!this.el.headerUser) return;
        const u = this.user;
        if (!u) {
            this.el.headerUser.innerHTML = '';
            return;
        }

        let html = '';
        if (u.avatar_url) {
            html += `<img class="user-avatar" src="${u.avatar_url}" alt="avatar">`;
        } else {
            const initial = (u.nickname || '游')[0];
            html += `<div class="user-avatar-placeholder">${initial}</div>`;
        }
        html += `<span class="user-nickname">${u.nickname || '用户'}</span>`;
        if (u.is_guest) {
            html += `<span class="user-guest-tag">游客</span>`;
        }
        html += `<button class="btn-logout" id="btn-logout">退出</button>`;
        this.el.headerUser.innerHTML = html;

        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', () => this.logout());
        }
    }

    async logout() {
        try {
            await fetch(`${this.apiBase}/api/auth/logout`, { method: 'POST' });
        } catch (e) {}
        window.location.href = '/login';
    }

    async wechatLogin() {
        try {
            const resp = await fetch(`${this.apiBase}/api/auth/wechat/url`);
            const data = await resp.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                alert('获取微信授权链接失败');
            }
        } catch (e) {
            alert('网络错误');
        }
    }

    // ==================== Page Nav ====================
    showPage(page) {
        [this.el.pageList, this.el.pagePractice, this.el.pageComplete].forEach(el => el.classList.remove('active'));
        page.classList.add('active');
    }

    goToList() {
        this.stopAudio();
        this.showPage(this.el.pageList);
    }

    // ==================== Data Loading ====================
    async loadExercises() {
        try {
            const resp = await fetch(`${this.apiBase}/api/exercises`);
            if (!resp.ok) throw new Error('API error');
            this.exercises = await resp.json();
            this.renderStages();
        } catch (err) {
            this.el.stageContainer.innerHTML = '<p style="text-align:center;color:#999;padding:40px;">加载失败，请确认后端已启动</p>';
        }
    }

    renderStages() {
        const stageOrder = [
            { name: '小学', desc: '日常简单用语，基本问候和交流' },
            { name: '初中', desc: '日常生活常见话题，简单讨论' },
            { name: '高中', desc: '较复杂话题，较流利交流' },
            { name: '大学', desc: '复杂话题，各种文本理解' },
            { name: '英语专业', desc: '专业级语言运用' },
            { name: '高端外语人才', desc: '精通，自如深度沟通' },
        ];

        const grouped = {};
        this.exercises.forEach(ex => {
            if (!grouped[ex.stage]) grouped[ex.stage] = [];
            grouped[ex.stage].push(ex);
        });

        let html = '';
        stageOrder.forEach(stage => {
            const exs = grouped[stage.name] || [];
            if (exs.length === 0) return;
            exs.sort((a, b) => a.level - b.level);

            const levelButtons = exs.map(ex => {
                const totalD = ex.dictation_count;
                const doneD = ex.completed_count || 0;
                let progressBadge = '';
                if (!this.isGuest && totalD > 0 && doneD > 0) {
                    progressBadge = `<span class="stage-progress-badge">${doneD}/${totalD} 句</span>`;
                }
                return `
                <button class="level-btn" data-exercise-id="${ex.id}" data-level="${ex.level}">
                    <span class="level-num">Level ${ex.level}</span>
                    <span class="level-label">(${totalD}句)</span>
                    ${progressBadge}
                </button>
                `;
            }).join('');

            html += `
                <div class="stage-card">
                    <div class="stage-header">
                        <span class="stage-name">${stage.name}</span>
                        <span class="stage-desc">${stage.desc}</span>
                    </div>
                    <div class="stage-body">${levelButtons}</div>
                </div>
            `;
        });

        this.el.stageContainer.innerHTML = html;
        this.el.stageContainer.querySelectorAll('.level-btn').forEach(btn => {
            btn.addEventListener('click', () => this.startExercise(parseInt(btn.dataset.exerciseId)));
        });
    }

    async startExercise(exerciseId) {
        try {
            const resp = await fetch(`${this.apiBase}/api/exercises/${exerciseId}`);
            if (!resp.ok) throw new Error('练习集不存在');
            const data = await resp.json();
            this.currentExercise = data.exercise;
            this.dictations = data.dictations || [];
            this.currentDictIndex = 0;
            this.results = new Array(this.dictations.length).fill(null);
            if (this.dictations.length === 0) { alert('该练习集暂无听写句'); return; }
            this.showPage(this.el.pagePractice);
            this.renderPracticeInfo();
            this.renderDictation(0);
        } catch (err) {
            alert('加载失败');
        }
    }

    renderPracticeInfo() {
        const ex = this.currentExercise;
        this.el.practiceTitle.textContent = ex.title;
        this.el.practiceLevel.textContent = `Lv.${ex.level}`;
    }

    // ==================== Sentence Splitting ====================
    // Split sentence into words with punctuation attached to the word
    splitSentence(sentence) {
        // Split on spaces, keeping punctuation attached to the word
        // e.g. "I ran into my old friend." => ["I", "ran", "into", "my", "old", "friend."]
        return sentence.trim().split(/\s+/).filter(w => w.length > 0);
    }

    // ==================== Render Dictation (Cell Grid) ====================
    renderDictation(index) {
        const dict = this.dictations[index];
        if (!dict) return;
        this.currentDictIndex = index;
        this.wordResults = [];

        // Update top info
        this.el.dictIndex.textContent = index + 1;
        this.el.toolbarProgress.textContent = `第 ${index + 1}/${this.dictations.length} 句`;
        this.el.progressText.textContent = `${index + 1} / ${this.dictations.length}`;

        const correctCount = this.results.filter(r => r === 'correct').length;
        this.el.progressFill.style.width = `${(correctCount / this.dictations.length) * 100}%`;

        // Clear previous state
        this.el.accuracyArea.classList.add('hidden');
        this.el.btnNext.classList.add('hidden');
        this.el.dictNoteDisplay.textContent = '';
        this.stopAudio();
        this.el.btnPlay.classList.remove('playing');
        this.el.playHintText.textContent = '点击播放';

        // Build cell grid
        const words = this.splitSentence(dict.sentence);
        this.cells = [];
        this.wordResults = new Array(words.length).fill(null); // null = not yet checked

        let html = '';
        words.forEach((word, i) => {
            // Calculate width: ~10px per char + padding, min 60px
            const charCount = word.length;
            const w = Math.max(60, Math.min(charCount * 14 + 24, 200));
            html += `<input type="text" class="word-cell" data-index="${i}" style="width:${w}px" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="...">`;
        });
        this.el.cellGrid.innerHTML = html;

        // Cache cell DOM refs & bind events
        this.cells = Array.from(this.el.cellGrid.querySelectorAll('.word-cell'));
        this.cells.forEach((cell, i) => {
            cell.addEventListener('keydown', (e) => this.onCellKeyDown(e, i));
            cell.addEventListener('input', () => this.onCellInput(i));
        });

        // Focus first cell
        setTimeout(() => { if (this.cells[0]) this.cells[0].focus(); }, 50);
    }

    // ==================== Cell Input Handling ====================
    onCellKeyDown(e, idx) {
        // If already submitted, ignore
        if (this.results[this.currentDictIndex] !== null) return;

        if (e.key === ' ' || e.key === 'Tab') {
            e.preventDefault();
            if (e.key === 'Tab' && e.shiftKey) {
                // Shift+Tab: go to previous
                if (idx > 0) this.focusCell(idx - 1);
            } else {
                // Space or Tab: go to next
                if (idx < this.cells.length - 1) this.focusCell(idx + 1);
            }
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            this.checkAnswer();
        }
    }

    onCellInput(idx) {
        // Auto-advance on space is handled by keydown;
        // This handler is for mobile or paste scenarios
    }

    focusCell(idx) {
        if (this.cells[idx]) {
            this.cells[idx].focus();
            this.cells[idx].select();
        }
    }

    // ==================== Get User Answer Per Word ====================
    getUserWords() {
        return this.cells.map(c => c.value.trim());
    }

    // ==================== Check Answer (Per-Word) ====================
    checkAnswer() {
        if (this.results[this.currentDictIndex] !== null) return;

        const dict = this.dictations[this.currentDictIndex];
        const correctWords = this.splitSentence(dict.sentence);
        const userWords = this.getUserWords();

        let correctCount = 0;
        let wrongCount = 0;
        let emptyCount = 0;

        correctWords.forEach((cw, i) => {
            const uw = userWords[i] || '';
            const isCorrect = this.normalize(uw) === this.normalize(cw);

            if (this.normalize(uw) === '') {
                // Empty: show correct answer in gray
                this.cells[i].value = cw;
                this.cells[i].classList.add('empty-cell');
                this.cells[i].setAttribute('readonly', true);
                this.wordResults[i] = 'empty';
                emptyCount++;
            } else if (isCorrect) {
                this.cells[i].classList.add('correct');
                this.cells[i].setAttribute('readonly', true);
                this.wordResults[i] = 'correct';
                correctCount++;
            } else {
                // Wrong: show correct answer in red
                this.cells[i].value = cw;
                this.cells[i].classList.add('wrong');
                this.cells[i].setAttribute('readonly', true);
                this.wordResults[i] = 'wrong';
                wrongCount++;
                // Flash animation
                this.flashCell(this.cells[i]);
            }
        });

        // Record per-sentence result
        const allCorrect = wrongCount === 0 && emptyCount === 0;
        this.results[this.currentDictIndex] = allCorrect ? 'correct' : 'wrong';

        // Show accuracy
        const totalWords = correctWords.length;
        this.el.accuracyArea.innerHTML = `You got <span class="acc-correct">${correctCount}</span>/${totalWords} words correct! (${totalWords > 0 ? Math.round((correctCount / totalWords) * 100) : 0}%)`;
        if (wrongCount > 0) {
            this.el.accuracyArea.innerHTML += ` <span class="acc-wrong">${wrongCount} wrong</span>`;
        }
        this.el.accuracyArea.classList.remove('hidden');

        // Show note
        this.el.dictNoteDisplay.textContent = dict.note || '';

        // Update progress bar (based on correct sentences)
        const correctSentences = this.results.filter(r => r === 'correct').length;
        this.el.progressFill.style.width = `${(correctSentences / this.dictations.length) * 100}%`;

        // Show next button
        this.el.btnNext.classList.remove('hidden');

        // Save progress (silently)
        this.saveProgress(allCorrect, correctCount, totalWords);
    }

    flashCell(cell) {
        cell.style.transition = 'none';
        cell.style.boxShadow = '0 0 0 3px #EF5350';
        // Force reflow
        void cell.offsetWidth;
        cell.style.transition = 'box-shadow 0.4s ease';
        cell.style.boxShadow = '';
    }

    normalize(s) {
        return s.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    }

    // ==================== Progress Tracking ====================

    async saveProgress(allCorrect, correctWords, totalWords) {
        if (!this.user || !this.currentExercise) return;
        const dict = this.dictations[this.currentDictIndex];
        if (!dict) return;

        const userInput = JSON.stringify(this.getUserWords());
        try {
            await fetch(`${this.apiBase}/api/progress`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    exercise_id: this.currentExercise.id,
                    dictation_id: dict.id,
                    user_input: userInput,
                    total_words: totalWords,
                    correct_words: correctWords,
                    completed: allCorrect,
                }),
            });
        } catch (e) {
            // Silently fail — progress is non-critical
        }
    }

    // ==================== Hint ====================
    showHint() {
        if (this.results[this.currentDictIndex] !== null) return;
        const dict = this.dictations[this.currentDictIndex];
        const correctWords = this.splitSentence(dict.sentence);
        if (correctWords.length === 0) return;

        // Show first word in first cell as hint
        const firstWord = correctWords[0];
        const hint = firstWord.length > 0 ? firstWord[0] : '';
        if (this.cells[0] && this.cells[0].value.trim() === '') {
            this.cells[0].value = hint;
            this.cells[0].focus();
        } else if (this.cells[0]) {
            // Already has input: show first letter at start
            this.cells[0].value = hint + this.cells[0].value.slice(1);
            this.cells[0].focus();
        }
    }

    // ==================== Reveal Answer ====================
    revealAnswer() {
        if (this.results[this.currentDictIndex] !== null) return;

        const dict = this.dictations[this.currentDictIndex];
        const correctWords = this.splitSentence(dict.sentence);

        correctWords.forEach((cw, i) => {
            this.cells[i].value = cw;
            this.cells[i].classList.add('empty-cell');
            this.cells[i].setAttribute('readonly', true);
            this.wordResults[i] = 'revealed';
        });

        this.results[this.currentDictIndex] = 'wrong';

        this.el.dictNoteDisplay.textContent = dict.note || '';
        this.el.accuracyArea.innerHTML = `Answer revealed`;
        this.el.accuracyArea.classList.remove('hidden');
        this.el.btnNext.classList.remove('hidden');
    }

    // ==================== Reset Sentence ====================
    resetSentence() {
        if (this.results[this.currentDictIndex] !== null) {
            // Already submitted: allow reset to retry
            this.results[this.currentDictIndex] = null;
        }
        this.renderDictation(this.currentDictIndex);
    }

    // ==================== Audio ====================
    togglePlay() {
        this.isPlaying ? this.pauseAudio() : this.playAudio();
    }

    playAudio() {
        const dict = this.dictations[this.currentDictIndex];
        if (!dict) return;

        if (this.audio && this.audio.dataset.dictId === String(dict.id) && this.audio.readyState >= 2) {
            this.audio.play().catch(() => {});
            this.isPlaying = true;
            this.el.btnPlay.classList.add('playing');
            this.el.playHintText.textContent = '正在播放...';
            return;
        }
        this.stopAudio();

        const audioUrl = dict.audio_path ? `${this.apiBase}/api/audio/${dict.audio_path}` : null;
        if (!audioUrl) { this.playTTS(dict.sentence); return; }

        this.audio = new Audio(audioUrl);
        this.audio.dataset.dictId = String(dict.id);
        this.audio.addEventListener('play', () => {
            this.isPlaying = true;
            this.el.btnPlay.classList.add('playing');
            this.el.playHintText.textContent = '正在播放...';
        });
        this.audio.addEventListener('ended', () => {
            this.isPlaying = false;
            this.el.btnPlay.classList.remove('playing');
            this.el.playHintText.textContent = '点击播放';
        });
        this.audio.addEventListener('pause', () => {
            this.isPlaying = false;
            this.el.btnPlay.classList.remove('playing');
            this.el.playHintText.textContent = '点击播放';
        });
        this.audio.addEventListener('error', () => {
            this.isPlaying = false;
            this.el.btnPlay.classList.remove('playing');
            this.el.playHintText.textContent = '点击播放';
            this.playTTS(dict.sentence);
        });
        this.audio.play().catch(() => {
            this.isPlaying = false;
            this.el.btnPlay.classList.remove('playing');
            this.playTTS(dict.sentence);
        });
    }

    pauseAudio() {
        if (this.audio && this.isPlaying) this.audio.pause();
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        this.isPlaying = false;
        this.el.btnPlay.classList.remove('playing');
        this.el.playHintText.textContent = '点击播放';
    }

    stopAudio() {
        if (this.audio) { this.audio.pause(); this.audio.currentTime = 0; this.audio = null; }
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        this.isPlaying = false;
        this.el.btnPlay.classList.remove('playing');
        this.el.playHintText.textContent = '点击播放';
    }

    playTTS(text) {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-GB';
        u.rate = 0.85;
        u.addEventListener('start', () => {
            this.isPlaying = true;
            this.el.btnPlay.classList.add('playing');
            this.el.playHintText.textContent = '正在播放...';
        });
        u.addEventListener('end', () => {
            this.isPlaying = false;
            this.el.btnPlay.classList.remove('playing');
            this.el.playHintText.textContent = '点击播放';
        });
        u.addEventListener('error', () => {
            this.isPlaying = false;
            this.el.btnPlay.classList.remove('playing');
            this.el.playHintText.textContent = '点击播放';
        });
        window.speechSynthesis.speak(u);
    }

    // ==================== Navigation ====================
    nextDictation() {
        if (this.results[this.currentDictIndex] === null) this.results[this.currentDictIndex] = 'wrong';
        if (this.currentDictIndex < this.dictations.length - 1) {
            this.renderDictation(this.currentDictIndex + 1);
        } else {
            this.finishPractice();
        }
    }

    finishPractice() {
        this.stopAudio();
        const correctCount = this.results.filter(r => r === 'correct').length;
        const total = this.dictations.length;
        const wrongCount = total - correctCount;
        this.el.scorePercent.textContent = `${total > 0 ? Math.round((correctCount / total) * 100) : 0}%`;
        this.el.scoreCorrect.textContent = correctCount;
        this.el.scoreTotal.textContent = total;
        if (this.el.scoreWrong) this.el.scoreWrong.textContent = wrongCount;
        this.showPage(this.el.pageComplete);
    }

    retryPractice() {
        this.currentDictIndex = 0;
        this.results = new Array(this.dictations.length).fill(null);
        this.renderPracticeInfo();
        this.renderDictation(0);
        this.showPage(this.el.pagePractice);
    }
}

document.addEventListener('DOMContentLoaded', () => new DictationApp());
