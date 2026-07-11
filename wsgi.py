"""WSGI 入口，用于 Gunicorn / uWSGI 部署"""
from app import app

if __name__ == '__main__':
    app.run()
