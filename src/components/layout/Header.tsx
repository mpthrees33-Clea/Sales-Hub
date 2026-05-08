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
  '/assistant': 'Assistant',
};

export default function Header() {
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] ?? 'Sales Hub';

  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 px-4 lg:px-6 py-3 bg-bg/80 backdrop-blur-md border-b border-divider">
      <button
        className="p-1.5 rounded-md text-fg-muted hover:bg-surface-2 hover:text-fg transition-colors lg:hidden"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
      >
        <Menu size={20} />
      </button>

      <button
        className="hidden lg:flex p-1.5 rounded-md text-fg-muted hover:bg-surface-2 hover:text-fg transition-colors"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
      >
        <Menu size={20} />
      </button>

      <h1 className="flex-1 text-base font-semibold text-fg tracking-tight">{title}</h1>

      <button
        className="p-1.5 rounded-md text-fg-muted hover:bg-surface-2 hover:text-fg transition-colors"
        aria-label="Notifications"
      >
        <Bell size={19} />
      </button>

      <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent-light text-xs font-bold">
        ST
      </div>
    </header>
  );
}
