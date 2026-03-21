import { useState, useEffect } from 'react'
import { CheckCircle, Plus, X, Loader2, Check, MapPin, ArrowLeftRight, ClipboardList, SkipForward, BookOpen } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { getCachedSectionConfig, cacheSectionConfig } from '../lib/sectionConfig'
import { loadDutyOnOffCityConfig, saveDutyOnOffCityConfig, loadAttendanceCityConfig, saveAttendanceCityConfig, loadSkipLineCityConfig, saveSkipLineCityConfig, loadLogBookCityConfig, saveLogBookCityConfig } from '../lib/firebase'

export default function SettingsPage() {
  // ── Duty On/Off state ──
  const cached = getCachedSectionConfig('dutyOnOff')
  const [dutyOnOffCities, setDutyOnOffCities] = useState(cached.cities)
  const [cleanedCities, setCleanedCities] = useState(cached.cleanedCities)
  const [newCity, setNewCity] = useState('')
  const [citySaved, setCitySaved] = useState(false)
  const [cityLoading, setCityLoading] = useState(true)
  const [citySaving, setCitySaving] = useState(false)

  // ── Attendance state ──
  const attCached = getCachedSectionConfig('attendance')
  const [attCities, setAttCities] = useState(attCached.cities)
  const [attCleanedCities, setAttCleanedCities] = useState(attCached.cleanedCities)
  const [attNewCity, setAttNewCity] = useState('')
  const [attSaved, setAttSaved] = useState(false)
  const [attLoading, setAttLoading] = useState(true)
  const [attSaving, setAttSaving] = useState(false)

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
    ;(async () => {
      setAttLoading(true)
      try {
        const remote = await loadAttendanceCityConfig()
        if (remote) {
          setAttCities(remote.cities)
          setAttCleanedCities(remote.cleanedCities)
          cacheSectionConfig('attendance', remote.cities, remote.cleanedCities)
        }
      } catch (err) {
        console.warn('Could not load attendance cities from Firebase:', err.message)
      }
      setAttLoading(false)
    })()
  }, [])

  // ── Duty On/Off handlers ──
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

  const doneCities = dutyOnOffCities.filter(c => cleanedCities.includes(c))
  const progress = dutyOnOffCities.length > 0 ? Math.round((doneCities.length / dutyOnOffCities.length) * 100) : 0

  // ── Attendance handlers ──
  const saveAttToFirebase = async (cities, cleaned) => {
    setAttSaving(true)
    try {
      const result = await saveAttendanceCityConfig(cities, cleaned)
      setAttCities(result.cities)
      setAttCleanedCities(result.cleanedCities)
      cacheSectionConfig('attendance', result.cities, result.cleanedCities)
      flashAttSaved()
    } catch (err) {
      console.error('Failed to save attendance cities:', err)
    } finally {
      setAttSaving(false)
    }
  }

  const addAttCity = () => {
    const city = attNewCity.trim()
    if (!city || attCities.some(c => c.toLowerCase() === city.toLowerCase())) return
    const updated = [...attCities, city].sort((a, b) => a.localeCompare(b))
    setAttCities(updated)
    setAttNewCity('')
    saveAttToFirebase(updated, attCleanedCities)
  }

  const removeAttCity = (city) => {
    const updatedCities = attCities.filter(c => c !== city)
    const updatedCleaned = attCleanedCities.filter(c => c !== city)
    setAttCities(updatedCities)
    setAttCleanedCities(updatedCleaned)
    saveAttToFirebase(updatedCities, updatedCleaned)
  }

  const toggleAttCleaned = (city) => {
    const isCleaned = attCleanedCities.includes(city)
    const updatedCleaned = isCleaned
      ? attCleanedCities.filter(c => c !== city)
      : [...attCleanedCities, city]
    setAttCleanedCities(updatedCleaned)
    saveAttToFirebase(attCities, updatedCleaned)
  }

  const flashAttSaved = () => {
    setAttSaved(true)
    setTimeout(() => setAttSaved(false), 1500)
  }

  const attDoneCities = attCities.filter(c => attCleanedCities.includes(c))
  const attProgress = attCities.length > 0 ? Math.round((attDoneCities.length / attCities.length) * 100) : 0

  // ── Skip Line state ──
  const slCached = getCachedSectionConfig('skipLine')
  const [slCities, setSlCities] = useState(slCached.cities)
  const [slCleanedCities, setSlCleanedCities] = useState(slCached.cleanedCities)
  const [slNewCity, setSlNewCity] = useState('')
  const [slSaved, setSlSaved] = useState(false)
  const [slLoading, setSlLoading] = useState(true)
  const [slSaving, setSlSaving] = useState(false)

  // Load skip line cities on mount (inside existing useEffect won't work since it's already run)
  useEffect(() => {
    ;(async () => {
      setSlLoading(true)
      try {
        const remote = await loadSkipLineCityConfig()
        if (remote) {
          setSlCities(remote.cities)
          setSlCleanedCities(remote.cleanedCities)
          cacheSectionConfig('skipLine', remote.cities, remote.cleanedCities)
        }
      } catch (err) {
        console.warn('Could not load skip line cities:', err.message)
      }
      setSlLoading(false)
    })()
  }, [])

  const saveSlToFirebase = async (cities, cleaned) => {
    setSlSaving(true)
    try {
      const result = await saveSkipLineCityConfig(cities, cleaned)
      setSlCities(result.cities)
      setSlCleanedCities(result.cleanedCities)
      cacheSectionConfig('skipLine', result.cities, result.cleanedCities)
      flashSlSaved()
    } catch (err) {
      console.error('Failed to save skip line cities:', err)
    } finally {
      setSlSaving(false)
    }
  }

  const addSlCity = () => {
    const city = slNewCity.trim()
    if (!city || slCities.some(c => c.toLowerCase() === city.toLowerCase())) return
    const updated = [...slCities, city].sort((a, b) => a.localeCompare(b))
    setSlCities(updated)
    setSlNewCity('')
    saveSlToFirebase(updated, slCleanedCities)
  }

  const removeSlCity = (city) => {
    const updatedCities = slCities.filter(c => c !== city)
    const updatedCleaned = slCleanedCities.filter(c => c !== city)
    setSlCities(updatedCities)
    setSlCleanedCities(updatedCleaned)
    saveSlToFirebase(updatedCities, updatedCleaned)
  }

  const toggleSlCleaned = (city) => {
    const isCleaned = slCleanedCities.includes(city)
    const updatedCleaned = isCleaned
      ? slCleanedCities.filter(c => c !== city)
      : [...slCleanedCities, city]
    setSlCleanedCities(updatedCleaned)
    saveSlToFirebase(slCities, updatedCleaned)
  }

  const flashSlSaved = () => {
    setSlSaved(true)
    setTimeout(() => setSlSaved(false), 1500)
  }

  const slDoneCities = slCities.filter(c => slCleanedCities.includes(c))
  const slProgress = slCities.length > 0 ? Math.round((slDoneCities.length / slCities.length) * 100) : 0

  // ── LogBook state ──
  const lbCached = getCachedSectionConfig('logBook')
  const [lbCities, setLbCities] = useState(lbCached.cities)
  const [lbCleanedCities, setLbCleanedCities] = useState(lbCached.cleanedCities)
  const [lbNewCity, setLbNewCity] = useState('')
  const [lbSaved, setLbSaved] = useState(false)
  const [lbLoading, setLbLoading] = useState(true)
  const [lbSaving, setLbSaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      setLbLoading(true)
      try {
        const remote = await loadLogBookCityConfig()
        if (remote) {
          setLbCities(remote.cities)
          setLbCleanedCities(remote.cleanedCities)
          cacheSectionConfig('logBook', remote.cities, remote.cleanedCities)
        }
      } catch (err) {
        console.warn('Could not load logbook cities:', err.message)
      }
      setLbLoading(false)
    })()
  }, [])

  const saveLbToFirebase = async (cities, cleaned) => {
    setLbSaving(true)
    try {
      const result = await saveLogBookCityConfig(cities, cleaned)
      setLbCities(result.cities)
      setLbCleanedCities(result.cleanedCities)
      cacheSectionConfig('logBook', result.cities, result.cleanedCities)
      flashLbSaved()
    } catch (err) {
      console.error('Failed to save logbook cities:', err)
    } finally {
      setLbSaving(false)
    }
  }

  const addLbCity = () => {
    const city = lbNewCity.trim()
    if (!city || lbCities.some(c => c.toLowerCase() === city.toLowerCase())) return
    const updated = [...lbCities, city].sort((a, b) => a.localeCompare(b))
    setLbCities(updated)
    setLbNewCity('')
    saveLbToFirebase(updated, lbCleanedCities)
  }

  const removeLbCity = (city) => {
    const updatedCities = lbCities.filter(c => c !== city)
    const updatedCleaned = lbCleanedCities.filter(c => c !== city)
    setLbCities(updatedCities)
    setLbCleanedCities(updatedCleaned)
    saveLbToFirebase(updatedCities, updatedCleaned)
  }

  const toggleLbCleaned = (city) => {
    const isCleaned = lbCleanedCities.includes(city)
    const updatedCleaned = isCleaned
      ? lbCleanedCities.filter(c => c !== city)
      : [...lbCleanedCities, city]
    setLbCleanedCities(updatedCleaned)
    saveLbToFirebase(lbCities, updatedCleaned)
  }

  const flashLbSaved = () => {
    setLbSaved(true)
    setTimeout(() => setLbSaved(false), 1500)
  }

  const lbDoneCities = lbCities.filter(c => lbCleanedCities.includes(c))
  const lbProgress = lbCities.length > 0 ? Math.round((lbDoneCities.length / lbCities.length) * 100) : 0

  return (
    <div className="grid grid-cols-2 gap-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="bg-white border border-surface-lighter rounded-2xl overflow-hidden shadow-sm"
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
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1.5 bg-surface-lighter rounded-full overflow-hidden max-w-[200px]">
                    <motion.div
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="text-emerald-600 font-bold text-[11px]">{doneCities.length} done</span>
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
            <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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

      {/* ── Attendance Cities Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="bg-white border border-surface-lighter rounded-2xl overflow-hidden shadow-sm"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-amber-50/80 to-transparent border-b border-surface-lighter/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-400 flex items-center justify-center shadow-md shadow-amber-500/20">
              <ClipboardList size={18} className="text-white" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-extrabold text-text">Attendance — Cities</h2>
                {attSaving && <Loader2 size={13} className="text-text-muted animate-spin" />}
                <AnimatePresence>
                  {attSaved && (
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
              {!attLoading && attCities.length > 0 && (
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1.5 bg-surface-lighter rounded-full overflow-hidden max-w-[200px]">
                    <motion.div
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${attProgress}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="text-emerald-600 font-bold text-[11px]">{attDoneCities.length} done</span>
                </div>
              )}
            </div>

            {/* Add city */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <MapPin size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted/40" />
                <input
                  type="text"
                  value={attNewCity}
                  onChange={(e) => setAttNewCity(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addAttCity()}
                  placeholder="Add city..."
                  disabled={attSaving}
                  className="w-36 pl-7 pr-3 py-1.5 text-xs bg-white border border-surface-lighter rounded-lg text-text placeholder:text-text-muted/40 focus:outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-500/10 disabled:opacity-50 transition-all"
                />
              </div>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={addAttCity}
                disabled={!attNewCity.trim() || attSaving}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-400 text-white shadow-sm shadow-amber-500/20 hover:shadow-md hover:shadow-amber-500/25 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <Plus size={13} strokeWidth={2.5} />
                Add
              </motion.button>
            </div>
          </div>
        </div>

        {/* City Cards */}
        <div className="p-5">
          {attLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-2 py-12"
            >
              <Loader2 size={20} className="text-amber-500 animate-spin" />
              <p className="text-xs text-text-muted">Loading cities...</p>
            </motion.div>
          ) : attCities.length === 0 ? (
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
            <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <AnimatePresence mode="popLayout">
                {attCities.map((city, i) => {
                  const isCleaned = attCleanedCities.includes(city)
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
                      <motion.button
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.85 }}
                        onClick={() => removeAttCity(city)}
                        disabled={attSaving}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white border border-red-200 flex items-center justify-center shadow-sm cursor-pointer disabled:opacity-40 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={8} className="text-red-400" strokeWidth={3} />
                      </motion.button>

                      <span className={`text-[11px] font-semibold leading-tight flex-1 truncate ${
                        isCleaned ? 'text-emerald-700' : 'text-text'
                      }`}>
                        {city}
                      </span>

                      <button
                        onClick={() => toggleAttCleaned(city)}
                        disabled={attSaving}
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

      {/* ── Skip Line Cities Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        className="bg-white border border-surface-lighter rounded-2xl overflow-hidden shadow-sm col-span-2"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-cyan-50/80 to-transparent border-b border-surface-lighter/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-400 flex items-center justify-center shadow-md shadow-cyan-500/20">
              <SkipForward size={18} className="text-white" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-extrabold text-text">Skip Line — Cities</h2>
                {slSaving && <Loader2 size={13} className="text-text-muted animate-spin" />}
                <AnimatePresence>
                  {slSaved && (
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
              {!slLoading && slCities.length > 0 && (
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1.5 bg-surface-lighter rounded-full overflow-hidden max-w-[200px]">
                    <motion.div
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${slProgress}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="text-emerald-600 font-bold text-[11px]">{slDoneCities.length} done</span>
                </div>
              )}
            </div>

            {/* Add city */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <MapPin size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted/40" />
                <input
                  type="text"
                  value={slNewCity}
                  onChange={(e) => setSlNewCity(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addSlCity()}
                  placeholder="Add city..."
                  disabled={slSaving}
                  className="w-36 pl-7 pr-3 py-1.5 text-xs bg-white border border-surface-lighter rounded-lg text-text placeholder:text-text-muted/40 focus:outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/10 disabled:opacity-50 transition-all"
                />
              </div>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={addSlCity}
                disabled={!slNewCity.trim() || slSaving}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-500 to-teal-400 text-white shadow-sm shadow-cyan-500/20 hover:shadow-md hover:shadow-cyan-500/25 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <Plus size={13} strokeWidth={2.5} />
                Add
              </motion.button>
            </div>
          </div>
        </div>

        {/* City Cards */}
        <div className="p-5">
          {slLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-2 py-12"
            >
              <Loader2 size={20} className="text-cyan-500 animate-spin" />
              <p className="text-xs text-text-muted">Loading cities...</p>
            </motion.div>
          ) : slCities.length === 0 ? (
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
            <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <AnimatePresence mode="popLayout">
                {slCities.map((city, i) => {
                  const isCleaned = slCleanedCities.includes(city)
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
                      <motion.button
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.85 }}
                        onClick={() => removeSlCity(city)}
                        disabled={slSaving}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white border border-red-200 flex items-center justify-center shadow-sm cursor-pointer disabled:opacity-40 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={8} className="text-red-400" strokeWidth={3} />
                      </motion.button>

                      <span className={`text-[11px] font-semibold leading-tight flex-1 truncate ${
                        isCleaned ? 'text-emerald-700' : 'text-text'
                      }`}>
                        {city}
                      </span>

                      <button
                        onClick={() => toggleSlCleaned(city)}
                        disabled={slSaving}
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

      {/* ── LogBook Cities Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.3 }}
        className="bg-white border border-surface-lighter rounded-2xl overflow-hidden shadow-sm col-span-2"
      >
        <div className="px-5 py-4 bg-gradient-to-r from-violet-50/80 to-transparent border-b border-surface-lighter/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-400 flex items-center justify-center shadow-md shadow-violet-500/20">
              <BookOpen size={18} className="text-white" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-extrabold text-text">LogBook — Cities</h2>
                {lbSaving && <Loader2 size={13} className="text-text-muted animate-spin" />}
                <AnimatePresence>
                  {lbSaved && (
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
              {!lbLoading && lbCities.length > 0 && (
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1.5 bg-surface-lighter rounded-full overflow-hidden max-w-[200px]">
                    <motion.div
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${lbProgress}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="text-emerald-600 font-bold text-[11px]">{lbDoneCities.length} done</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <MapPin size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted/40" />
                <input
                  type="text"
                  value={lbNewCity}
                  onChange={(e) => setLbNewCity(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addLbCity()}
                  placeholder="Add city..."
                  disabled={lbSaving}
                  className="w-36 pl-7 pr-3 py-1.5 text-xs bg-white border border-surface-lighter rounded-lg text-text placeholder:text-text-muted/40 focus:outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-500/10 disabled:opacity-50 transition-all"
                />
              </div>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={addLbCity}
                disabled={!lbNewCity.trim() || lbSaving}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-violet-500 to-purple-400 text-white shadow-sm shadow-violet-500/20 hover:shadow-md hover:shadow-violet-500/25 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <Plus size={13} strokeWidth={2.5} />
                Add
              </motion.button>
            </div>
          </div>
        </div>

        <div className="p-5">
          {lbLoading ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2 py-12">
              <Loader2 size={20} className="text-violet-500 animate-spin" />
              <p className="text-xs text-text-muted">Loading cities...</p>
            </motion.div>
          ) : lbCities.length === 0 ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-surface-light flex items-center justify-center mx-auto mb-3">
                <MapPin size={24} className="text-text-muted/30" />
              </div>
              <p className="text-sm font-medium text-text-muted">No cities added yet</p>
              <p className="text-[11px] text-text-muted/60 mt-0.5">Use the input above to add a city</p>
            </motion.div>
          ) : (
            <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <AnimatePresence mode="popLayout">
                {lbCities.map((city, i) => {
                  const isCleaned = lbCleanedCities.includes(city)
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
                      <motion.button
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.85 }}
                        onClick={() => removeLbCity(city)}
                        disabled={lbSaving}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white border border-red-200 flex items-center justify-center shadow-sm cursor-pointer disabled:opacity-40 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={8} className="text-red-400" strokeWidth={3} />
                      </motion.button>

                      <span className={`text-[11px] font-semibold leading-tight flex-1 truncate ${
                        isCleaned ? 'text-emerald-700' : 'text-text'
                      }`}>
                        {city}
                      </span>

                      <button
                        onClick={() => toggleLbCleaned(city)}
                        disabled={lbSaving}
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
