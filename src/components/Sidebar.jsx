import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Database, HardDrive, DollarSign, Settings } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/',           icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/realtime',   icon: Database,        label: 'Realtime DB' },
  { to: '/storage',    icon: HardDrive,       label: 'Storage' },
  { to: '/costing',    icon: DollarSign,      label: 'Cost Calculator' },
  { to: '/settings',   icon: Settings,        label: 'Settings' },
]

export default function Topbar({ rightSlot }) {
  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-surface/80 backdrop-blur-md border-b border-surface-lighter/60 flex items-center px-4 z-50">
      {/* Logo - left */}
      <div className="flex items-center gap-2 shrink-0 pr-6 border-r border-surface-lighter/60 mr-4">
        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shrink-0 shadow-sm">
          <span className="text-white text-[11px] font-bold">W</span>
        </div>
        <div className="leading-none">
          <h1 className="text-[13px] font-bold text-text tracking-tight">
            We<span className="text-emerald-500">VOIS</span>
          </h1>
          <p className="text-[9px] text-text-muted tracking-wide uppercase">Developer Tool</p>
        </div>
      </div>

      {/* Navigation - center */}
      <nav className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-0.5 bg-surface-light/60 rounded-lg p-0.5">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-200
                 ${isActive
                   ? 'bg-surface text-primary shadow-sm'
                   : 'text-text-muted hover:text-text'}`
              }
            >
              <Icon size={14} strokeWidth={1.5} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Right slot */}
      <div className="shrink-0 pl-4">
        {rightSlot}
      </div>
    </header>
  )
}
