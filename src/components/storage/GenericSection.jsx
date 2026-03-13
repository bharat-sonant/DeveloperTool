import { useState, useEffect, useCallback } from 'react'
import { Folder, Loader2 } from 'lucide-react'
import { listStorageFolder } from '../../lib/firebase'

export default function GenericSection({ selectedCity, storagePath }) {
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(false)

  const loadFolders = useCallback(async () => {
    if (!selectedCity || !storagePath) { setFolders([]); return }
    setLoading(true)
    try {
      const listing = await listStorageFolder(`${selectedCity}/${storagePath}`)
      setFolders([
        ...listing.folders.map(f => ({ name: f.name, fullPath: f.fullPath, isFolder: true })),
        ...listing.files.map(f => ({ name: f.name, fullPath: f.fullPath, isFolder: false })),
      ])
    } catch { setFolders([]) }
    setLoading(false)
  }, [selectedCity, storagePath])

  useEffect(() => { loadFolders() }, [loadFolders])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-primary" />
      </div>
    )
  }

  if (folders.length === 0) {
    return <div className="text-center py-12 text-text-muted text-sm">No data found</div>
  }

  return (
    <div className="grid grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
      {folders.map(item => (
        <div
          key={item.name}
          className="flex flex-col items-center gap-2 p-3 rounded-lg bg-surface border border-surface-lighter hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group"
        >
          <Folder
            size={28}
            strokeWidth={1.2}
            className={`transition-colors ${item.isFolder ? 'text-amber-400 group-hover:text-amber-500' : 'text-text-muted'}`}
            fill={item.isFolder ? 'currentColor' : 'none'}
          />
          <span className="text-[11px] font-medium text-text text-center leading-tight truncate w-full">
            {item.name}
          </span>
        </div>
      ))}
    </div>
  )
}
