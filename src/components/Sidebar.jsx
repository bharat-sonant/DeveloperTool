import { NavLink } from 'react-router-dom'
import { HardDrive, Settings, Sparkles } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/storage',    icon: HardDrive,       label: 'Storage Cleanup' },
  { to: '/settings',   icon: Settings,        label: 'Settings' },
]

export default function Topbar() {
  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-white/70 backdrop-blur-xl border-b border-surface-lighter/50 flex items-center px-5 z-50">
      {/* Logo */}
      <div className="flex items-center gap-2.5 shrink-0 pr-6 border-r border-surface-lighter/50 mr-5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-cyan-400 flex items-center justify-center shadow-md shadow-sky-500/20">
          <Sparkles size={16} className="text-white" strokeWidth={2.5} />
        </div>
        <div className="leading-none">
          <h1 className="text-[13px] font-extrabold text-text tracking-tight">
            Data<span className="text-primary">Cleaner</span>
          </h1>
          <p className="text-[8px] text-text-muted tracking-widest uppercase font-medium">WeVOIS Tool</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-1 bg-surface-light/80 rounded-xl p-1 border border-surface-lighter/50">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-semibold transition-all duration-200
                 ${isActive
                   ? 'bg-white text-primary shadow-sm border border-surface-lighter/60'
                   : 'text-text-muted hover:text-text hover:bg-white/50'}`
              }
            >
              <Icon size={14} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Right spacer */}
      <div className="shrink-0 w-[140px]" />
    </header>
  )
}
