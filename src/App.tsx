import { Routes, Route } from 'react-router-dom';
import { useAppStore } from './store/useAppStore';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import clsx from 'clsx';
import Dashboard from './pages/Dashboard';
import BrochuresPage from './pages/BrochuresPage';
import CRMPage from './pages/CRMPage';
import SamplesPage from './pages/SamplesPage';
import EmailPage from './pages/EmailPage';
import PricingPage from './pages/PricingPage';
import AssistantPage from './pages/AssistantPage';

export default function App() {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);

  return (
    <div className="flex h-screen bg-bg text-fg overflow-hidden">
      <Sidebar />
      <div
        className={clsx(
          'flex flex-col flex-1 min-w-0 transition-all duration-200',
        )}
      >
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
    </div>
  );
}
