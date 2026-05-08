import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, Users, Package,
  Mail, DollarSign, X, Mic,
} from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '../../store/useAppStore';

const NAV_ITEMS = [
  { to: '/',          label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/brochures', label: 'Brochures',   icon: BookOpen },
  { to: '/crm',       label: 'CRM',         icon: Users },
  { to: '/samples',   label: 'Samples',     icon: Package },
  { to: '/email',     label: 'Email',       icon: Mail },
  { to: '/pricing',   label: 'Pricing',     icon: DollarSign },
  { to: '/assistant', label: 'Assistant',   icon: Mic },
];

export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useAppStore();

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-30 flex flex-col w-60 bg-surface border-r border-divider transition-transform duration-200',
          'lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo / header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-divider">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-accent-light uppercase">Trinity</p>
            <p className="text-base font-semibold leading-tight text-fg mt-0.5">Sales Hub</p>
          </div>
          <button
            className="lg:hidden p-1.5 rounded-md text-fg-muted hover:bg-surface-2 hover:text-fg transition-colors"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin py-4 px-3 space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => {
                if (window.innerWidth < 1024) setSidebarOpen(false);
              }}
              className={({ isActive }) =>
                clsx(
                  'group flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all relative',
                  isActive
                    ? 'bg-accent/15 text-accent-light'
                    : 'text-fg-muted hover:bg-surface-2 hover:text-fg'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-accent-light rounded-r" />
                  )}
                  <Icon size={17} className={clsx('shrink-0', isActive && 'text-accent-light')} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-divider text-[11px] text-fg-faint">
          Trinity Surfaces © 2025
        </div>
      </aside>
    </>
  );
}
