import { motion } from 'framer-motion'

const colorMap = {
  primary: { bg: 'bg-sky-50', border: 'border-sky-100', icon: 'bg-sky-500/10 text-sky-600', value: 'text-sky-700' },
  accent:  { bg: 'bg-amber-50', border: 'border-amber-100', icon: 'bg-amber-500/10 text-amber-600', value: 'text-amber-700' },
  danger:  { bg: 'bg-red-50', border: 'border-red-100', icon: 'bg-red-500/10 text-red-600', value: 'text-red-700' },
  success: { bg: 'bg-emerald-50', border: 'border-emerald-100', icon: 'bg-emerald-500/10 text-emerald-600', value: 'text-emerald-700' },
  purple:  { bg: 'bg-violet-50', border: 'border-violet-100', icon: 'bg-violet-500/10 text-violet-600', value: 'text-violet-700' },
  cyan:    { bg: 'bg-cyan-50', border: 'border-cyan-100', icon: 'bg-cyan-500/10 text-cyan-600', value: 'text-cyan-700' },
}

export default function StatsCard({ icon: Icon, label, value, subtitle, color = 'primary' }) {
  const c = colorMap[color] || colorMap.primary

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.3 }}
      className={`${c.bg} ${c.border} border rounded-2xl p-5 cursor-default`}
    >
      <div className={`w-10 h-10 rounded-xl ${c.icon} flex items-center justify-center mb-3`}>
        <Icon size={20} strokeWidth={1.8} />
      </div>
      <p className="text-[11px] font-medium text-text-muted uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-extrabold ${c.value} mt-0.5`}>{value}</p>
      {subtitle && <p className="text-[10px] text-text-muted mt-1">{subtitle}</p>}
    </motion.div>
  )
}
