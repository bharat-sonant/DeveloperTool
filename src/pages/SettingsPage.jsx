import { useState, useEffect } from 'react'
import { CheckCircle, Plus, X, MapPin, Loader2 } from 'lucide-react'
import { getCachedSectionCities, cacheSectionCities } from '../lib/sectionConfig'
import { loadDutyOnOffCities, saveDutyOnOffCities } from '../lib/firebase'

export default function SettingsPage() {
  // Section city management
  const [dutyOnOffCities, setDutyOnOffCities] = useState(() => getCachedSectionCities('dutyOnOff'))
  const [newCity, setNewCity] = useState('')
  const [citySaved, setCitySaved] = useState(false)
  const [cityLoading, setCityLoading] = useState(true)
  const [citySaving, setCitySaving] = useState(false)

  // Load cities from Firebase on mount
  useEffect(() => {
    ;(async () => {
      setCityLoading(true)
      try {
        const remote = await loadDutyOnOffCities()
        if (remote) {
          setDutyOnOffCities(remote)
          cacheSectionCities('dutyOnOff', remote)
        }
      } catch (err) {
        console.warn('Could not load cities from Firebase:', err.message)
      }
      setCityLoading(false)
    })()
  }, [])

  const addCity = async () => {
    const city = newCity.trim()
    if (!city || dutyOnOffCities.some(c => c.toLowerCase() === city.toLowerCase())) return
    const updated = [...dutyOnOffCities, city].sort((a, b) => a.localeCompare(b))
    setDutyOnOffCities(updated)
    setNewCity('')
    setCitySaving(true)
    try {
      const sorted = await saveDutyOnOffCities(updated)
      setDutyOnOffCities(sorted)
      cacheSectionCities('dutyOnOff', sorted)
      flashCitySaved()
    } catch (err) {
      console.error('Failed to save cities:', err)
    } finally {
      setCitySaving(false)
    }
  }

  const removeCity = async (city) => {
    const updated = dutyOnOffCities.filter(c => c !== city)
    setDutyOnOffCities(updated)
    setCitySaving(true)
    try {
      const sorted = await saveDutyOnOffCities(updated)
      setDutyOnOffCities(sorted)
      cacheSectionCities('dutyOnOff', sorted)
      flashCitySaved()
    } catch (err) {
      console.error('Failed to save cities:', err)
    } finally {
      setCitySaving(false)
    }
  }

  const flashCitySaved = () => {
    setCitySaved(true)
    setTimeout(() => setCitySaved(false), 1500)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Settings</h1>
        <p className="text-sm text-text-muted mt-1">Manage section configurations</p>
      </div>

      {/* Duty On/Off Cities */}
      <div className="bg-surface border border-surface-lighter rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <MapPin size={18} className="text-rose-500" />
          <h2 className="text-sm font-semibold text-text">Duty On/Off — Cities</h2>
          {citySaving && <Loader2 size={14} className="ml-2 text-text-muted animate-spin" />}
          {citySaved && (
            <span className="ml-2 text-xs text-emerald-500 flex items-center gap-1 animate-pulse">
              <CheckCircle size={13} /> Saved
            </span>
          )}
        </div>

        {/* Add city */}
        <div className="flex items-center gap-2 mb-4">
          <input
            type="text"
            value={newCity}
            onChange={(e) => setNewCity(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCity()}
            placeholder="New city name..."
            disabled={citySaving}
            className="flex-1 px-3 py-2 text-sm bg-surface-light border border-surface-lighter rounded-xl text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 disabled:opacity-50"
          />
          <button
            onClick={addCity}
            disabled={!newCity.trim() || citySaving}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-rose-500 text-white hover:bg-rose-600 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={15} />
            Add
          </button>
        </div>

        {/* City list */}
        <div className="flex flex-wrap gap-2">
          {cityLoading ? (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Loader2 size={14} className="animate-spin" /> Loading cities...
            </div>
          ) : dutyOnOffCities.length === 0 ? (
            <p className="text-xs text-text-muted">No cities added.</p>
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
                  disabled={citySaving}
                  className="ml-0.5 p-0.5 rounded hover:bg-rose-500/20 transition-colors cursor-pointer opacity-0 group-hover:opacity-100 disabled:opacity-0"
                >
                  <X size={12} className="text-rose-500" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  )
}
