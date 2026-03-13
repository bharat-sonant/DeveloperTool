import { useState } from 'react'
import { ChevronDown, ChevronRight, Eye, Loader2 } from 'lucide-react'
import { formatBytes } from '../lib/utils'

export default function DataSection({ title, icon: Icon, data, onPreview, type = 'db' }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-surface border border-surface-lighter rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-surface-light/50 transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon size={18} className="text-primary-light" />
        </div>
        <div className="flex-1 text-left">
          <h3 className="text-sm font-semibold text-text">{title}</h3>
          <p className="text-xs text-text-muted">
            {data.loading ? 'Scanning...' : `${data.count || 0} items · ${formatBytes(data.sizeBytes || 0)}`}
          </p>
        </div>
        {data.loading ? (
          <Loader2 size={16} className="text-text-muted animate-spin" />
        ) : (
          expanded ? <ChevronDown size={16} className="text-text-muted" /> : <ChevronRight size={16} className="text-text-muted" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && !data.loading && (
        <div className="border-t border-surface-lighter">
          {data.children && data.children.length > 0 ? (
            <div className="divide-y divide-surface-lighter">
              {data.children.map(child => (
                <div key={child.key} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-light/30 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text truncate">{child.key}</p>
                    <p className="text-xs text-text-muted">
                      {child.count !== undefined ? `${child.count} items · ` : ''}{formatBytes(child.sizeBytes || 0)}
                    </p>
                  </div>
                  {onPreview && (
                    <button
                      onClick={() => onPreview(child.path)}
                      className="p-1.5 rounded-lg text-text-muted hover:text-primary-light hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100"
                      title="Preview"
                    >
                      <Eye size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-center text-text-muted text-sm">
              No data found
            </div>
          )}
        </div>
      )}
    </div>
  )
}
