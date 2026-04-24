# AGENTS.md — AI Interview Assistant

## 项目概述

STAR 行为面试 AI 辅助系统。后端 FastAPI + DashScope (Qwen LLM + FunASR)，前端 React 19 + TypeScript + Vite。

## 启动

```bash
# 后端 (需要 .env 中的 DASHSCOPE_API_KEY)
cd backend && pip install -r requirements.txt && uvicorn backend.main:app --reload --port 8000

# 前端
cd frontend && npm install && npm run dev
```

## 架构要点

- **后端入口**: `backend/main.py` — FastAPI app，路由挂载在 `/api` 前缀，WebSocket 无前缀
- **前端入口**: `frontend/src/App.tsx` — 编排 useInterview + useWebSocket + useAudioCapture 三个核心 Hook
- **实时通信**: WebSocket `/ws/asr/{session_id}` 处理 ASR + 增量分析 + 面试评估；SSE 处理题目生成
- **LLM 调用**: 全部通过 `backend/services/llm_service.py`，使用 DashScope SDK 流式调用 Qwen
- **Prompt 模板**: 全部在 `backend/prompts/star_analysis.py`，4 个模板
- **数据库**: SQLite 单表 `interviews`，`backend/services/database.py`，启动时自动迁移
- **会话状态**: 内存 dict `backend/routers/sessions.py`，服务重启后丢失
- **声纹识别**: 策略模式，`SimpleSpeakerRecognizer` (音频哈希) 和 `SpeechBrainRecognizer` (ECAPA-TDNN)，运行时可切换

## 关键数据流

```
麦克风 → useAudioCapture → encodePCM(16kHz 16bit) → WebSocket → DashScope ASR
ASR 结果 → useInterview.handleASRResult → 更新 transcript/followUpRaw/evaluationRaw
回答完毕 → ws.send(answer_complete) → 后端追加 QA 到 conversation_history
结束面试 → ws.send(stop) → 后端生成面试评估 → evaluation_stream
```

## 编码规范

- 后端: Python type-annotated, async/await, Pydantic v2 models
- 前端: React 函数组件 + Hooks, TypeScript strict mode
- 样式: CSS Modules (`*.module.css`) + CSS 自定义属性，暗色主题
- LLM 输出: Markdown 格式，流式渲染

## 注意事项

- 前端音频用 `AudioWorklet` (`worklets/pcm-processor.ts`)，PCM 格式 16kHz 16bit 单声道，重采样在 Worklet 线程完成
- 声纹文件必须保存为 WAV 格式 (torchaudio 要求)，`voiceprint_service.pcm_to_wav()` 做转换
- 增量分析有防抖机制 (`_incremental_in_flight` / `_incremental_pending`)，防止 LLM 调用重叠；含 30s 超时自动释放
- 对话历史压缩: `_compress_history()` 保留最近 3 轮完整对话，更早的摘要化
- `GLOBAL_INTERVIEWER_SESSION = "global_interviewers"`，前端声纹注册必须用此值
- WebSocket 断连/错误通过 `StatusBar` 组件提示用户，支持重新连接；LLM 错误通过 `appError` 状态显示

## 测试

目前无自动化测试。手动验证流程:
1. 上传简历 → 确认候选人信息显示
2. 点击开始录音 → 确认 ASR 转写正常
3. 切换角色 → 确认气泡方向正确
4. 回答完毕 → 确认追问/风险提示出现
5. 关闭面试 → 确认面试评估生成
6. 保存 → 确认可从列表加载
