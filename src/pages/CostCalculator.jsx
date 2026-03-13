import { useState, useEffect } from 'react'
import { DollarSign, Database, HardDrive, TrendingUp, Calculator, Loader2 } from 'lucide-react'
import StatsCard from '../components/StatsCard'
import { getDbNodeSize, getStorageFolderSize } from '../lib/firebase'
import { formatBytes, estimateCost } from '../lib/utils'

const SECTIONS = [
  { key: 'skipImages',           label: 'Skip Images',           dbPath: 'skipImages',      storagePath: 'skipImages' },
  { key: 'attendance',           label: 'Attendance Data',        dbPath: 'attendance',      storagePath: null },
  { key: 'attendanceImages',     label: 'Attendance Images',      dbPath: null,               storagePath: 'attendanceImages' },
  { key: 'fieldTrackingImages',  label: 'Field Tracking Images',  dbPath: null,               storagePath: 'fieldTrackingImages' },
  { key: 'locationHistory',      label: 'Location History',       dbPath: 'locationHistory', storagePath: null },
]

export default function CostCalculator() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState([])

  useEffect(() => {
    loadCosts()
  }, [])

  async function loadCosts() {
    setLoading(true)
    try {
      const results = await Promise.all(
        SECTIONS.map(async (section) => {
          let dbSize = { sizeBytes: 0, count: 0 }
          let storageSize = { totalSize: 0, fileCount: 0 }

          try { if (section.dbPath) dbSize = await getDbNodeSize(section.dbPath) } catch {}
          try { if (section.storagePath) storageSize = await getStorageFolderSize(section.storagePath) } catch {}

          const cost = estimateCost(storageSize.totalSize, dbSize.sizeBytes)

          return {
            ...section,
            dbBytes: dbSize.sizeBytes,
            dbRecords: dbSize.count,
            storageBytes: storageSize.totalSize,
            storageFiles: storageSize.fileCount,
            cost,
          }
        })
      )
      setData(results)
    } catch (err) {
      console.error('Cost calc error:', err)
    } finally {
      setLoading(false)
    }
  }

  const totalDbBytes = data.reduce((s, d) => s + d.dbBytes, 0)
  const totalStorageBytes = data.reduce((s, d) => s + d.storageBytes, 0)
  const totalCost = estimateCost(totalStorageBytes, totalDbBytes)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Cost Calculator</h1>
        <p className="text-sm text-text-muted mt-1">Estimate Firebase billing by section</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 size={32} className="text-primary animate-spin mx-auto mb-3" />
            <p className="text-sm text-text-muted">Calculating costs...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard icon={Database} label="Realtime DB" value={formatBytes(totalDbBytes)} subtitle={`~$${totalCost.dbCost}/mo`} color="primary" />
            <StatsCard icon={HardDrive} label="Storage" value={formatBytes(totalStorageBytes)} subtitle={`~$${totalCost.storageCost}/mo`} color="purple" />
            <StatsCard icon={DollarSign} label="Total Monthly" value={`$${totalCost.totalCost}`} color="accent" />
            <StatsCard icon={TrendingUp} label="Yearly Estimate" value={`$${(parseFloat(totalCost.totalCost) * 12).toFixed(2)}`} color="danger" />
          </div>

          {/* Per-Section Cost Table */}
          <div className="bg-surface border border-surface-lighter rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-lighter flex items-center gap-2">
              <Calculator size={16} className="text-primary-light" />
              <h2 className="text-sm font-semibold text-text">Per-Section Cost Breakdown</h2>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-lighter bg-surface-light/30">
                  <th className="text-left text-xs font-medium text-text-muted px-5 py-3">Section</th>
                  <th className="text-right text-xs font-medium text-text-muted px-5 py-3">DB Size</th>
                  <th className="text-right text-xs font-medium text-text-muted px-5 py-3">DB Cost/mo</th>
                  <th className="text-right text-xs font-medium text-text-muted px-5 py-3">Storage Size</th>
                  <th className="text-right text-xs font-medium text-text-muted px-5 py-3">Storage Cost/mo</th>
                  <th className="text-right text-xs font-medium text-text-muted px-5 py-3">Total/mo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-lighter">
                {data.map(row => (
                  <tr key={row.key} className="hover:bg-surface-light/30 transition-colors">
                    <td className="px-5 py-3 text-sm text-text">{row.label}</td>
                    <td className="text-right text-sm text-text-muted px-5 py-3">{row.dbBytes ? formatBytes(row.dbBytes) : '—'}</td>
                    <td className="text-right text-sm text-text-muted px-5 py-3">{row.dbBytes ? `$${row.cost.dbCost}` : '—'}</td>
                    <td className="text-right text-sm text-text-muted px-5 py-3">{row.storageBytes ? formatBytes(row.storageBytes) : '—'}</td>
                    <td className="text-right text-sm text-text-muted px-5 py-3">{row.storageBytes ? `$${row.cost.storageCost}` : '—'}</td>
                    <td className="text-right text-sm font-medium text-accent px-5 py-3">${row.cost.totalCost}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-surface-lighter bg-surface-light/20">
                  <td className="px-5 py-3 text-sm font-bold text-text">Total</td>
                  <td className="text-right text-sm font-semibold text-text px-5 py-3">{formatBytes(totalDbBytes)}</td>
                  <td className="text-right text-sm font-semibold text-text px-5 py-3">${totalCost.dbCost}</td>
                  <td className="text-right text-sm font-semibold text-text px-5 py-3">{formatBytes(totalStorageBytes)}</td>
                  <td className="text-right text-sm font-semibold text-text px-5 py-3">${totalCost.storageCost}</td>
                  <td className="text-right text-sm font-bold text-accent px-5 py-3">${totalCost.totalCost}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pricing Info */}
          <div className="bg-surface-light/30 border border-surface-lighter rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-text mb-2">Firebase Pricing Reference</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-text-muted">
              <div className="space-y-1">
                <p><span className="text-primary-light font-medium">Realtime Database:</span> $5/GB stored/month</p>
                <p><span className="text-primary-light font-medium">Downloads:</span> $1/GB downloaded</p>
              </div>
              <div className="space-y-1">
                <p><span className="text-purple-400 font-medium">Cloud Storage:</span> $0.026/GB stored/month</p>
                <p><span className="text-purple-400 font-medium">Downloads:</span> $0.12/GB downloaded</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
