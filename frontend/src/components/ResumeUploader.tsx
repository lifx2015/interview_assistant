import React, { useCallback, useState } from 'react';
import type { CandidateInfo, ResumeUploadResponse } from '../types';

interface Props {
  onUploadSuccess: (sessionId: string, candidate: CandidateInfo) => void;
}

export const ResumeUploader: React.FC<Props> = ({ onUploadSuccess }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(async (file: File) => {
    setIsUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/resume/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Upload failed');
      }
      const data: ResumeUploadResponse = await res.json();
      onUploadSuccess(data.session_id, data.candidate);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [onUploadSuccess]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  return (
    <div
      className={`resume-uploader ${isDragging ? 'dragging' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="1.5" opacity="0.6">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <polyline points="9 15 12 12 15 15" />
      </svg>
      <p className="upload-text">{isUploading ? '解析中...' : '拖拽简历至此或点击上传'}</p>
      <p className="upload-hint">PDF / Word / 图片</p>
      <input type="file" accept=".pdf,.docx,.doc,.png,.jpg,.jpeg" onChange={handleChange} style={{ display: 'none' }} id="resume-input" />
      <label htmlFor="resume-input" className="btn btn-primary upload-btn">选择文件</label>
      {error && <p className="upload-error">{error}</p>}

      <style>{`
        .resume-uploader {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          height: 100%; padding: 40px 24px; text-align: center;
          border: 2px dashed var(--border-color); border-radius: var(--radius);
          cursor: pointer; transition: all 0.3s;
        }
        .resume-uploader.dragging { border-color: var(--accent-cyan); background: rgba(0,212,255,0.05); }
        .upload-text { font-size: 14px; color: var(--text-primary); margin: 16px 0 4px; }
        .upload-hint { font-size: 12px; color: var(--text-muted); margin-bottom: 16px; }
        .upload-btn { cursor: pointer; }
        .upload-error { color: var(--accent-red); font-size: 12px; margin-top: 10px; }
      `}</style>
    </div>
  );
};
