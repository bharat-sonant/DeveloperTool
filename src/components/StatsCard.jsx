export default function StatsCard({ icon: Icon, label, value, subtitle, color = 'primary', trend }) {
  const colorMap = {
    primary: 'from-primary/20 to-primary/5 border-primary/20 text-primary-light',
    accent:  'from-amber-500/20 to-amber-500/5 border-amber-500/20 text-amber-400',
    danger:  'from-red-500/20 to-red-500/5 border-red-500/20 text-red-400',
    success: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-400',
    purple:  'from-purple-500/20 to-purple-500/5 border-purple-500/20 text-purple-400',
    cyan:    'from-cyan-500/20 to-cyan-500/5 border-cyan-500/20 text-cyan-400',
  }

  return (
    <div className={`bg-gradient-to-br ${colorMap[color]} border rounded-2xl p-5 backdrop-blur-sm`}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
          <Icon size={20} />
        </div>
        {trend && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/5">{trend}</span>
        )}
      </div>
      <p className="text-2xl font-bold text-text">{value}</p>
      <p className="text-xs text-text-muted mt-1">{label}</p>
      {subtitle && <p className="text-[10px] text-text-muted/70 mt-0.5">{subtitle}</p>}
    </div>
  )
}
