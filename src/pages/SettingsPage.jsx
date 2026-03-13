import { useState, useEffect } from 'react'
import { Settings, Save, CheckCircle, Database, Key } from 'lucide-react'

export default function SettingsPage() {
  const [config, setConfig] = useState({
    apiKey: '',
    authDomain: '',
    databaseURL: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    // Load from env vars (display only, can't be changed at runtime)
    setConfig({
      apiKey:            import.meta.env.VITE_FIREBASE_API_KEY || '',
      authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
      databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL || '',
      projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
      storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId:             import.meta.env.VITE_FIREBASE_APP_ID || '',
    })
  }, [])

  const fields = [
    { key: 'apiKey',            label: 'API Key' },
    { key: 'authDomain',        label: 'Auth Domain' },
    { key: 'databaseURL',       label: 'Database URL' },
    { key: 'projectId',         label: 'Project ID' },
    { key: 'storageBucket',     label: 'Storage Bucket' },
    { key: 'messagingSenderId', label: 'Messaging Sender ID' },
    { key: 'appId',             label: 'App ID' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Settings</h1>
        <p className="text-sm text-text-muted mt-1">Firebase configuration (read from .env)</p>
      </div>

      {/* Connection Status */}
      <div className="bg-surface border border-surface-lighter rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <Database size={18} className="text-primary-light" />
          <h2 className="text-sm font-semibold text-text">Firebase Connection</h2>
          <span className={`ml-auto text-xs px-2.5 py-1 rounded-full ${config.projectId ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
            {config.projectId ? 'Connected' : 'Not Configured'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs text-text-muted mb-1.5">{label}</label>
              <div className="flex items-center gap-2 px-3 py-2.5 bg-surface-light border border-surface-lighter rounded-xl">
                <Key size={13} className="text-text-muted shrink-0" />
                <span className="text-sm text-text font-mono truncate">
                  {config[key] ? (key === 'apiKey' ? `${config[key].slice(0, 8)}••••••` : config[key]) : '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-primary-light mb-2">How to configure</h3>
        <div className="text-xs text-text-muted space-y-1.5">
          <p>Create a <code className="bg-surface-light px-1.5 py-0.5 rounded text-text">.env</code> file in the project root with these variables:</p>
          <pre className="bg-surface rounded-xl p-3 mt-2 text-[11px] text-text-muted overflow-x-auto">
{`VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123:web:abc`}
          </pre>
        </div>
      </div>
    </div>
  )
}
