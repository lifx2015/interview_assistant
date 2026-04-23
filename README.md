# AI Interview Assistant (智能面试助手)

基于 STAR 行为面试法的 AI 面试辅助系统，提供实时语音转写、追问建议、风险提示、声纹识别和面试评估功能。

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | FastAPI + Uvicorn, DashScope (Qwen LLM + FunASR), SQLite (aiosqlite), SpeechBrain (ECAPA-TDNN) |
| 前端 | React 19 + TypeScript, Vite, react-router-dom, react-markdown |
| 实时通信 | WebSocket (ASR + 增量分析), SSE (题目生成) |

## 项目结构

```
interview_assistant/
├── backend/
│   ├── main.py                    # FastAPI 入口，路由注册，CORS 配置
│   ├── config.py                  # Pydantic Settings，从 .env 加载配置
│   ├── requirements.txt           # Python 依赖
│   ├── models/
│   │   └── schemas.py             # Pydantic 数据模型 (CandidateInfo, QARecord 等)
│   ├── routers/
│   │   ├── resume.py              # 简历上传 & PDF 查看
│   │   ├── interview.py           # 面试保存/加载/题目生成
│   │   ├── ws_asr.py              # WebSocket ASR + 实时分析 + 面试评估
│   │   ├── voiceprint.py          # 声纹注册/识别/管理
│   │   ├── question_bank.py       # 题库 CRUD + Markdown 导入
│   │   └── sessions.py            # 内存会话存储
│   ├── services/
│   │   ├── asr_service.py         # DashScope 实时 ASR
│   │   ├── database.py            # SQLite 持久化
│   │   ├── llm_service.py         # DashScope Qwen LLM 流式调用
│   │   ├── resume_parser.py       # PDF/DOCX 文本提取
│   │   ├── speaker_recognition.py # 声纹识别 (Simple + SpeechBrain)
│   │   └── voiceprint_service.py  # 声纹管理服务
│   └── prompts/
│       └── star_analysis.py       # 4 个 LLM Prompt 模板
├── frontend/
│   ├── package.json
│   ├── vite.config.ts             # Vite 配置，API/WS 代理
│   └── src/
│       ├── main.tsx               # React 入口
│       ├── Root.tsx               # 路由 (/, /voiceprint, /question-bank)
│       ├── App.tsx                # 主面试页面，编排 3 个核心 Hook
│       ├── types/index.ts         # TypeScript 类型定义
│       ├── hooks/
│       │   ├── useInterview.ts    # 面试状态管理 (核心 Hook)
│       │   ├── useWebSocket.ts    # WebSocket 连接管理
│       │   ├── useAudioCapture.ts # 麦克风音频采集
│       ├── components/
│       │   ├── MainLayout.tsx      # 三栏可拖拽布局 + Tab 切换
│       │   ├── ControlBar.tsx      # 录音控制 (开始/暂停/停止/角色切换)
│       │   ├── TranscriptPanel.tsx # 实时转写气泡
│       │   ├── QuestionPanel.tsx   # 题目 + 追问 + 题库 Tab
│       │   ├── AnalysisPanel.tsx   # 面试评估渲染
│       │   ├── CandidatePanel.tsx  # 候选人信息展示
│       │   ├── ResumeUploader.tsx  # 简历上传
│       │   ├── PDFViewer.tsx       # PDF 内嵌查看
│       │   ├── NotePanel.tsx       # 面试笔记编辑器
│       │   ├── InterviewListPanel.tsx # 已保存面试列表
│       │   ├── MarkdownRenderer.tsx   # Markdown 渲染
│       │   └── VoiceprintPanel.tsx    # (未使用，被独立页面替代)
│       ├── pages/
│       │   ├── VoiceprintManagementPage.tsx # 声纹管理页
│       │   ├── QuestionBankPage.tsx         # 题库管理页
│       ├── utils/
│       │   └── audioUtils.ts       # PCM 编码 + 重采样
│       └── styles/
│           ├── global.css          # CSS 变量 + 全局样式
│           ├── animations.css      # 动画关键帧
│           └── markdown.css        # Markdown 渲染样式
├── data/                           # 运行时数据 (gitignore)
│   ├── interviews.db               # SQLite 数据库
│   ├── question_banks/             # 题库 JSON 文件
│   └── voiceprints/                # 声纹 WAV + voiceprints.json
├── model_cache/                    # SpeechBrain 模型缓存
├── .env                            # 环境变量 (DASHSCOPE_API_KEY)
├── .env.example                    # 环境变量模板
└── .gitignore
```

## 快速启动

### 1. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填入 DASHSCOPE_API_KEY
```

### 2. 启动后端

```bash
cd backend
pip install -r requirements.txt
# 可选：安装 SpeechBrain 增强声纹识别
pip install speechbrain torch torchaudio numpy
uvicorn backend.main:app --reload --port 8000
```

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端开发服务器默认 `http://localhost:5173`，Vite 代理 `/api` 和 `/ws` 到后端。

### 4. 生产部署

```bash
cd frontend
npm run build
# 将 frontend/dist 目录由后端或 Nginx 提供静态服务
```

## 核心功能流程

### 面试流程

