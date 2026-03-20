import { useState, useEffect } from 'react'
import { Database, HardDrive, DollarSign, MapPin, BarChart3, Loader2, RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'
import StatsCard from '../components/StatsCard'
import { getDbNodeSize, getDbChildren, getStorageFolderSize, isConfigured } from '../lib/firebase'
import { formatBytes, estimateCost } from '../lib/utils'

const DATA_SECTIONS = [
  { key: 'skipImages',           label: 'Skip Images',              dbPath: 'skipImages',           storagePath: 'skipImages',           icon: '🖼️' },
  { key: 'attendanceData',      label: 'Attendance Data',           dbPath: 'attendance',           storagePath: null,                    icon: '📋' },
  { key: 'attendanceImages',    label: 'Attendance Images',         dbPath: null,                    storagePath: 'attendanceImages',     icon: '📸' },
  { key: 'fieldTrackingImages', label: 'Field Tracking Images',     dbPath: null,                    storagePath: 'fieldTrackingImages',  icon: '🗺️' },
  { key: 'locationHistory',     label: 'Location History',          dbPath: 'locationHistory',      storagePath: null,                    icon: '📍' },
]

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState({ totalDbSize: 0, totalStorageSize: 0, totalDbRecords: 0, totalStorageFiles: 0, cities: [] })
  const [sectionStats, setSectionStats] = useState([])

  useEffect(() => {
    if (!isConfigured) { setLoading(false); setError('not_configured'); return }
    loadDashboard()
  }, [])

  async function loadDashboard() {
    setLoading(true)
    try {
      let cities = []
      try { cities = await getDbChildren('') } catch { cities = [] }
      const sections = await Promise.all(
        DATA_SECTIONS.map(async (section) => {
          let dbSize = { count: 0, sizeBytes: 0 }
          let storageSize = { totalSize: 0, fileCount: 0 }
          try { if (section.dbPath) dbSize = await getDbNodeSize(section.dbPath) } catch {}
          try { if (section.storagePath) storageSize = await getStorageFolderSize(section.storagePath) } catch {}
          return { ...section, dbRecords: dbSize.count, dbBytes: dbSize.sizeBytes, storageFiles: storageSize.fileCount, storageBytes: storageSize.totalSize }
        })
      )
      const totalDbSize = sections.reduce((sum, s) => sum + s.dbBytes, 0)
      const totalStorageSize = sections.reduce((sum, s) => sum + s.storageBytes, 0)
      const totalDbRecords = sections.reduce((sum, s) => sum + s.dbRecords, 0)
      const totalStorageFiles = sections.reduce((sum, s) => sum + s.storageFiles, 0)
      setStats({ totalDbSize, totalStorageSize, totalDbRecords, totalStorageFiles, cities })
      setSectionStats(sections)
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      setLoading(false)
    }
  }

  const cost = estimateCost(stats.totalStorageSize, stats.totalDbSize)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-text">Dashboard</h1>
          <p className="text-sm text-text-muted mt-0.5">Firebase data overview & cleanup insights</p>
        </div>
        {!loading && !error && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={loadDashboard}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-primary bg-white border border-surface-lighter hover:border-primary/30 transition-colors cursor-pointer"
          >
            <RefreshCw size={12} />
            Refresh
          </motion.button>
        )}
      </div>

      {error === 'not_configured' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center py-20">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-4">
              <Database size={28} className="text-amber-500" />
            </div>
            <h2 className="text-lg font-bold text-text mb-2">Firebase Not Configured</h2>
            <p className="text-sm text-text-muted mb-4">
              Create a <code className="bg-sky-50 text-primary px-1.5 py-0.5 rounded font-semibold">.env</code> file with your Firebase credentials.
            </p>
          </div>
        </motion.div>
      ) : loading ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 size={28} className="text-primary animate-spin mx-auto mb-3" />
            <p className="text-sm text-text-muted">Scanning Firebase data...</p>
          </div>
        </motion.div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard icon={Database} label="Realtime DB" value={formatBytes(stats.totalDbSize)} subtitle={`${stats.totalDbRecords} records`} color="primary" />
            <StatsCard icon={HardDrive} label="Storage" value={formatBytes(stats.totalStorageSize)} subtitle={`${stats.totalStorageFiles} files`} color="purple" />
            <StatsCard icon={DollarSign} label="Monthly Cost" value={`$${cost.totalCost}`} subtitle={`DB $${cost.dbCost} + Storage $${cost.storageCost}`} color="accent" />
            <StatsCard icon={MapPin} label="Cities" value={stats.cities.length} subtitle="Active locations" color="cyan" />
          </div>

          {/* Section Breakdown */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <h2 className="text-base font-bold text-text mb-3 flex items-center gap-2">
              <BarChart3 size={16} className="text-primary" />
              Section Breakdown
            </h2>
            <div className="bg-white border border-surface-lighter rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-light">
                    <th className="text-left text-[11px] font-semibold text-text-muted px-5 py-3 uppercase tracking-wider">Section</th>
                    <th className="text-right text-[11px] font-semibold text-text-muted px-5 py-3 uppercase tracking-wider">DB Records</th>
                    <th className="text-right text-[11px] font-semibold text-text-muted px-5 py-3 uppercase tracking-wider">DB Size</th>
                    <th className="text-right text-[11px] font-semibold text-text-muted px-5 py-3 uppercase tracking-wider">Files</th>
                    <th className="text-right text-[11px] font-semibold text-text-muted px-5 py-3 uppercase tracking-wider">Storage</th>
                    <th className="text-right text-[11px] font-semibold text-text-muted px-5 py-3 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-lighter/70">
                  {sectionStats.map(section => (
                    <tr key={section.key} className="hover:bg-sky-50/40 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm">{section.icon}</span>
                          <span className="text-sm font-medium text-text">{section.label}</span>
                        </div>
                      </td>
                      <td className="text-right text-sm text-text-muted px-5 py-3.5 font-mono text-[12px]">{section.dbRecords || '—'}</td>
                      <td className="text-right text-sm text-text-muted px-5 py-3.5 font-mono text-[12px]">{section.dbBytes ? formatBytes(section.dbBytes) : '—'}</td>
                      <td className="text-right text-sm text-text-muted px-5 py-3.5 font-mono text-[12px]">{section.storageFiles || '—'}</td>
                      <td className="text-right text-sm text-text-muted px-5 py-3.5 font-mono text-[12px]">{section.storageBytes ? formatBytes(section.storageBytes) : '—'}</td>
                      <td className="text-right text-sm font-semibold text-text px-5 py-3.5 font-mono text-[12px]">
                        {formatBytes(section.dbBytes + section.storageBytes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-sky-50/50 border-t-2 border-sky-100">
                    <td className="px-5 py-3 text-sm font-bold text-text">Total</td>
                    <td className="text-right text-sm font-bold text-text px-5 py-3 font-mono text-[12px]">{stats.totalDbRecords}</td>
                    <td className="text-right text-sm font-bold text-text px-5 py-3 font-mono text-[12px]">{formatBytes(stats.totalDbSize)}</td>
                    <td className="text-right text-sm font-bold text-text px-5 py-3 font-mono text-[12px]">{stats.totalStorageFiles}</td>
                    <td className="text-right text-sm font-bold text-text px-5 py-3 font-mono text-[12px]">{formatBytes(stats.totalStorageSize)}</td>
                    <td className="text-right text-sm font-extrabold text-primary px-5 py-3 font-mono text-[12px]">
                      {formatBytes(stats.totalDbSize + stats.totalStorageSize)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </motion.div>

          {/* Data Distribution */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-base font-bold text-text mb-3">Data Distribution</h2>
            <div className="bg-white border border-surface-lighter rounded-2xl p-5 space-y-3 shadow-sm">
              {sectionStats.map((section, i) => {
                const total = section.dbBytes + section.storageBytes
                const maxTotal = Math.max(...sectionStats.map(s => s.dbBytes + s.storageBytes), 1)
                const pct = (total / maxTotal) * 100

                return (
                  <motion.div
                    key={section.key}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i }}
                    className="flex items-center gap-3"
                  >
                    <span className="text-xs font-medium text-text-muted w-40 truncate">{section.label}</span>
                    <div className="flex-1 h-7 bg-surface-light rounded-lg overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(pct, 2)}%` }}
                        transition={{ duration: 0.8, delay: 0.1 * i, ease: 'easeOut' }}
                        className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 rounded-lg flex items-center justify-end pr-2"
                      >
                        {pct > 15 && (
                          <span className="text-[10px] text-white font-semibold">{formatBytes(total)}</span>
                        )}
                      </motion.div>
                    </div>
                    {pct <= 15 && (
                      <span className="text-[10px] text-text-muted font-medium">{formatBytes(total)}</span>
                    )}
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        </>
      )}
    </div>
  )
}
