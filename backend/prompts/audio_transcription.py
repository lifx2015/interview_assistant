AUDIO_QA_PARSE_PROMPT = """你是一位面试分析专家。以下是一段面试的完整语音转录文本，请将对话拆分为面试官和候选人的发言，并整理成问答对。

## 转录文本
{transcript_text}

## 候选人简历（如有）
{resume_context}

---

请以JSON格式返回：
```json
{{
  "transcript": [
    {{"role": "interviewer", "text": "面试官说的话"}},
    {{"role": "candidate", "text": "候选人说的话"}}
  ],
  "qa_history": [
    {{"question": "面试官的完整问题", "answer": "候选人的完整回答"}}
  ],
  "candidate_summary": {{
    "name": "从对话中提取的名字，无法确定则填空字符串",
    "summary": "从对话中推断的候选人背景简述"
  }}
}}
```

判断规则：
- 提问者、追问者、引导对话方向的是面试官
- 回答问题、描述经历、展示技能的是候选人
- 如果有简历上下文，结合简历内容辅助判断
- 每个问答对中，question 包含该轮中面试官的所有发言，answer 包含该轮中候选人的所有发言
- 只返回JSON，不要其他内容"""
