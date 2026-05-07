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
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-30 flex flex-col w-56 bg-slate-900 text-white transition-transform duration-200',
          'lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo / header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-700">
          <div>
            <p className="text-xs font-semibold tracking-widest text-blue-400 uppercase">Trinity</p>
            <p className="text-sm font-bold leading-tight">Sales Hub</p>
          </div>
          <button
            className="lg:hidden p-1 rounded hover:bg-slate-700"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => {
                // Close sidebar on mobile after nav
                if (window.innerWidth < 1024) setSidebarOpen(false);
              }}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-700 text-xs text-slate-500">
          Trinity Surfaces © 2025
        </div>
      </aside>
    </>
  );
}
