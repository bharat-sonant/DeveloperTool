import { useState, useEffect } from 'react'
import { CheckCircle, Plus, X, Loader2, Check, MapPin, ArrowLeftRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="bg-white border border-surface-lighter rounded-2xl overflow-hidden shadow-sm max-w-3xl"
      >

        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-sky-50/80 to-transparent border-b border-surface-lighter/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-400 flex items-center justify-center shadow-md shadow-sky-500/20">
              <ArrowLeftRight size={18} className="text-white" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-extrabold text-text">Duty On/Off — Cities</h2>
                {citySaving && <Loader2 size={13} className="text-text-muted animate-spin" />}
                <AnimatePresence>
                  {citySaved && (
                    <motion.span
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      className="text-[11px] text-emerald-500 flex items-center gap-1 font-semibold"
                    >
                      <CheckCircle size={12} /> Saved
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              {!cityLoading && dutyOnOffCities.length > 0 && (
                <div className="flex items-center gap-3 mt-1.5">
                  <div className="flex-1 h-1.5 bg-surface-lighter rounded-full overflow-hidden max-w-[200px]">
                    <motion.div
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="flex items-center gap-2.5 text-[11px]">
                    <span className="text-emerald-600 font-bold">{doneCities.length} done</span>
                    <span className="w-px h-3 bg-surface-lighter" />
                    <span className="text-amber-500 font-semibold">{pendingCities.length} pending</span>
                    <span className="w-px h-3 bg-surface-lighter" />
                    <span className="text-text-muted">{dutyOnOffCities.length} total</span>
                  </div>
                </div>
              )}
            </div>

            {/* Add city */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <MapPin size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted/40" />
                <input
                  type="text"
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCity()}
                  placeholder="Add city..."
                  disabled={citySaving}
                  className="w-36 pl-7 pr-3 py-1.5 text-xs bg-white border border-surface-lighter rounded-lg text-text placeholder:text-text-muted/40 focus:outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-500/10 disabled:opacity-50 transition-all"
                />
              </div>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={addCity}
                disabled={!newCity.trim() || citySaving}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-sky-500 to-cyan-400 text-white shadow-sm shadow-sky-500/20 hover:shadow-md hover:shadow-sky-500/25 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <Plus size={13} strokeWidth={2.5} />
                Add
              </motion.button>
            </div>
          </div>
        </div>

        {/* City Cards */}
        <div className="p-5">
          {cityLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-2 py-12"
            >
              <Loader2 size={20} className="text-primary animate-spin" />
              <p className="text-xs text-text-muted">Loading cities...</p>
            </motion.div>
          ) : dutyOnOffCities.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12"
            >
              <div className="w-14 h-14 rounded-2xl bg-surface-light flex items-center justify-center mx-auto mb-3">
                <MapPin size={24} className="text-text-muted/30" />
              </div>
              <p className="text-sm font-medium text-text-muted">No cities added yet</p>
              <p className="text-[11px] text-text-muted/60 mt-0.5">Use the input above to add a city</p>
            </motion.div>
          ) : (
            <motion.div layout className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
              <AnimatePresence mode="popLayout">
                {dutyOnOffCities.map((city, i) => {
                  const isCleaned = cleanedCities.includes(city)
                  return (
                    <motion.div
                      key={city}
                      layout
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
                      transition={{ duration: 0.25, delay: i * 0.02 }}
                      whileHover={{ y: -2, transition: { duration: 0.15 } }}
                      className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-default transition-colors ${
                        isCleaned
                          ? 'bg-emerald-50/80 border-emerald-200/70'
                          : 'bg-surface-light/50 border-surface-lighter/80 hover:bg-white hover:border-surface-lighter'
                      }`}
                    >
                      {/* Remove button */}
                      <motion.button
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.85 }}
                        onClick={() => removeCity(city)}
                        disabled={citySaving}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white border border-red-200 flex items-center justify-center shadow-sm cursor-pointer disabled:opacity-40 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={8} className="text-red-400" strokeWidth={3} />
                      </motion.button>

                      {/* City name */}
                      <span className={`text-[11px] font-semibold leading-tight flex-1 truncate ${
                        isCleaned ? 'text-emerald-700' : 'text-text'
                      }`}>
                        {city}
                      </span>

                      {/* Toggle */}
                      <button
                        onClick={() => toggleCleaned(city)}
                        disabled={citySaving}
                        className="relative w-7 h-[16px] rounded-full cursor-pointer disabled:opacity-40 focus:outline-none shrink-0"
                        style={{
                          backgroundColor: isCleaned ? '#10b981' : '#cbd5e1',
                          transition: 'background-color 0.3s',
                          boxShadow: isCleaned ? '0 0 0 2px rgba(16,185,129,0.15)' : 'none',
                        }}
                      >
                        <motion.span
                          layout
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          className="absolute top-[2px] w-3 h-3 rounded-full bg-white shadow-sm flex items-center justify-center"
                          style={{ left: isCleaned ? 12 : 2 }}
                        >
                          <AnimatePresence>
                            {isCleaned && (
                              <motion.span
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0 }}
                              >
                                <Check size={6} className="text-emerald-500" strokeWidth={3} />
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </motion.span>
                      </button>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </div>

      </motion.div>
    </div>
  )
}
