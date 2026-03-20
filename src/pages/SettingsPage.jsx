import { useState, useEffect } from 'react'
import { CheckCircle, Plus, X, Loader2, Check, MapPin } from 'lucide-react'
import { getCachedSectionConfig, cacheSectionConfig } from '../lib/sectionConfig'
import { loadDutyOnOffCityConfig, saveDutyOnOffCityConfig } from '../lib/firebase'

export default function SettingsPage() {
  const cached = getCachedSectionConfig('dutyOnOff')
  const [dutyOnOffCities, setDutyOnOffCities] = useState(cached.cities)
  const [cleanedCities, setCleanedCities] = useState(cached.cleanedCities)
  const [newCity, setNewCity] = useState('')
  const [citySaved, setCitySaved] = useState(false)
  const [cityLoading, setCityLoading] = useState(true)
  const [citySaving, setCitySaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      setCityLoading(true)
      try {
        const remote = await loadDutyOnOffCityConfig()
        if (remote) {
          setDutyOnOffCities(remote.cities)
          setCleanedCities(remote.cleanedCities)
          cacheSectionConfig('dutyOnOff', remote.cities, remote.cleanedCities)
        }
      } catch (err) {
        console.warn('Could not load cities from Firebase:', err.message)
      }
      setCityLoading(false)
    })()
  }, [])

  const saveToFirebase = async (cities, cleaned) => {
    setCitySaving(true)
    try {
      const result = await saveDutyOnOffCityConfig(cities, cleaned)
      setDutyOnOffCities(result.cities)
      setCleanedCities(result.cleanedCities)
      cacheSectionConfig('dutyOnOff', result.cities, result.cleanedCities)
      flashCitySaved()
    } catch (err) {
      console.error('Failed to save cities:', err)
    } finally {
      setCitySaving(false)
    }
  }

  const addCity = () => {
    const city = newCity.trim()
    if (!city || dutyOnOffCities.some(c => c.toLowerCase() === city.toLowerCase())) return
    const updated = [...dutyOnOffCities, city].sort((a, b) => a.localeCompare(b))
    setDutyOnOffCities(updated)
    setNewCity('')
    saveToFirebase(updated, cleanedCities)
  }

  const removeCity = (city) => {
    const updatedCities = dutyOnOffCities.filter(c => c !== city)
    const updatedCleaned = cleanedCities.filter(c => c !== city)
    setDutyOnOffCities(updatedCities)
    setCleanedCities(updatedCleaned)
    saveToFirebase(updatedCities, updatedCleaned)
  }

  const toggleCleaned = (city) => {
    const isCleaned = cleanedCities.includes(city)
    const updatedCleaned = isCleaned
      ? cleanedCities.filter(c => c !== city)
      : [...cleanedCities, city]
    setCleanedCities(updatedCleaned)
    saveToFirebase(dutyOnOffCities, updatedCleaned)
  }

  const flashCitySaved = () => {
    setCitySaved(true)
    setTimeout(() => setCitySaved(false), 1500)
  }

  const pendingCities = dutyOnOffCities.filter(c => !cleanedCities.includes(c))
  const doneCities = dutyOnOffCities.filter(c => cleanedCities.includes(c))
  const progress = dutyOnOffCities.length > 0 ? Math.round((doneCities.length / dutyOnOffCities.length) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-surface-lighter rounded-2xl overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b border-surface-lighter">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center">
              <MapPin size={18} className="text-rose-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-text">Duty On/Off — Cities</h2>
                {citySaving && <Loader2 size={13} className="text-text-muted animate-spin" />}
                {citySaved && (
                  <span className="text-[11px] text-emerald-500 flex items-center gap-1 animate-pulse">
                    <CheckCircle size={12} /> Saved
                  </span>
                )}
              </div>
              {!cityLoading && dutyOnOffCities.length > 0 && (
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex-1 h-1.5 bg-surface-lighter rounded-full overflow-hidden max-w-[180px]">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="text-[11px] text-text-muted">
                    <strong className="text-emerald-500">{doneCities.length}</strong> / {dutyOnOffCities.length} done
                  </span>
                </div>
              )}
            </div>

            {/* Add city */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCity()}
                placeholder="Add city..."
                disabled={citySaving}
                className="w-36 px-3 py-1.5 text-xs bg-surface-light border border-surface-lighter rounded-lg text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 disabled:opacity-50"
              />
              <button
                onClick={addCity}
                disabled={!newCity.trim() || citySaving}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-rose-500 text-white hover:bg-rose-600 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={13} />
                Add
              </button>
            </div>
          </div>
        </div>

        {/* City Cards */}
        <div className="p-5">
          {cityLoading ? (
            <div className="flex items-center gap-2 text-xs text-text-muted py-8 justify-center">
              <Loader2 size={14} className="animate-spin" /> Loading cities...
            </div>
          ) : dutyOnOffCities.length === 0 ? (
            <div className="text-center py-8">
              <MapPin size={24} className="text-text-muted/30 mx-auto mb-2" />
              <p className="text-xs text-text-muted">No cities added yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {dutyOnOffCities.map(city => {
                const isCleaned = cleanedCities.includes(city)
                return (
                  <div
                    key={city}
                    className={`group relative flex items-center gap-2.5 px-3.5 py-3 rounded-xl border transition-all hover:shadow-sm ${
                      isCleaned
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-white border-surface-lighter hover:border-surface-lighter/80'
                    }`}
                  >
                    {/* Remove button */}
                    <button
                      onClick={() => removeCity(city)}
                      disabled={citySaving}
                      className="absolute top-1.5 right-1.5 p-0.5 rounded-md hover:bg-red-500/15 transition-all cursor-pointer disabled:opacity-40 opacity-0 group-hover:opacity-100"
                    >
                      <X size={11} className="text-red-400" />
                    </button>

                    {/* City name + toggle */}
                    <span className={`text-[10px] font-semibold leading-tight flex-1 ${
                      isCleaned ? 'text-emerald-700' : 'text-text'
                    }`}>
                      {city}
                    </span>

                    <button
                      onClick={() => toggleCleaned(city)}
                      disabled={citySaving}
                      className="relative w-7 h-[16px] rounded-full transition-all duration-300 cursor-pointer disabled:opacity-40 focus:outline-none shrink-0"
                      style={{ backgroundColor: isCleaned ? '#10b981' : '#d1d5db' }}
                    >
                      <span
                        className={`absolute top-[2px] w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-300 flex items-center justify-center ${
                          isCleaned ? 'left-[12px]' : 'left-[2px]'
                        }`}
                      >
                        {isCleaned && <Check size={6} className="text-emerald-500" strokeWidth={3} />}
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
