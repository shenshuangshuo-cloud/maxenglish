"""
英语听力听写网站 - 配置管理
所有敏感配置从环境变量读取，提供合理的本地开发默认值。
"""

import os


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'change-me-in-production')
    WECHAT_APP_ID = os.environ.get('WECHAT_APP_ID', '')
    WECHAT_APP_SECRET = os.environ.get('WECHAT_APP_SECRET', '')
    WECHAT_REDIRECT_URI = os.environ.get(
        'WECHAT_REDIRECT_URI',
        'http://your-domain.com/api/auth/wechat/callback'
    )
    DATABASE_PATH = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), 'dictation.db'
    )
