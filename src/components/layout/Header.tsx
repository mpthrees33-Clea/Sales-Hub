import { Menu, Bell } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useLocation } from 'react-router-dom';

const PAGE_TITLES: Record<string, string> = {
  '/':          'Dashboard',
  '/brochures': 'Brochures & Catalogs',
  '/crm':       'CRM',
  '/samples':   'Sample Orders',
  '/email':     'Email',
  '/pricing':   'Pricing',
};

export default function Header() {
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] ?? 'Sales Hub';

  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 shadow-sm">
      <button
        className="p-1.5 rounded-md hover:bg-slate-100 lg:hidden"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
      >
        <Menu size={20} className="text-slate-600" />
      </button>

      {/* Desktop hamburger (always visible to allow collapse) */}
      <button
        className="hidden lg:flex p-1.5 rounded-md hover:bg-slate-100"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
      >
        <Menu size={20} className="text-slate-600" />
      </button>

      <h1 className="flex-1 text-base font-semibold text-slate-800">{title}</h1>

      <button className="p-1.5 rounded-md hover:bg-slate-100" aria-label="Notifications">
        <Bell size={20} className="text-slate-500" />
      </button>

      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
        ST
      </div>
    </header>
  );
}
