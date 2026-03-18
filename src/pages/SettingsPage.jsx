import { useState, useEffect } from 'react'
import { Settings, Save, CheckCircle, Database, Key, Plus, X, RotateCcw, MapPin } from 'lucide-react'
import { getSectionCities, setSectionCities, getDefaultCities } from '../lib/sectionConfig'

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

  // Section city management
  const [dutyOnOffCities, setDutyOnOffCities] = useState(() => getSectionCities('dutyOnOff'))
  const [newCity, setNewCity] = useState('')
  const [citySaved, setCitySaved] = useState(false)

  const addCity = () => {
    const city = newCity.trim()
    if (!city || dutyOnOffCities.some(c => c.toLowerCase() === city.toLowerCase())) return
    const updated = [...dutyOnOffCities, city].sort((a, b) => a.localeCompare(b))
    setDutyOnOffCities(updated)
    setSectionCities('dutyOnOff', updated)
    setNewCity('')
    flashCitySaved()
  }

  const removeCity = (city) => {
    const updated = dutyOnOffCities.filter(c => c !== city)
    setDutyOnOffCities(updated)
    setSectionCities('dutyOnOff', updated)
    flashCitySaved()
  }

  const resetCities = () => {
    const defaults = getDefaultCities('dutyOnOff')
    setDutyOnOffCities(defaults)
    setSectionCities('dutyOnOff', defaults)
    flashCitySaved()
  }

  const flashCitySaved = () => {
    setCitySaved(true)
    setTimeout(() => setCitySaved(false), 1500)
  }

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

      {/* Duty On/Off Cities */}
      <div className="bg-surface border border-surface-lighter rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <MapPin size={18} className="text-rose-500" />
          <h2 className="text-sm font-semibold text-text">Duty On/Off — Cities</h2>
          {citySaved && (
            <span className="ml-2 text-xs text-emerald-500 flex items-center gap-1 animate-pulse">
              <CheckCircle size={13} /> Saved
            </span>
          )}
          <button
            onClick={resetCities}
            className="ml-auto flex items-center gap-1.5 text-xs text-text-muted hover:text-primary transition-colors cursor-pointer"
          >
            <RotateCcw size={13} />
            Reset Default
          </button>
        </div>

        {/* Add city */}
        <div className="flex items-center gap-2 mb-4">
          <input
            type="text"
            value={newCity}
            onChange={(e) => setNewCity(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCity()}
            placeholder="New city name..."
            className="flex-1 px-3 py-2 text-sm bg-surface-light border border-surface-lighter rounded-xl text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
          />
          <button
            onClick={addCity}
            disabled={!newCity.trim()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-rose-500 text-white hover:bg-rose-600 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={15} />
            Add
          </button>
        </div>

        {/* City list */}
        <div className="flex flex-wrap gap-2">
          {dutyOnOffCities.length === 0 ? (
            <p className="text-xs text-text-muted">No cities added. Click "Reset Default" to restore.</p>
          ) : (
            dutyOnOffCities.map(city => (
              <div
                key={city}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/8 border border-rose-500/20 text-sm text-rose-700 font-medium group"
              >
                <MapPin size={12} className="text-rose-400" />
                {city}
                <button
                  onClick={() => removeCity(city)}
                  className="ml-0.5 p-0.5 rounded hover:bg-rose-500/20 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                >
                  <X size={12} className="text-rose-500" />
                </button>
              </div>
            ))
          )}
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
