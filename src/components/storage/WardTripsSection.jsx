import { useState, useEffect, useRef } from 'react'
import { Loader2, FileImage, Search, RefreshCw, Calendar, Trash2, X, Clock, Settings2, Check, MapPin, Route } from 'lucide-react'
import { deleteStorageFiles, listWardTripsYearMonths, scanWardTripsMonth, resetWardTripsMonth, saveWardTripsScanResult, loadWardTripsScanResult, resolveCommonCities, loadWardTripsCities, saveWardTripsCities } from '../../lib/firebase'

export default function WardTripsSection() {
  // City selection
  const [allCities, setAllCities] = useState([])
  const [includedCities, setIncludedCities] = useState([])
  const [mainPageCities, setMainPageCities] = useState([])
  const [selectedCity, setSelectedCity] = useState(null)
  const [loadingCities, setLoadingCities] = useState(true)
  const [savingCities, setSavingCities] = useState(false)

  useEffect(() => {
    loadWardTripsCities().then(async (config) => {
      if (config.included.length > 0) {
        setIncludedCities(config.included)
        setMainPageCities(config.mainPage)
        const firstCity = config.mainPage[0] || config.included[0]
        if (firstCity) {
          setSelectedCity(firstCity)
          const cached = await loadWardTripsScanResult(firstCity)
          if (cached) {
            setScanResult(cached)
            // Auto-select first month with data
            const firstMonth = Object.entries(cached.months || {})
              .filter(([, m]) => (m.totalFiles || 0) > 0)
              .sort(([a], [b]) => b.localeCompare(a))[0]
            if (firstMonth) setSelectedYearMonth(firstMonth[0])
          }
        }
      }
      initialLoadDone.current = true
      setLoadingCities(false)
    })
    resolveCommonCities().then(master => {
      if (master && master.length > 0) setAllCities(master)
    })
  }, [])

  const saveCities = async (included, mainPage) => {
    setSavingCities(true)
    await saveWardTripsCities(included, mainPage)
    setSavingCities(false)
  }

  const addCity = async (city) => {
    const updated = [...includedCities, city].sort()
    setIncludedCities(updated)
    await saveCities(updated, mainPageCities)
    if (!selectedCity) setSelectedCity(city)
  }

  const removeCity = async (city) => {
    const updatedIncluded = includedCities.filter(c => c !== city)
    const updatedMainPage = mainPageCities.filter(c => c !== city)
    setIncludedCities(updatedIncluded)
    setMainPageCities(updatedMainPage)
    await saveCities(updatedIncluded, updatedMainPage)
    if (selectedCity === city) setSelectedCity(updatedMainPage[0] || updatedIncluded[0] || null)
  }

  const toggleMainPage = async (city) => {
    const isOn = mainPageCities.includes(city)
    const updated = isOn ? mainPageCities.filter(c => c !== city) : [...mainPageCities, city].sort()
    setMainPageCities(updated)
    if (isOn && selectedCity === city) {
      setSelectedCity(updated[0] || null)
      if (updated.length === 0) { setScanResult(null); setAllDateFiles({}) }
    } else if (!isOn && !selectedCity) {
      setSelectedCity(city)
    }
    await saveCities(includedCities, updated)
  }

  const availableCities = allCities.filter(c => !includedCities.includes(c))

  // Scan result & navigation
  const [scanResult, setScanResult] = useState(null)
  const [loadingScanResult, setLoadingScanResult] = useState(false)
  const initialLoadDone = useRef(false)

  const [selectedYearMonth, setSelectedYearMonth] = useState(null) // "2025/August"
  const [selectedDate, setSelectedDate] = useState(null)

  const [allDateFiles, setAllDateFiles] = useState({})
  const [selectedFiles, setSelectedFiles] = useState(new Set())
  const [deleting, setDeleting] = useState(false)

  // Drawer state
  const [showCityDrawer, setShowCityDrawer] = useState(false)
  const [showAvailableCities, setShowAvailableCities] = useState(false)
  const [drawerSelectedCity, setDrawerSelectedCity] = useState(null)
  const [drawerYearMonths, setDrawerYearMonths] = useState([])
  const [drawerScanData, setDrawerScanData] = useState(null)
  const [loadingDrawerYearMonths, setLoadingDrawerYearMonths] = useState(false)

  // Scan state
  const [scanningMonth, setScanningMonth] = useState(null) // "2025/August"
  const [monthScanProgress, setMonthScanProgress] = useState(null)
  const [monthScanElapsed, setMonthScanElapsed] = useState(0)
  const monthTimerRef = useRef(null)
  const [scanAllRunning, setScanAllRunning] = useState(false)
  const [scanAllStopping, setScanAllStopping] = useState(false)
  const stopScanAllRef = useRef(false)

  // Load drawer data when city changes
  useEffect(() => {
    if (!drawerSelectedCity) { setDrawerYearMonths([]); setDrawerScanData(null); return }
    setLoadingDrawerYearMonths(true)
    Promise.all([
      listWardTripsYearMonths(drawerSelectedCity),
      loadWardTripsScanResult(drawerSelectedCity),
    ]).then(([yearMonths, scanData]) => {
      setDrawerYearMonths(yearMonths || [])
      setDrawerScanData(scanData || null)
    }).catch(() => { setDrawerYearMonths([]); setDrawerScanData(null) })
      .finally(() => setLoadingDrawerYearMonths(false))
  }, [drawerSelectedCity])

  // Derived: month list for sidebar (newest first)
  const MONTH_NUM = { January:1, February:2, March:3, April:4, May:5, June:6, July:7, August:8, September:9, October:10, November:11, December:12 }
  const monthList = scanResult
    ? Object.entries(scanResult.months || {}).filter(([, m]) => (m.totalFiles || 0) > 0).sort(([a], [b]) => {
        const [yA, mA] = a.split('/'); const [yB, mB] = b.split('/')
        return yB.localeCompare(yA) || (MONTH_NUM[mB] || 0) - (MONTH_NUM[mA] || 0)
      })
    : []

  // Derived: date list for selected month
  const dateList = (scanResult && selectedYearMonth && scanResult.months?.[selectedYearMonth]?.dates)
    ? Object.entries(scanResult.months[selectedYearMonth].dates).sort(([a], [b]) => a.localeCompare(b))
    : []

  // Derived: all files flat
  const allFiles = Object.values(allDateFiles).flat()

  function formatElapsed(seconds) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}h ${m}m ${s}s`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  function timeAgo(isoStr) {
    const diff = Date.now() - new Date(isoStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  function formatMonthLabel(key) {
    const [year, month] = key.split('/')
    return `${month} ${year}`
  }

  // Scan a single month
  const handleScanMonth = async (city, year, month) => {
    const monthKey = `${year}/${month}`
    setScanningMonth(monthKey)
    setMonthScanProgress(null)
    setMonthScanElapsed(0)
    monthTimerRef.current = setInterval(() => setMonthScanElapsed(t => t + 1), 1000)
    try {
      const result = await scanWardTripsMonth(city, year, month, (progress) => {
        setMonthScanProgress(progress)
      })
      if (city === selectedCity) {
        setScanResult(result)
        if (!selectedYearMonth) {
          const first = Object.entries(result.months || {}).filter(([, m]) => m.totalFiles > 0).sort(([a], [b]) => b.localeCompare(a))[0]
          if (first) setSelectedYearMonth(first[0])
        }
      }
      setDrawerScanData(result)
    } catch {
      alert('Scan failed. Please try again.')
    }
    clearInterval(monthTimerRef.current)
    setScanningMonth(null)
    setMonthScanProgress(null)
  }

  // Scan all unscanned months
  const handleScanAll = async () => {
    const city = drawerSelectedCity
    if (!city || drawerYearMonths.length === 0) return
    setScanAllRunning(true)
    setScanAllStopping(false)
    stopScanAllRef.current = false

    for (const { year, month } of drawerYearMonths) {
      if (stopScanAllRef.current) break
      const monthKey = `${year}/${month}`
      if (drawerScanData?.months?.[monthKey]) continue // skip already scanned

      await handleScanMonth(city, year, month)
    }

    setScanAllRunning(false)
    setScanAllStopping(false)
    stopScanAllRef.current = false
  }

  const stopScanAll = () => {
    stopScanAllRef.current = true
    setScanAllStopping(true)
  }

  // Delete
  const handleDeleteSelected = async () => {
    if (selectedFiles.size === 0) return
    setDeleting(true)
    try {
      const { deleted, failed } = await deleteStorageFiles([...selectedFiles])
      const failedSet = new Set(failed)

      // Update allDateFiles
      setAllDateFiles(prev => {
        const next = {}
        for (const [date, files] of Object.entries(prev)) {
          next[date] = files.filter(f => !selectedFiles.has(f.fullPath) || failedSet.has(f.fullPath))
        }
        return next
      })
      setSelectedFiles(new Set(failed))

      // Update scan result
      if (scanResult && selectedYearMonth && deleted > 0) {
        const next = JSON.parse(JSON.stringify(scanResult))
        const monthData = next.months?.[selectedYearMonth]
        if (monthData) {
          const deletedPaths = new Set([...selectedFiles].filter(p => !failedSet.has(p)))
          for (const [date, dateData] of Object.entries(monthData.dates || {})) {
            for (const [ward, wardData] of Object.entries(dateData.wards || {})) {
              for (const [trip, files] of Object.entries(wardData.trips || {})) {
                wardData.trips[trip] = files.filter(f => !deletedPaths.has(f.fullPath))
                if (wardData.trips[trip].length === 0) delete wardData.trips[trip]
              }
              const tripFiles = Object.values(wardData.trips || {}).flat()
              wardData.totalFiles = tripFiles.length
              if (wardData.totalFiles === 0) delete dateData.wards[ward]
            }
            dateData.totalFiles = Object.values(dateData.wards || {}).reduce((s, w) => s + w.totalFiles, 0)
            if (dateData.totalFiles === 0) delete monthData.dates[date]
          }
          monthData.totalFiles = Object.values(monthData.dates || {}).reduce((s, d) => s + d.totalFiles, 0)
          if (monthData.totalFiles === 0) delete next.months[selectedYearMonth]
        }
        next.totalFiles = Object.values(next.months || {}).reduce((s, m) => s + m.totalFiles, 0)
        setScanResult(next)
        if (selectedCity === drawerSelectedCity) setDrawerScanData(next)
        saveWardTripsScanResult(selectedCity, next).catch(() => {})

        // Auto-advance if month emptied
        if (!next.months?.[selectedYearMonth]) {
          const nextMonth = Object.entries(next.months || {}).filter(([, m]) => m.totalFiles > 0).sort(([a], [b]) => b.localeCompare(a))[0]
          setSelectedYearMonth(nextMonth?.[0] || null)
          setSelectedDate(null)
          setAllDateFiles({})
        }
      }

      if (failed.length > 0) alert(`${deleted} file(s) deleted. ${failed.length} file(s) failed.`)
    } catch {
      alert('Failed to delete files. Please try again.')
    }
    setDeleting(false)
  }

  // Load scan result when city changes
  useEffect(() => {
    if (!selectedCity) { setLoadingScanResult(false); return }
    if (!initialLoadDone.current) return
    setLoadingScanResult(true)
    setScanResult(null)
    setSelectedYearMonth(null)
    setSelectedDate(null)
    setAllDateFiles({})
    loadWardTripsScanResult(selectedCity).then(cached => {
      if (cached) {
        setScanResult(cached)
        const firstMonth = Object.entries(cached.months || {}).filter(([, m]) => (m.totalFiles || 0) > 0).sort(([a], [b]) => b.localeCompare(a))[0]
        if (firstMonth) setSelectedYearMonth(firstMonth[0])
      }
    }).finally(() => setLoadingScanResult(false))
  }, [selectedCity])

  // Build allDateFiles when month/date changes
  useEffect(() => {
    if (!selectedCity || !selectedYearMonth || !scanResult) {
      setAllDateFiles({})
      return
    }
    setSelectedFiles(new Set())
    const monthData = scanResult.months?.[selectedYearMonth]
    if (!monthData?.dates) { setAllDateFiles({}); return }

    // Flatten: for each date, collect all files across wards+trips
    const map = {}
    for (const [date, dateData] of Object.entries(monthData.dates)) {
      const files = []
      for (const [, wardData] of Object.entries(dateData.wards || {})) {
        for (const [, tripFiles] of Object.entries(wardData.trips || {})) {
          files.push(...tripFiles)
        }
      }
      map[date] = files
    }
    setAllDateFiles(map)
  }, [selectedCity, selectedYearMonth, scanResult])

  // ── Drawer Render ──
  const renderCityDrawer = () => {
    const drawerCityIsOnMainPage = drawerSelectedCity ? mainPageCities.includes(drawerSelectedCity) : false
    const scannedMonths = drawerScanData?.months ? Object.keys(drawerScanData.months) : []
    const scannedCount = scannedMonths.length

    return (
    <>
      <div className={`fixed inset-0 z-50 transition-opacity duration-200 ${showCityDrawer ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={() => !scanningMonth && setShowCityDrawer(false)} />
        <div className={`absolute top-0 right-0 h-full w-[55vw] bg-gradient-to-b from-white to-slate-50/80 shadow-2xl transition-transform duration-300 ease-out flex flex-col ${showCityDrawer ? 'translate-x-0' : 'translate-x-full'}`}>

          {/* Header */}
          <div className="px-5 py-3.5 border-b border-slate-100 bg-white flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-sm">
              <Settings2 size={14} className="text-white" />
            </div>
            <h3 className="text-[13px] font-bold text-slate-800 flex-1">City Setting</h3>
            <button
              disabled={!!scanningMonth}
              onClick={() => setShowAvailableCities(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-teal-600 bg-teal-50 border border-teal-200/80 hover:bg-teal-100 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="text-sm leading-none">+</span> Add City
            </button>
            {savingCities && <Loader2 size={14} className="animate-spin text-teal-400" />}
            <button disabled={!!scanningMonth} onClick={() => !scanningMonth && setShowCityDrawer(false)} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${scanningMonth ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-100 cursor-pointer'}`}>
              <X size={15} className="text-slate-400" />
            </button>
          </div>

          {/* Body */}
          <div className="flex flex-1 min-h-0">

            {/* Left: City list */}
            <div className="w-[180px] shrink-0 border-r border-slate-100 bg-white/60 flex flex-col">
              <div className="px-3 py-2 border-b border-slate-100">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{includedCities.length} Cities</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {includedCities.length === 0 ? (
                  <p className="text-[10px] text-text-muted px-3 py-6 text-center">No cities yet</p>
                ) : (
                  includedCities.map((city) => {
                    const isSelected = drawerSelectedCity === city
                    const isOnPage = mainPageCities.includes(city)
                    return (
                      <button
                        key={city}
                        disabled={!!scanningMonth}
                        onClick={() => !scanningMonth && setDrawerSelectedCity(city)}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-all border-l-2 ${
                          scanningMonth
                            ? (isSelected ? 'bg-teal-50/80 border-l-teal-500 text-teal-700 cursor-not-allowed' : 'border-l-transparent text-slate-400 cursor-not-allowed opacity-50')
                            : isSelected
                              ? 'bg-teal-50/80 border-l-teal-500 text-teal-700 cursor-pointer'
                              : 'border-l-transparent hover:bg-slate-50 text-slate-600 cursor-pointer'
                        }`}
                      >
                        <span className={`text-[11px] flex-1 truncate ${isSelected ? 'font-bold' : 'font-medium'}`}>{city}</span>
                        {isOnPage && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* Right: Selected city detail */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {!drawerSelectedCity ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                    <MapPin size={20} className="text-slate-300" />
                  </div>
                  <p className="text-[11px] text-slate-400">Select a city to manage</p>
                </div>
              ) : (
                <>
                  {/* City header with actions */}
                  <div className="px-5 py-3 border-b border-slate-100 bg-white">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[14px] font-bold text-slate-800 flex-1">{drawerSelectedCity}</h3>
                      <button
                        disabled={savingCities}
                        onClick={() => toggleMainPage(drawerSelectedCity)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer disabled:opacity-50 ${
                          drawerCityIsOnMainPage
                            ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20 hover:bg-emerald-600'
                            : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200'
                        }`}
                      >
                        {drawerCityIsOnMainPage ? '✓ On Page' : 'Show on Page'}
                      </button>
                      {!drawerCityIsOnMainPage && (
                        <button
                          disabled={savingCities}
                          onClick={() => { removeCity(drawerSelectedCity); setDrawerSelectedCity(null) }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer disabled:opacity-50 text-red-400 border border-red-200/80 hover:bg-red-50 hover:text-red-600"
                        >
                          <X size={11} /> Remove
                        </button>
                      )}
                    </div>

                    {/* Summary */}
                    {drawerYearMonths.length > 0 && (
                      <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400">
                        <span>{drawerYearMonths.length} months</span>
                        <span>·</span>
                        <span>{scannedCount} scanned</span>
                      </div>
                    )}
                  </div>

                  {/* Toolbar */}
                  <div className="px-5 py-2 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500">Year / Months</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200/60 text-slate-500 font-semibold">{drawerYearMonths.length}</span>
                      {scannedCount > 0 && !scanAllRunning && !scanningMonth && (
                        <button
                          onClick={() => {
                            if (!window.confirm(`Reset all scan data for ${drawerSelectedCity}?`)) return
                            const empty = { city: drawerSelectedCity, totalFiles: 0, months: {} }
                            setDrawerScanData(null)
                            saveWardTripsScanResult(drawerSelectedCity, empty)
                            if (drawerSelectedCity === selectedCity) setScanResult(null)
                          }}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-semibold text-red-400 hover:bg-red-50 border border-red-200/60 transition-all cursor-pointer"
                        >
                          <RefreshCw size={8} /> Reset All
                        </button>
                      )}
                    </div>
                    {scanAllRunning ? (
                      scanAllStopping ? (
                        <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                          Stopping...
                        </span>
                      ) : (
                        <button onClick={stopScanAll} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-semibold bg-red-500 text-white hover:bg-red-600 transition-all cursor-pointer shadow-sm">
                          <X size={10} /> Stop Scanning
                        </button>
                      )
                    ) : (
                      <button
                        disabled={!!scanningMonth}
                        onClick={handleScanAll}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-semibold bg-teal-500 text-white hover:bg-teal-600 transition-all cursor-pointer disabled:opacity-30 shadow-sm"
                      >
                        <Search size={10} /> Scan All
                      </button>
                    )}
                  </div>

                  {/* Year/Month cards */}
                  <div className="flex-1 overflow-y-auto">
                    {loadingDrawerYearMonths ? (
                      <div className="flex items-center justify-center py-12 gap-2">
                        <Loader2 size={16} className="animate-spin text-teal-400" />
                        <span className="text-xs text-text-muted">Loading year/months...</span>
                      </div>
                    ) : drawerYearMonths.length === 0 ? (
                      <div className="text-center py-12 text-xs text-text-muted">No data found</div>
                    ) : (
                      <div className="p-3">
                        {[...new Set(drawerYearMonths.map(ym => ym.year))].map(year => {
                          const months = drawerYearMonths.filter(ym => ym.year === year)
                          return (
                            <div key={year} className="mb-4 last:mb-0">
                              <div className="flex items-center gap-2 mb-2">
                                <Calendar size={12} className="text-slate-400" />
                                <span className="text-[11px] font-bold text-slate-700">{year}</span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 font-semibold">{months.length} months</span>
                              </div>
                              <div className="grid grid-cols-4 gap-2">
                                {months.map(({ month }) => {
                                  const monthKey = `${year}/${month}`
                                  const monthScan = drawerScanData?.months?.[monthKey]
                                  const isScanned = !!monthScan
                                  const hasData = isScanned && (monthScan.totalFiles || 0) > 0
                                  const isCleaned = isScanned && (monthScan.totalFiles || 0) === 0
                                  const isThisScanning = scanningMonth === monthKey
                                  const isBusy = !!scanningMonth

                                  return (
                                    <div key={monthKey} className={`relative rounded-xl border p-3 transition-all ${
                                      isThisScanning
                                        ? 'border-teal-300 bg-teal-50 shadow-sm'
                                        : isCleaned
                                          ? 'border-emerald-200 bg-emerald-50/40'
                                          : hasData
                                            ? 'border-amber-200 bg-amber-50/30'
                                            : 'border-slate-200 bg-white hover:shadow-sm'
                                    }`}>
                                      {/* Scan / Reset button */}
                                      {!isThisScanning && !isBusy && (
                                        <button
                                          onClick={() => {
                                            if (isScanned) {
                                              resetWardTripsMonth(drawerSelectedCity, year, month).then(result => {
                                                setDrawerScanData(result)
                                                if (drawerSelectedCity === selectedCity) setScanResult(result)
                                              })
                                            } else {
                                              handleScanMonth(drawerSelectedCity, year, month)
                                            }
                                          }}
                                          className="absolute top-1.5 right-1.5 text-[7px] font-semibold text-slate-300 hover:text-teal-500 transition-colors cursor-pointer"
                                          title={isScanned ? 'Reset' : 'Scan'}
                                        >
                                          {isScanned ? '✕' : <Search size={10} />}
                                        </button>
                                      )}

                                      {/* Month name + status */}
                                      <div className="flex items-center gap-1.5 mb-1">
                                        {isThisScanning ? (
                                          <Loader2 size={11} className="animate-spin text-teal-500 shrink-0" />
                                        ) : isCleaned ? (
                                          <Check size={11} className="text-emerald-500 shrink-0" strokeWidth={3} />
                                        ) : hasData ? (
                                          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                                        ) : (
                                          <span className="w-2 h-2 rounded-full bg-slate-200 shrink-0" />
                                        )}
                                        <span className={`text-[11px] font-bold truncate ${
                                          isThisScanning ? 'text-teal-700' : isCleaned ? 'text-emerald-600' : hasData ? 'text-slate-700' : 'text-slate-400'
                                        }`}>{month}</span>
                                      </div>

                                      {/* Status info */}
                                      {isThisScanning ? (
                                        <div className="flex items-center gap-2 text-[8px] flex-wrap">
                                          <span className="font-semibold text-teal-600">{formatElapsed(monthScanElapsed)}</span>
                                          {monthScanProgress?.apiCalls > 0 && (
                                            <span className="text-sky-500">{monthScanProgress.apiCalls} calls</span>
                                          )}
                                        </div>
                                      ) : hasData ? (
                                        <div className="text-[9px] font-semibold text-amber-600">Has data</div>
                                      ) : isCleaned ? (
                                        <div className="text-[9px] font-semibold text-emerald-500">Clean ✓</div>
                                      ) : (
                                        <div className="text-[9px] text-slate-400">Not scanned</div>
                                      )}

                                      {isScanned && monthScan.scannedAt && !isThisScanning && (
                                        <div className="text-[8px] text-slate-300 mt-1">{timeAgo(monthScan.scannedAt)}</div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Available Cities Popup */}
          {showAvailableCities && (
            <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
              <div className="absolute inset-0 bg-black/20" onClick={() => setShowAvailableCities(false)} />
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col animate-[slideUp_0.2s_ease-out]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-surface-lighter">
                  <h4 className="text-sm font-bold text-text">Available Cities ({availableCities.length})</h4>
                  <button onClick={() => setShowAvailableCities(false)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                    <X size={16} className="text-gray-400" />
                  </button>
                </div>
                <div className="p-3 overflow-y-auto flex-1">
                  {availableCities.length === 0 ? (
                    <p className="text-xs text-text-muted text-center py-4">All cities already included</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {availableCities.map(city => (
                        <button
                          key={city}
                          disabled={savingCities}
                          onClick={() => addCity(city)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer disabled:opacity-50 bg-surface-light text-slate-500 border border-slate-200 hover:bg-teal-50 hover:text-teal-600 hover:border-teal-200"
                        >
                          <span className="text-teal-400 text-xs">+</span>
                          {city}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )}

  if (loadingCities || loadingScanResult) {
    return <div className="flex items-center justify-center h-full"><Loader2 size={20} className="animate-spin text-primary" /></div>
  }

  const noCity = mainPageCities.length === 0
  const hasData = !noCity && !!scanResult && monthList.length > 0
  const noData = !noCity && !hasData

  return (
    <>
    <div className="h-full p-[1px] rounded-xl relative overflow-hidden" style={{
      background: 'conic-gradient(from var(--border-angle, 0deg), #8b5cf6, #a78bfa, #c084fc, #8b5cf6)',
      animation: 'spin-border 3s linear infinite'
    }}>
    <style>{`@keyframes spin-border { to { --border-angle: 360deg; } } @property --border-angle { syntax: "<angle>"; initial-value: 0deg; inherits: false; }`}</style>
    <div className="flex flex-col h-full rounded-[10px] overflow-hidden bg-white">
      {/* Top bar */}
      <div className="flex items-center px-4 py-2 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
            <Route size={13} className="text-white" />
          </div>
          <h3 className="text-[13px] font-bold text-slate-800">WardTrips</h3>
        </div>
        <div className="flex-1 flex items-center gap-1.5 px-4 overflow-x-auto">
          {mainPageCities.map(city => (
            <button key={city} onClick={() => setSelectedCity(city)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCity === city
                  ? 'bg-teal-500 text-white shadow-md shadow-teal-500/20'
                  : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-teal-50 hover:text-teal-600 hover:border-teal-200'
              }`}
            >
              {city}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => { setShowCityDrawer(true); if (!drawerSelectedCity && includedCities.length > 0) setDrawerSelectedCity(includedCities[0]) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer bg-slate-50 text-slate-600 border border-slate-200 hover:bg-teal-50 hover:text-teal-600 hover:border-teal-200">
            <Settings2 size={12} /> City Setting
          </button>
        </div>
      </div>

      {/* Content area */}
      {noCity ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center border border-slate-200/50">
            <Settings2 size={26} className="text-slate-300" />
          </div>
          <div className="text-center">
            <h3 className="text-sm font-bold text-slate-700 mb-1">No city on page</h3>
            <p className="text-[11px] text-slate-400 max-w-xs">Open <button onClick={() => { setShowCityDrawer(true); if (!drawerSelectedCity && includedCities.length > 0) setDrawerSelectedCity(includedCities[0]) }} className="font-bold text-teal-500 hover:text-teal-600 cursor-pointer underline underline-offset-2">City Setting</button> and mark cities as "Show on Page"</p>
          </div>
        </div>
      ) : noData ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-100 to-teal-50 flex items-center justify-center border border-teal-200/50">
            <Search size={26} className="text-teal-300" />
          </div>
          <div className="text-center">
            <h3 className="text-sm font-bold text-slate-700 mb-1">{selectedCity ? `No scan data for ${selectedCity}` : 'No Scan Data'}</h3>
            <p className="text-[11px] text-slate-400 max-w-xs">Open <button onClick={() => { setShowCityDrawer(true); setDrawerSelectedCity(selectedCity) }} className="font-bold text-teal-500 hover:text-teal-600 cursor-pointer underline underline-offset-2">City Setting</button> → select a month → Scan</p>
          </div>
        </div>
      ) : (
      <div className="flex flex-1 min-h-0">
        {/* Month sidebar */}
        <div className="w-[130px] shrink-0 border-r border-slate-100 bg-slate-50/50 flex flex-col">
          <div className="px-3 py-2 border-b border-slate-100">
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Months</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {monthList.map(([key, data]) => {
              const isSelected = selectedYearMonth === key
              return (
                <button
                  key={key}
                  onClick={() => { setSelectedYearMonth(key); setSelectedDate(null); setAllDateFiles({}) }}
                  className={`w-full px-3 py-2.5 text-left transition-all cursor-pointer border-l-2 ${
                    isSelected
                      ? 'bg-white border-l-teal-500 text-teal-700'
                      : 'border-l-transparent text-slate-500 hover:bg-white/80 hover:text-slate-700'
                  }`}
                >
                  <span className={`text-[11px] block ${isSelected ? 'font-bold' : 'font-medium'}`}>{formatMonthLabel(key)}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {!selectedYearMonth ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <span className="text-[11px] text-slate-400">← Select a month to view data</span>
            </div>
          ) : (
            <>
              {/* Date pills + actions */}
              <div className="px-4 py-2.5 border-b border-slate-100 bg-white">
                <div className="flex items-center gap-2 flex-wrap">
                  {dateList.map(([date, dateData]) => {
                    const isActive = selectedDate === date
                    return (
                      <button key={date} onClick={() => setSelectedDate(selectedDate === date ? null : date)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-teal-500 text-white shadow-sm'
                            : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-teal-50 hover:text-teal-600'
                        }`}>
                        {date}
                      </button>
                    )
                  })}
                  <div className="flex items-center gap-1.5 ml-auto">
                    {selectedFiles.size > 0 && (
                      <button onClick={handleDeleteSelected} disabled={deleting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer bg-red-500 text-white hover:bg-red-600 shadow-sm disabled:opacity-50">
                        {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        {deleting ? 'Deleting...' : `Delete ${selectedFiles.size} files`}
                      </button>
                    )}
                    {allFiles.length > 0 && (
                      <button onClick={() => { if (selectedFiles.size === allFiles.length) setSelectedFiles(new Set()); else setSelectedFiles(new Set(allFiles.map(f => f.fullPath))) }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                          selectedFiles.size === allFiles.length && allFiles.length > 0
                            ? 'bg-teal-500 text-white'
                            : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-teal-50'
                        }`}>
                        {selectedFiles.size === allFiles.length && allFiles.length > 0 ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Ward/Trip cards per date */}
              <div className="flex-1 overflow-y-auto p-4 bg-slate-50/30">
                {(() => {
                  const monthData = scanResult.months?.[selectedYearMonth]
                  if (!monthData?.dates) return <div className="flex items-center justify-center h-32 text-slate-400 text-[11px]">No dates found</div>

                  const datesToShow = selectedDate
                    ? [[selectedDate, monthData.dates[selectedDate]]].filter(([, d]) => d)
                    : Object.entries(monthData.dates).sort(([a], [b]) => a.localeCompare(b))

                  if (datesToShow.length === 0) return <div className="flex items-center justify-center h-32 text-slate-400 text-[11px]">No data for this date</div>

                  return datesToShow.map(([date, dateData]) => {
                    const dateFiles = Object.values(dateData.wards || {}).flatMap(w => Object.values(w.trips || {}).flat())
                    const allDateChecked = dateFiles.length > 0 && dateFiles.every(f => selectedFiles.has(f.fullPath))
                    return (
                    <div key={date} className="mb-5 last:mb-0">
                      {/* Date header */}
                      <div className="flex items-center gap-2 mb-2.5 px-1">
                        <Calendar size={13} className="text-teal-400" />
                        <span className="text-[12px] font-bold text-slate-700">{date}</span>
                        <div className="ml-auto flex items-center gap-2">
                          <input type="checkbox" className="w-3.5 h-3.5 rounded accent-teal-500 cursor-pointer"
                            checked={allDateChecked}
                            onChange={() => {
                              setSelectedFiles(prev => {
                                const next = new Set(prev)
                                dateFiles.forEach(f => { if (allDateChecked) next.delete(f.fullPath); else next.add(f.fullPath) })
                                return next
                              })
                            }} />
                        </div>
                      </div>

                      {/* Compact ward rows */}
                      <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden divide-y divide-slate-100">
                        {Object.entries(dateData.wards || {}).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([ward, wardData]) => {
                          const wardFiles = Object.values(wardData.trips || {}).flat()
                          const allWardChecked = wardFiles.length > 0 && wardFiles.every(f => selectedFiles.has(f.fullPath))
                          const tripCount = Object.keys(wardData.trips || {}).length

                          return (
                            <div key={ward} className={`flex items-center gap-3 px-3 py-2 transition-colors ${allWardChecked ? 'bg-teal-50/50' : 'hover:bg-slate-50/50'}`}>
                              <input type="checkbox" className="w-3.5 h-3.5 rounded accent-teal-500 cursor-pointer shrink-0"
                                checked={allWardChecked}
                                onChange={(e) => {
                                  setSelectedFiles(prev => {
                                    const next = new Set(prev)
                                    wardFiles.forEach(f => { if (e.target.checked) next.add(f.fullPath); else next.delete(f.fullPath) })
                                    return next
                                  })
                                }} />
                              <div className="flex items-center gap-1.5 w-[90px] shrink-0">
                                <Route size={10} className="text-teal-400" />
                                <span className="text-[11px] font-bold text-slate-700 truncate">{ward}</span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                {Object.entries(wardData.trips || {}).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([trip, files]) => (
                                  <span key={trip} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-[9px] font-medium text-slate-500">
                                    <FileImage size={9} className="text-teal-400/70" />
                                    T{trip}: {files.length}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )})
                })()}
              </div>
            </>
          )}
        </div>
      </div>
      )}
    </div>
    </div>

    {renderCityDrawer()}

    <style>{`
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
    `}</style>
    </>
  )
}
