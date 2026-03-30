import { useState, useEffect } from 'react'
import { CheckCircle, Plus, X, Loader2, MapPin, Globe } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { loadCommonCities, saveCommonCities } from '../lib/firebase'

export default function SettingsPage() {
  // ── Master Cities state ──
  const [masterCities, setMasterCities] = useState([])
  const [newMasterCity, setNewMasterCity] = useState('')
  const [masterLoading, setMasterLoading] = useState(true)
  const [masterSaving, setMasterSaving] = useState(false)
  const [masterSaved, setMasterSaved] = useState(false)

  useEffect(() => {
    ;(async () => {
      setMasterLoading(true)
      try {
        const cities = await loadCommonCities()
        if (cities && cities.length > 0) setMasterCities(cities)
      } catch (err) {
        console.warn('Could not load master cities:', err.message)
      }
      setMasterLoading(false)
    })()
  }, [])

  // ── Master Cities handlers ──
  const saveMasterToFirebase = async (cities) => {
    setMasterSaving(true)
    try {
      const sorted = await saveCommonCities(cities)
      setMasterCities(sorted)
      setMasterSaved(true)
      setTimeout(() => setMasterSaved(false), 1500)
    } catch (err) {
      console.error('Failed to save master cities:', err)
    } finally {
      setMasterSaving(false)
    }
  }

  const addMasterCity = () => {
    const city = newMasterCity.trim()
    if (!city || masterCities.some(c => c.toLowerCase() === city.toLowerCase())) return
    const updated = [...masterCities, city].sort((a, b) => a.localeCompare(b))
    setMasterCities(updated)
    setNewMasterCity('')
    saveMasterToFirebase(updated)
  }

  const removeMasterCity = (city) => {
    const updated = masterCities.filter(c => c !== city)
    setMasterCities(updated)
    saveMasterToFirebase(updated)
  }

  return (
    <div className="grid grid-cols-2 gap-4">

      {/* ── Master Cities Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="bg-white border border-surface-lighter rounded-2xl overflow-hidden shadow-sm"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-violet-50/80 to-transparent border-b border-surface-lighter/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-400 flex items-center justify-center shadow-md shadow-violet-500/20">
              <Globe size={18} className="text-white" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-extrabold text-text">Master Cities</h2>
                {masterSaving && <Loader2 size={13} className="text-text-muted animate-spin" />}
                <AnimatePresence>
                  {masterSaved && (
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
              {!masterLoading && masterCities.length > 0 && (
                <p className="text-[11px] text-text-muted mt-0.5">{masterCities.length} cities in CommonCities.json</p>
              )}
            </div>

            {/* Add city */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <MapPin size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted/40" />
                <input
                  type="text"
                  value={newMasterCity}
                  onChange={(e) => setNewMasterCity(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addMasterCity()}
                  placeholder="Add city..."
                  disabled={masterSaving}
                  className="w-36 pl-7 pr-3 py-1.5 text-xs bg-white border border-surface-lighter rounded-lg text-text placeholder:text-text-muted/40 focus:outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-500/10 disabled:opacity-50 transition-all"
                />
              </div>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={addMasterCity}
                disabled={!newMasterCity.trim() || masterSaving}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-violet-500 to-purple-400 text-white shadow-sm shadow-violet-500/20 hover:shadow-md hover:shadow-violet-500/25 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <Plus size={13} strokeWidth={2.5} />
                Add
              </motion.button>
            </div>
          </div>
        </div>

        {/* City Cards */}
        <div className="p-5">
          {masterLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-2 py-12"
            >
              <Loader2 size={20} className="text-primary animate-spin" />
              <p className="text-xs text-text-muted">Loading master cities...</p>
            </motion.div>
          ) : masterCities.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12"
            >
              <div className="w-14 h-14 rounded-2xl bg-surface-light flex items-center justify-center mx-auto mb-3">
                <Globe size={24} className="text-text-muted/30" />
              </div>
              <p className="text-sm font-medium text-text-muted">No master cities yet</p>
              <p className="text-[11px] text-text-muted/60 mt-0.5">Add cities that will appear across all sections</p>
            </motion.div>
          ) : (
            <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <AnimatePresence mode="popLayout">
                {masterCities.map((city, i) => (
                  <motion.div
                    key={city}
                    layout
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.25, delay: i * 0.02 }}
                    whileHover={{ y: -2, transition: { duration: 0.15 } }}
                    className="group relative flex items-center gap-2 px-3 py-2.5 rounded-xl border bg-surface-light/50 border-surface-lighter/80 hover:bg-white hover:border-surface-lighter cursor-default transition-colors"
                  >
                    <motion.button
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.85 }}
                      onClick={() => removeMasterCity(city)}
                      disabled={masterSaving}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white border border-red-200 flex items-center justify-center shadow-sm cursor-pointer disabled:opacity-40 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={8} className="text-red-400" strokeWidth={3} />
                    </motion.button>
                    <span className="text-[11px] font-semibold leading-tight flex-1 truncate text-text">
                      {city}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </motion.div>

    </div>
  )
}
