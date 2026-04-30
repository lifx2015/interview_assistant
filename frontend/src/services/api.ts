const API_BASE = '/api';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

function jsonBody(data: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  };
}

function putBody(data: unknown): RequestInit {
  return {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  };
}

// ── Resume ──────────────────────────────────────────────
export const resumeApi = {
  upload: (formData: FormData, jobRequirement?: { name: string; description: string } | null) => {
    const params = new URLSearchParams();
    if (jobRequirement?.name) params.set('job_requirement_name', jobRequirement.name);
    if (jobRequirement?.description) params.set('job_requirement_desc', jobRequirement.description);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return fetch(`${API_BASE}/resume/upload${qs}`, { method: 'POST', body: formData }).then(async r => {
      if (!r.ok) {
        const err = await r.json().catch(() => ({ detail: 'Upload failed' }));
        throw new Error(err.detail || `Upload failed: ${r.status}`);
      }
      return r.json();
    });
  },
};

// ── Interview ───────────────────────────────────────────
export const interviewApi = {
  save: (data: unknown) => apiFetch('/interview/save', jsonBody(data)),
  load: (sessionId: string) => apiFetch(`/interview/${sessionId}/load`),
  list: () => apiFetch('/interview/list'),
};

// ── Question Banks ──────────────────────────────────────
export const questionBankApi = {
  list: () => apiFetch('/question-bank/list'),
  get: (id: string) => apiFetch(`/question-bank/${id}`),
  create: (data: unknown) => apiFetch('/question-bank/create', jsonBody(data)),
  update: (id: string, data: unknown) => apiFetch(`/question-bank/${id}`, putBody(data)),
  delete: (id: string) => apiFetch(`/question-bank/${id}`, { method: 'DELETE' }),
  addQuestion: (bankId: string, data: unknown) =>
    apiFetch(`/question-bank/${bankId}/questions`, jsonBody(data)),
  updateQuestion: (bankId: string, qId: string, data: unknown) =>
    apiFetch(`/question-bank/${bankId}/questions/${qId}`, putBody(data)),
  deleteQuestion: (bankId: string, qId: string) =>
    apiFetch(`/question-bank/${bankId}/questions/${qId}`, { method: 'DELETE' }),
  importMarkdown: (bankId: string, data: unknown) =>
    apiFetch(`/question-bank/${bankId}/import`, jsonBody(data)),
};

// ── Voiceprints ─────────────────────────────────────────
export const voiceprintApi = {
  list: () => apiFetch('/voiceprint/list'),
  providers: () => apiFetch('/voiceprint/providers'),
  switchProvider: (provider: string) => apiFetch('/voiceprint/provider', jsonBody({ provider })),
  delete: (voiceId: string) => apiFetch(`/voiceprint/delete/${voiceId}`, { method: 'DELETE' }),
  clear: () => apiFetch('/voiceprint/clear', { method: 'DELETE' }),
};

// ── Job Requirements ────────────────────────────────────
export const jobRequirementApi = {
  list: () => apiFetch('/job-requirement/list'),
  get: (id: string) => apiFetch(`/job-requirement/${id}`),
  create: (data: unknown) => apiFetch('/job-requirement/create', jsonBody(data)),
  update: (id: string, data: unknown) => apiFetch(`/job-requirement/${id}`, putBody(data)),
  delete: (id: string) => apiFetch(`/job-requirement/${id}`, { method: 'DELETE' }),
};