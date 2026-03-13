import { useState, useEffect, useCallback } from 'react'
import { Database, RefreshCw, Loader2 } from 'lucide-react'
import CitySelector from '../components/CitySelector'
import DataSection from '../components/DataSection'
import PreviewModal from '../components/PreviewModal'
import { getDbChildren, getDbNodeSize, getDbNodePreview } from '../lib/firebase'

const DB_SECTIONS = [
  { key: 'skipImages',      label: 'Skip Images',       path: 'skipImages',      icon: Database },
  { key: 'attendance',      label: 'Attendance Data',    path: 'attendance',      icon: Database },
  { key: 'locationHistory', label: 'Location History',   path: 'locationHistory', icon: Database },
  { key: 'users',           label: 'Users',              path: 'users',           icon: Database },
  { key: 'fieldTracking',   label: 'Field Tracking',     path: 'fieldTracking',   icon: Database },
]

export default function RealtimeDB() {
  const [cities, setCities] = useState([])
  const [selectedCity, setSelectedCity] = useState(null)
  const [sections, setSections] = useState({})
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState(null)

  const loadCities = useCallback(async () => {
    try {
      const rootChildren = await getDbChildren('')
      setCities(rootChildren.filter(c => !DB_SECTIONS.some(s => s.key === c)))
    } catch { setCities([]) }
  }, [])

  const loadSections = useCallback(async () => {
    setLoading(true)
    const result = {}

    for (const section of DB_SECTIONS) {
      const basePath = selectedCity ? `${selectedCity}/${section.path}` : section.path
      result[section.key] = { loading: true }
      setSections(prev => ({ ...prev, [section.key]: { loading: true } }))

      try {
        const size = await getDbNodeSize(basePath)
        const children = await getDbChildren(basePath)
        const childData = await Promise.all(
          children.slice(0, 50).map(async (childKey) => {
            const childPath = `${basePath}/${childKey}`
            const childSize = await getDbNodeSize(childPath)
            return { key: childKey, path: childPath, ...childSize }
          })
        )

        result[section.key] = { loading: false, ...size, children: childData }
      } catch {
        result[section.key] = { loading: false, count: 0, sizeBytes: 0, children: [] }
      }

      setSections(prev => ({ ...prev, [section.key]: result[section.key] }))
    }

    setLoading(false)
  }, [selectedCity])

  useEffect(() => { loadCities() }, [loadCities])
  useEffect(() => { loadSections() }, [loadSections])

  const handlePreview = async (path) => {
    const data = await getDbNodePreview(path)
    setPreview({ data, path })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">Realtime Database</h1>
          <p className="text-sm text-text-muted mt-1">Browse, preview & manage database nodes</p>
        </div>
        <div className="flex items-center gap-3">
          <CitySelector cities={cities} selectedCity={selectedCity} onSelect={setSelectedCity} loading={false} />
          <button
            onClick={loadSections}
            disabled={loading}
            className="p-2.5 rounded-xl bg-surface-light border border-surface-lighter text-text-muted hover:text-primary-light hover:border-primary/50 transition-all"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {DB_SECTIONS.map(section => (
          <DataSection
            key={section.key}
            title={section.label}
            icon={section.icon}
            data={sections[section.key] || { loading: true }}
            onPreview={handlePreview}
            type="db"
          />
        ))}
      </div>

      {/* Preview Modal */}
      {preview && (
        <PreviewModal data={preview.data} path={preview.path} onClose={() => setPreview(null)} />
      )}
    </div>
  )
}
