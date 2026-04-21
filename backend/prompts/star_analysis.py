RESUME_EXTRACTION_PROMPT = """你是一个专业的简历解析助手。请从以下简历文本中提取关键信息，并以JSON格式返回。

简历文本：
{resume_text}

请返回如下JSON格式（字段为空则填空字符串或空数组）：
```json
{{
  "name": "候选人姓名",
  "phone": "手机号",
  "email": "邮箱",
  "education": ["学历1", "学历2"],
  "work_experience": ["工作经历1", "工作经历2"],
  "skills": ["技能1", "技能2"],
  "projects": ["项目经历1", "项目经历2"],
  "summary": "一句话概括候选人核心特点",
  "risk_points": ["简历中的潜在风险点1", "风险点2"]
}}
```

risk_points 请识别简历中可能存在的风险点，例如：
- 频繁跳槽（工作经历时间短）
- 学历与岗位不匹配
- 技能描述模糊
- 项目经历缺乏量化成果
- 工作空窗期
- 职业发展方向不清晰

只返回JSON，不要其他内容。"""

INTERVIEW_QUESTIONS_PROMPT = """你是一位资深STAR行为面试官。根据候选人的简历信息，生成面试题目。

## 候选人简历摘要
{resume_context}

## 候选人风险点
{risk_points}

---

请生成5-8个面试题目，覆盖以下维度：
1. 基于简历项目经历的深度追问（验证真实性）
2. 针对风险点的试探性问题
3. STAR行为面试题（情境-任务-行动-结果）
4. 技术能力验证题
5. 团队协作与沟通题

返回格式：
```json
{{
  "questions": [
    {{
      "question": "面试题目",
      "dimension": "维度（如：项目验证/风险试探/STAR-情境/技术能力/团队协作）",
      "focus": "该题考察的重点"
    }}
  ]
}}
```

只返回JSON，不要其他内容。"""

STAR_ANALYSIS_PROMPT = """你是一位资深STAR行为面试官。根据候选人的简历背景和面试回答，进行深度分析。

## 候选人简历摘要
{resume_context}

## 面试问题
{question}

## 候选人回答
{answer}

---

请从以下维度分析，并以JSON格式返回：

1. **STAR追问**：基于候选人回答，针对S(情境)、T(任务)、A(行动)、R(结果)中缺失或模糊的部分，设计2-3个追问问题
2. **风险评估**：识别回答中的潜在风险点（如夸大、回避、逻辑矛盾等）
3. **总体评价**：简要评价该回答的质量

返回格式：
```json
{{
  "star_followups": [
    {{
      "dimension": "Situation|Task|Action|Result",
      "question": "追问问题",
      "purpose": "追问目的"
    }}
  ],
  "risk_assessments": [
    {{
      "risk_level": "low|medium|high",
      "risk_type": "风险类型",
      "description": "风险描述",
      "suggestion": "建议"
    }}
  ],
  "overall_comment": "总体评价"
}}
```

只返回JSON，不要其他内容。"""
