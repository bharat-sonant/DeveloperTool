import { X } from 'lucide-react'

export default function PreviewModal({ data, path, onClose }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-surface-lighter rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-lighter">
          <div>
            <h3 className="text-sm font-semibold text-text">Data Preview</h3>
            <p className="text-xs text-text-muted mt-0.5 font-mono">{path}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-light transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          <pre className="text-xs text-text font-mono whitespace-pre-wrap bg-surface-light/50 rounded-xl p-4 border border-surface-lighter">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}