```
上传简历 → LLM 提取候选人信息 + 风险点
         → 生成 10 道针对性面试题
         → 开始录音 (WebSocket ASR)
         → 候选人说话时实时生成追问建议 + 风险提示
         → 点击"回答完毕"结束本轮，开始下一轮
         → 点击"关闭"结束面试 → 生成整体面试评估
         → 保存面试数据
```

### 声纹识别流程

```
录入面试官声纹 (10秒录音) → 注册到全局声纹库
面试中启用声纹 → 自动检测说话人身份 → 自动切换角色
```

## API 接口

### REST API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/resume/upload` | 上传简历 (PDF/DOCX/DOC/Image) |
| GET | `/api/resume/{id}/pdf` | 获取简历 PDF |
| POST | `/api/interview/save` | 保存面试数据 |
| GET | `/api/interview/list` | 面试列表 |
| GET | `/api/interview/{id}/load` | 加载面试 |
| GET | `/api/interview/{id}/generate-questions` | SSE 流式生成题目 |
| CRUD | `/api/question-bank/*` | 题库管理 |
| CRUD | `/api/voiceprint/*` | 声纹管理 |
| GET | `/api/health` | 健康检查 |

### WebSocket (`/ws/asr/{session_id}`)

**客户端 → 服务端 (二进制)**: 16kHz 16bit 单声道 PCM 音频帧

**客户端 → 服务端 (JSON)**:
- `switch_role` / `enable_voiceprint` / `disable_voiceprint`
- `answer_complete` / `pause` / `resume` / `stop`

**服务端 → 客户端 (JSON)**:
- `partial` / `sentence` — ASR 结果
- `role_switched` — 角色切换通知
- `follow_up_stream` / `follow_up_complete` / `follow_up_clear` — 追问流
- `answer_complete_ack` — 回答提交确认
- `evaluation_start` / `evaluation_stream` / `evaluation_complete` — 面试评估流

## 数据库

SQLite 单表 `interviews`，字段包括 session_id, candidate(JSON), qa_history(JSON), transcript(JSON), analysis_raw, questions_raw, notes, pdf_content(BLOB) 等。启动时自动建表和迁移。

## LLM Prompt 模板

| 模板 | 用途 | 输入 |
|------|------|------|
| `RESUME_EXTRACTION_PROMPT` | 简历结构化提取 | 简历原文 |
| `INTERVIEW_QUESTIONS_PROMPT` | 生成 10 道面试题 | 简历摘要 + 风险点 |
| `INCREMENTAL_ANALYSIS_PROMPT` | 实时追问 + 风险提示 | 简历 + 对话历史 + 当前回答 |
| `STAR_ANALYSIS_PROMPT` | 面试整体评估 | 简历 + 全部问答记录 |

## 配置项

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DASHSCOPE_API_KEY` | (必填) | 阿里云 DashScope API Key |
| `LLM_MODEL` | `qwen-plus` | LLM 模型名 |
| `ASR_MODEL` | `fun-asr-realtime` | ASR 模型名 |
| `HOST` | `0.0.0.0` | 服务绑定地址 |
| `PORT` | `8000` | 服务端口 |
| `DATABASE_PATH` | `data/interviews.db` | SQLite 文件路径 |
| `CORS_ORIGINS` | `["http://localhost:5173","http://localhost:3000"]` | CORS 允许源 |

## 优化建议

### 架构层面

1. **会话状态持久化**: 当前 `sessions.py` 使用内存 dict，服务重启后丢失。面试进行中的状态应同步写入数据库，或使用 Redis。
### 功能层面
2. **面试评估触发时机**: 当前仅在 WebSocket `stop` 时触发，如果 WebSocket 异常断开则不会生成评估。建议增加 HTTP API 触发评估作为兜底。
3. **PDF 查看**: 使用 iframe 加载整个 PDF，大文件时内存占用高。建议使用 pdf.js 分页渲染。


 





4. **前端状态管理**: `useInterview` 有 20+ 个 state，每次更新触发大量重渲染。建议拆分为多个独立 state 或引入 Zustand/Jotai。
3. **增量分析去重**: 当前每个句子都触发一次 LLM 调用，短句（如"嗯"、"对"）也会触发，浪费 API 调用。建议增加最小长度或语义过滤。
5. **音频采集**: 使用已废弃的 `ScriptProcessorNode`，建议迁移到 `AudioWorklet` 以获得更好的性能和更少的音频卡顿。
6. **VoiceprintPanel 组件**: 存在于 `components/` 但未被使用，已被独立页面替代，应清理删除。
7. **错误处理**: WebSocket 断连、LLM 调用失败等场景缺少前端友好提示，用户只看到空白。

### 性能层面

8. **LLM 调用并发控制**: `_incremental_in_flight` 用 dict 管理，但无超时机制，如果 LLM 调用卡住，后续句子会一直排队。建议增加超时自动释放。
6. **SQL 注入**: 当前用参数化查询，但建议全面审计所有数据库操作。
### 安全层面
4. **WebSocket 无认证**: 任何人都可以连接 `/ws/asr/{session_id}`，建议增加 token 验证。
5. **文件上传无类型校验**: 仅靠前端限制文件类型，后端应增加 magic bytes 校验。