import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import VoiceButton from './components/voice/VoiceButton';
import ErrorBoundary from './components/common/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import BrochuresPage from './pages/BrochuresPage';
import CRMPage from './pages/CRMPage';
import SamplesPage from './pages/SamplesPage';
import EmailPage from './pages/EmailPage';
import PricingPage from './pages/PricingPage';
import AssistantPage from './pages/AssistantPage';
import { generateSampleFollowUps } from './lib/sampleFollowUp';

export default function App() {
  const location = useLocation();
  // Hide the floating voice button when the user is already on the
  // full-screen Assistant page — same engine, would be redundant.
  const hideVoiceButton = location.pathname === '/assistant';

  // Sample-delivery follow-up rule: scan delivered orders on mount and
  // draft a next-morning follow-up for any that crossed the 12h threshold
  // without one. Idempotent — won't duplicate. Fire-and-forget; the user
  // sees the drafts on their next visit to the Email tab.
  useEffect(() => {
    void generateSampleFollowUps();
  }, []);

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-bg text-fg overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 transition-all duration-200">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/brochures" element={<BrochuresPage />} />
              <Route path="/crm" element={<CRMPage />} />
              <Route path="/samples" element={<SamplesPage />} />
              <Route path="/email" element={<EmailPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/assistant" element={<AssistantPage />} />
            </Routes>
          </main>
        </div>
        {!hideVoiceButton && <VoiceButton />}
      </div>
    </ErrorBoundary>
  );
}
