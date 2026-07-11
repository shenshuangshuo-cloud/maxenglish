# MicroEnglish — 英语听力听写练习

基于 Flask + SQLite 的英语听力听写网站，逐词输入交互模式，支持移动端响应式布局。

## 功能

- **9 级难度**：43 句听写句，按语言能力分级
- **逐词输入**：每个词独立输入框，正确绿底/错误红底
- **音频播放**：gTTS 生成英式发音 MP3
- **免登录试用**：游客直接体验
- **管理员后台**：用户管理 + 音频管理
- **响应式设计**：手机/平板/桌面自适应

## 本地运行

`ash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 启动
python app.py

# 3. 打开浏览器
http://localhost:5000
`

管理员账号：shenshuangshuo / shenshuangshuo

## 部署

本项目支持多种部署方式：

| 平台 | 说明 |
|------|------|
| **Railway** | 一键部署，支持 SQLite（推荐） |
| **Render** | 免费 Web Service，自动构建 |
| **Docker** | 已有 Dockerfile，docker build -t microenglish . |

## 技术栈

- Python Flask
- SQLite
- gTTS（Google Text-to-Speech）
- 原生 HTML/CSS/JS
