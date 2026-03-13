import { useState, useEffect } from 'react'
import { Database, HardDrive, DollarSign, FolderOpen, MapPin, BarChart3, Loader2 } from 'lucide-react'
import StatsCard from '../components/StatsCard'
import { getDbNodeSize, getDbChildren, getStorageFolderSize, listStorageFolder, isConfigured } from '../lib/firebase'
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
    if (!isConfigured) {
      setLoading(false)
      setError('not_configured')
      return
    }
    loadDashboard()
  }, [])

  async function loadDashboard() {
    setLoading(true)
    try {
      // Get cities
      let cities = []
      try { cities = await getDbChildren('') } catch { cities = [] }

      // Load section stats
      const sections = await Promise.all(
        DATA_SECTIONS.map(async (section) => {
          let dbSize = { count: 0, sizeBytes: 0 }
          let storageSize = { totalSize: 0, fileCount: 0 }

          try {
            if (section.dbPath) dbSize = await getDbNodeSize(section.dbPath)
          } catch {}
          try {
            if (section.storagePath) storageSize = await getStorageFolderSize(section.storagePath)
          } catch {}

          return {
            ...section,
            dbRecords: dbSize.count,
            dbBytes: dbSize.sizeBytes,
            storageFiles: storageSize.fileCount,
            storageBytes: storageSize.totalSize,
          }
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
      <div>
        <h1 className="text-2xl font-bold text-text">Dashboard</h1>
        <p className="text-sm text-text-muted mt-1">Firebase data overview & analytics</p>
      </div>

      {error === 'not_configured' ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 flex items-center justify-center mx-auto mb-4">
              <Database size={28} className="text-amber-400" />
            </div>
            <h2 className="text-lg font-semibold text-text mb-2">Firebase Not Configured</h2>
            <p className="text-sm text-text-muted mb-4">
              Create a <code className="bg-surface-light px-1.5 py-0.5 rounded text-primary-light">.env</code> file in the project root with your Firebase credentials.
            </p>
            <div className="bg-surface border border-surface-lighter rounded-xl p-4 text-left">
              <pre className="text-[11px] text-text-muted font-mono whitespace-pre-wrap">{`VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123:web:abc`}</pre>
            </div>
            <p className="text-xs text-text-muted mt-3">Then restart the dev server.</p>
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 size={32} className="text-primary animate-spin mx-auto mb-3" />
            <p className="text-sm text-text-muted">Scanning Firebase data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard icon={Database} label="Realtime DB Size" value={formatBytes(stats.totalDbSize)} subtitle={`${stats.totalDbRecords} records`} color="primary" />
            <StatsCard icon={HardDrive} label="Storage Size" value={formatBytes(stats.totalStorageSize)} subtitle={`${stats.totalStorageFiles} files`} color="purple" />
            <StatsCard icon={DollarSign} label="Est. Monthly Cost" value={`$${cost.totalCost}`} subtitle={`DB: $${cost.dbCost} | Storage: $${cost.storageCost}`} color="accent" />
            <StatsCard icon={MapPin} label="Cities" value={stats.cities.length} subtitle="Active locations" color="cyan" />
          </div>

          {/* Section Breakdown */}
          <div>
            <h2 className="text-lg font-semibold text-text mb-4 flex items-center gap-2">
              <BarChart3 size={18} className="text-primary-light" />
              Section Breakdown
            </h2>
            <div className="bg-surface border border-surface-lighter rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-lighter">
                    <th className="text-left text-xs font-medium text-text-muted px-5 py-3">Section</th>
                    <th className="text-right text-xs font-medium text-text-muted px-5 py-3">DB Records</th>
                    <th className="text-right text-xs font-medium text-text-muted px-5 py-3">DB Size</th>
                    <th className="text-right text-xs font-medium text-text-muted px-5 py-3">Storage Files</th>
                    <th className="text-right text-xs font-medium text-text-muted px-5 py-3">Storage Size</th>
                    <th className="text-right text-xs font-medium text-text-muted px-5 py-3">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-lighter">
                  {sectionStats.map(section => (
                    <tr key={section.key} className="hover:bg-surface-light/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{section.icon}</span>
                          <span className="text-sm text-text">{section.label}</span>
                        </div>
                      </td>
                      <td className="text-right text-sm text-text-muted px-5 py-3">{section.dbRecords || '—'}</td>
                      <td className="text-right text-sm text-text-muted px-5 py-3">{section.dbBytes ? formatBytes(section.dbBytes) : '—'}</td>
                      <td className="text-right text-sm text-text-muted px-5 py-3">{section.storageFiles || '—'}</td>
                      <td className="text-right text-sm text-text-muted px-5 py-3">{section.storageBytes ? formatBytes(section.storageBytes) : '—'}</td>
                      <td className="text-right text-sm font-medium text-text px-5 py-3">
                        {formatBytes(section.dbBytes + section.storageBytes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-surface-lighter bg-surface-light/20">
                    <td className="px-5 py-3 text-sm font-semibold text-text">Total</td>
                    <td className="text-right text-sm font-semibold text-text px-5 py-3">{stats.totalDbRecords}</td>
                    <td className="text-right text-sm font-semibold text-text px-5 py-3">{formatBytes(stats.totalDbSize)}</td>
                    <td className="text-right text-sm font-semibold text-text px-5 py-3">{stats.totalStorageFiles}</td>
                    <td className="text-right text-sm font-semibold text-text px-5 py-3">{formatBytes(stats.totalStorageSize)}</td>
                    <td className="text-right text-sm font-bold text-primary-light px-5 py-3">
                      {formatBytes(stats.totalDbSize + stats.totalStorageSize)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Visual Bar Chart */}
          <div>
            <h2 className="text-lg font-semibold text-text mb-4">Data Distribution</h2>
            <div className="bg-surface border border-surface-lighter rounded-2xl p-5 space-y-3">
              {sectionStats.map(section => {
                const total = section.dbBytes + section.storageBytes
                const maxTotal = Math.max(...sectionStats.map(s => s.dbBytes + s.storageBytes), 1)
                const pct = (total / maxTotal) * 100

                return (
                  <div key={section.key} className="flex items-center gap-3">
                    <span className="text-xs text-text-muted w-40 truncate">{section.label}</span>
                    <div className="flex-1 h-6 bg-surface-light rounded-lg overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-lg transition-all duration-700 flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      >
                        {pct > 15 && (
                          <span className="text-[10px] text-white font-medium">{formatBytes(total)}</span>
                        )}
                      </div>
                    </div>
                    {pct <= 15 && (
                      <span className="text-[10px] text-text-muted">{formatBytes(total)}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
