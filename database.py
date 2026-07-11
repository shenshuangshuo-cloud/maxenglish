"""
英语听力听写网站 - 数据库模型与初始化
使用 SQLite，包含 exercises（练习集）、dictations（听写句）两张表
exercises 表使用 level(1-9) + stage(教育阶段) 替代原 category + difficulty。
"""

import sqlite3
import os
import uuid

DB_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(DB_DIR, 'dictation.db')

LEVEL_STAGE_MAP = {
    1: "小学", 2: "小学",
    3: "初中",
    4: "高中",
    5: "大学", 6: "大学",
    7: "英语专业",
    8: "高端外语人才", 9: "高端外语人才",
}


def _add_column_if_not_exists(cur, table, column, col_def):
    """幂等添加列（SQLite 不支持 IF NOT EXISTS 对 ALTER TABLE ADD COLUMN）"""
    cur.execute(f"PRAGMA table_info({table})")
    existing = {row['name'] for row in cur.fetchall()}
    if column not in existing:
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_def}")


def get_db():
    """获取数据库连接，启用外键约束"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """完整初始化：建表 + 种子数据（幂等）"""
    conn = get_db()
    cur = conn.cursor()

    cur.execute('''
        CREATE TABLE IF NOT EXISTS exercises (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            level INTEGER NOT NULL DEFAULT 1,
            stage TEXT NOT NULL DEFAULT '',
            description TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cur.execute('''
        CREATE TABLE IF NOT EXISTS dictations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            exercise_id INTEGER NOT NULL,
            sentence TEXT NOT NULL,
            audio_path TEXT DEFAULT '',
            sort_order INTEGER DEFAULT 0,
            note TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
        )
    ''')

    # users 表
    cur.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            openid TEXT UNIQUE,
            unionid TEXT,
            nickname TEXT,
            avatar_url TEXT,
            role TEXT DEFAULT 'user',
            username TEXT UNIQUE,
            password_hash TEXT,
            is_admin INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 兼容旧表：为已有 users 表添加新列（幂等）
    # SQLite ALTER TABLE 不支持直接加 UNIQUE 列，先加普通列再创建唯一索引
    _add_column_if_not_exists(cur, 'users', 'username', 'TEXT')
    _add_column_if_not_exists(cur, 'users', 'password_hash', 'TEXT')
    _add_column_if_not_exists(cur, 'users', 'is_admin', 'INTEGER DEFAULT 0')
    # 为 username 创建唯一索引（幂等）
    cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)")

    # 创建默认管理员账号（幂等）
    cur.execute("SELECT id FROM users WHERE username = ?", ('shenshuangshuo',))
    if not cur.fetchone():
        import hashlib
        pw_hash = hashlib.sha256('shenshuangshuo'.encode()).hexdigest()
        cur.execute(
            "INSERT INTO users (openid, nickname, role, username, password_hash, is_admin) VALUES (?,?,?,?,?,?)",
            ('admin_' + uuid.uuid4().hex[:16], '管理员', 'admin', 'shenshuangshuo', pw_hash, 1)
        )
        print("[数据库] 已创建默认管理员账号 (shenshuangshuo)")

    # progress 表（学习进度）
    cur.execute('''
        CREATE TABLE IF NOT EXISTS progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            exercise_id INTEGER NOT NULL,
            dictation_id INTEGER NOT NULL,
            user_input TEXT,
            total_words INTEGER DEFAULT 0,
            correct_words INTEGER DEFAULT 0,
            completed BOOLEAN DEFAULT 0,
            attempts INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE,
            UNIQUE(user_id, dictation_id)
        )
    ''')

    cur.execute("SELECT COUNT(*) FROM exercises")
    if cur.fetchone()[0] > 0:
        conn.close()
        return

    # ---- 1级（小学） ----
    _seed(cur, "Level 1 基础问候", 1,
        "极简单短句，5-8个词，日常问候和自我介绍", [
        ("Hello, how are you?", "hello - 你好"),
        ("My name is Tom.", "name - 名字"),
        ("I like apples.", "apple - 苹果"),
        ("She is a good girl.", "good - 好的 | girl - 女孩"),
        ("The sun is bright.", "sun - 太阳 | bright - 明亮的"),
    ])

    # ---- 2级（小学） ----
    _seed(cur, "Level 2 日常交流", 2,
        "简单句，日常活动和喜好表达", [
        ("What time do you get up?", "get up - 起床"),
        ("She is my best friend.", "best friend - 最好的朋友"),
        ("Can you help me please?", "help - 帮助"),
        ("I went to the park yesterday.", "park - 公园 | yesterday - 昨天"),
        ("We have English class on Monday.", "Monday - 星期一"),
    ])

    # ---- 3级（初中） ----
    _seed(cur, "Level 3 校园生活", 3,
        "初中难度，校园和日常生活话题", [
        ("I usually go to school by bus.", "usually - 通常 | by bus - 乘公交"),
        ("Could you tell me the way to the library?", "library - 图书馆"),
        ("My favorite subject is English.", "favorite - 最喜欢的 | subject - 科目"),
        ("We had a wonderful time at the party.", "wonderful - 精彩的 | party - 聚会"),
        ("Would you like to go to the cinema with me?", "cinema - 电影院"),
    ])

    # ---- 4级（高中） ----
    _seed(cur, "Level 4 社会话题", 4,
        "高中难度，较复杂句型和社会话题", [
        ("The government should take measures to protect the environment.",
         "government - 政府 | measure - 措施 | environment - 环境"),
        ("With the development of technology, our lives have changed dramatically.",
         "development - 发展 | technology - 科技 | dramatically - 显著地"),
        ("It is widely believed that education plays a crucial role in personal growth.",
         "widely - 广泛地 | crucial - 关键的 | growth - 成长"),
        ("Despite the heavy rain, they continued to work in the fields.",
         "despite - 尽管 | continue - 继续 | field - 田野"),
        ("The number of people using public transport has increased significantly.",
         "public transport - 公共交通 | increase - 增加 | significantly - 显著地"),
    ])

    # ---- 5级（大学） ----
    _seed(cur, "Level 5 学术入门", 5,
        "大学基础难度，学术和抽象话题", [
        ("The research indicates a significant correlation between diet and mental health.",
         "research - 研究 | indicate - 表明 | correlation - 关联 | diet - 饮食 | mental health - 心理健康"),
        ("Globalization has brought about both opportunities and challenges for developing countries.",
         "globalization - 全球化 | opportunity - 机会 | challenge - 挑战"),
        ("The novel explores the complex relationship between individual identity and social expectations.",
         "novel - 小说 | explore - 探索 | identity - 身份 | expectation - 期望"),
        ("Effective communication skills are essential in the modern workplace.",
         "effective - 有效的 | communication - 沟通 | essential - 必要的 | workplace - 职场"),
        ("Renewable energy sources are increasingly being adopted worldwide.",
         "renewable - 可再生的 | energy - 能源 | adopt - 采用 | worldwide - 全世界"),
    ])

    # ---- 6级（大学） ----
    _seed(cur, "Level 6 学术进阶", 6,
        "大学进阶难度，复杂学术表达", [
        ("The economic implications of this policy have been widely debated among scholars.",
         "economic - 经济的 | implication - 影响 | policy - 政策 | debate - 辩论 | scholar - 学者"),
        ("The unprecedented scale of urbanization poses significant challenges to sustainable development.",
         "unprecedented - 前所未有的 | urbanization - 城市化 | pose - 造成 | sustainable - 可持续的"),
        ("Empirical evidence suggests that early intervention can dramatically improve long-term outcomes.",
         "empirical - 实证的 | evidence - 证据 | intervention - 干预 | outcome - 结果"),
        ("The interplay between cultural heritage and modern innovation shapes the identity of contemporary cities.",
         "interplay - 相互作用 | heritage - 遗产 | innovation - 创新 | contemporary - 当代的"),
        ("Mitigating the adverse effects of climate change requires concerted efforts from all sectors of society.",
         "mitigate - 减轻 | adverse - 不利的 | climate change - 气候变化 | concerted - 协同的 | sector - 部门"),
    ])

    # ---- 7级（英语专业） ----
    _seed(cur, "Level 7 专业英语", 7,
        "英语专业难度，学术文本细读和批评性分析", [
        ("The nuanced interplay between language acquisition and cognitive development remains a subject of intense academic scrutiny.",
         "nuanced - 微妙的 | acquisition - 习得 | cognitive - 认知的 | scrutiny - 仔细审查"),
        ("The author's masterful use of stream of consciousness technique elevates the narrative beyond conventional storytelling.",
         "masterful - 熟练的 | stream of consciousness - 意识流 | elevate - 提升 | narrative - 叙事 | conventional - 传统的"),
        ("Postcolonial literary theory challenges the Eurocentric assumptions underlying canonical texts.",
         "postcolonial - 后殖民的 | challenge - 挑战 | assumption - 假设 | canonical - 权威的"),
        ("The dichotomy between empirical observation and theoretical abstraction characterizes much of the contemporary philosophical discourse.",
         "dichotomy - 二分法 | observation - 观察 | abstraction - 抽象 | characterize - 表征 | discourse - 话语"),
        ("Syntactic ambiguity in natural language processing presents formidable challenges for machine translation algorithms.",
         "syntactic - 句法的 | ambiguity - 歧义 | formidable - 艰巨的 | algorithm - 算法"),
    ])

    # ---- 8级（高端外语人才） ----
    _seed(cur, "Level 8 高阶思辨", 8,
        "高端外语人才难度，复杂逻辑和精细表达", [
        ("Notwithstanding the ostensibly irreconcilable ideological chasm, diplomatic negotiations yielded an unprecedented multilateral consensus.",
         "notwithstanding - 尽管 | ostensibly - 表面上 | irreconcilable - 不可调和的 | ideological - 意识形态的 | chasm - 鸿沟 | diplomatic - 外交的 | consensus - 共识"),
        ("The epistemological foundations of contemporary scientific inquiry have been fundamentally reconfigured by paradigm shifts in theoretical physics.",
         "epistemological - 认识论的 | foundation - 基础 | inquiry - 探究 | fundamentally - 根本地 | paradigm - 范式"),
        ("Juxtaposing the aesthetic sensibilities of the Baroque period with those of the Minimalist tradition reveals profound ontological divergences.",
         "juxtapose - 并列对比 | aesthetic - 美学的 | sensibility - 感受力 | Baroque - 巴洛克 | profound - 深刻的 | divergence - 分歧"),
        ("The pervasive ramifications of algorithmic decision-making necessitate a rigorous interdisciplinary examination of ethical accountability frameworks.",
         "pervasive - 普遍的 | ramification - 后果 | algorithmic - 算法的 | necessitate - 使成为必要 | rigorous - 严格的 | ethical - 伦理的 | accountability - 问责"),
    ])

    # ---- 9级（高端外语人才） ----
    _seed(cur, "Level 9 精通表达", 9,
        "精通级，自如深度沟通", [
        ("The hermeneutic interpretation of ancient philosophical treatises necessitates a thorough understanding of the socio-cultural context in which they were produced.",
         "hermeneutic - 诠释学的 | interpretation - 解释 | ancient - 古代的 | treatise - 专著 | thorough - 彻底的 | context - 背景"),
        ("The dialectical relationship between technological determinism and social constructivism continues to engender vigorous debate among contemporary sociologists of science.",
         "dialectical - 辩证的 | determinism - 决定论 | constructivism - 建构主义 | engender - 引起 | vigorous - 激烈的 | sociologist - 社会学家"),
        ("Quintessentially postmodern in its rejection of metanarratives, this literary work subverts traditional notions of authorial authority and textual stability.",
         "quintessentially - 典型地 | postmodern - 后现代的 | metanarrative - 元叙事 | subvert - 颠覆 | notion - 观念 | stability - 稳定性"),
        ("The confluence of geopolitical realignments, technological disruptions, and demographic shifts has precipitated a paradigmatic reconfiguration of the global order.",
         "confluence - 汇合 | geopolitical - 地缘政治的 | disruption - 中断 | demographic - 人口统计的 | precipitate - 加速导致 | reconfiguration - 重新配置 | global order - 全球秩序"),
    ])

    conn.commit()
    conn.close()
    print("[数据库] 初始化完成，已插入 9 个练习集及种子数据。")


def _seed(cur, title, level, description, sentences_with_notes):
    """插入练习集及其听写句"""
    stage = LEVEL_STAGE_MAP.get(level, "小学")
    cur.execute(
        "INSERT INTO exercises (title, level, stage, description) VALUES (?,?,?,?)",
        (title, level, stage, description)
    )
    ex_id = cur.lastrowid
    for i, (sentence, note) in enumerate(sentences_with_notes, 1):
        cur.execute(
            "INSERT INTO dictations (exercise_id, sentence, note, sort_order) VALUES (?,?,?,?)",
            (ex_id, sentence, note, i)
        )


if __name__ == '__main__':
    init_db()
