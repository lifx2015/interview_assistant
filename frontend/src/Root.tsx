import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App.tsx';
import { VoiceprintManagementPage } from './pages/VoiceprintManagementPage';
import { QuestionBankPage } from './pages/QuestionBankPage';
import { JobRequirementPage } from './pages/JobRequirementPage';

function Root() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/voiceprint" element={<VoiceprintManagementPage />} />
        <Route path="/question-bank" element={<QuestionBankPage />} />
        <Route path="/job-requirement" element={<JobRequirementPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default Root;
