import { useState, useEffect, useRef } from 'react'
import { Loader2, Search, RefreshCw, Calendar, Trash2, X, Settings2, Check, MapPin, Route } from 'lucide-react'
import { deleteStorageFiles, listWardTripsYearMonths, scanWardTripsMonth, resetWardTripsMonth, saveWardTripsScanResult, loadWardTripsScanResult, resolveCommonCities, loadWardTripsCities, saveWardTripsCities } from '../../lib/firebase'

export default function WardTripsSection() {
  // City selection
  const [allCities, setAllCities] = useState([])
  const [includedCities, setIncludedCities] = useState([])
  const [mainPageCities, setMainPageCities] = useState([])
  const [selectedCity, setSelectedCity] = useState(null)
  const [loadingCities, setLoadingCities] = useState(true)
  const [savingCities, setSavingCities] = useState(false)

  const [scanResult, setScanResult] = useState(null)
  const [loadingScanResult, setLoadingScanResult] = useState(false)
  const initialLoadDone = useRef(false)

  const [selectedWard, setSelectedWard] = useState(null)
  const [selectedYearMonth, setSelectedYearMonth] = useState(null)
  const [selectedFiles, setSelectedFiles] = useState(new Set())
  const [deleting, setDeleting] = useState(false)
  const [autoDeleteRunning, setAutoDeleteRunning] = useState(false)
  const [autoDeleteStopping, setAutoDeleteStopping] = useState(false)
  const [autoDeleteProgress, setAutoDeleteProgress] = useState(null)
  const stopAutoDeleteRef = useRef(false)

  const [showCityDrawer, setShowCityDrawer] = useState(false)
  const [showAvailableCities, setShowAvailableCities] = useState(false)
  const masterCitiesLoaded = useRef(false)
  const [drawerSelectedCity, setDrawerSelectedCity] = useState(null)
  const [drawerYearMonths, setDrawerYearMonths] = useState([])
  const [drawerScanData, setDrawerScanData] = useState(null)
  const [loadingDrawerYearMonths, setLoadingDrawerYearMonths] = useState(false)
  const [scanningMonth, setScanningMonth] = useState(null)
  const [monthScanProgress, setMonthScanProgress] = useState(null)
  const [monthScanElapsed, setMonthScanElapsed] = useState(0)
  const monthTimerRef = useRef(null)
  const [scanAllRunning, setScanAllRunning] = useState(false)
  const [scanAllStopping, setScanAllStopping] = useState(false)
  const stopScanAllRef = useRef(false)

  useEffect(() => {
    const citiesPromise = loadWardTripsCities()
    // Start both in parallel: cities config + scan result for first city
    citiesPromise.then(config => {
      if (config.included.length > 0) {
        setIncludedCities(config.included)
        setMainPageCities(config.mainPage)
        const firstCity = config.mainPage[0] || config.included[0]
        if (firstCity) setSelectedCity(firstCity)
      }
      initialLoadDone.current = true
      setLoadingCities(false)
    })
    citiesPromise.then(config => {
      const firstCity = config.mainPage?.[0] || config.included?.[0]
      if (!firstCity) return
      loadWardTripsScanResult(firstCity).then(cached => {
        if (cached) {
          setScanResult(cached)
          const firstWard = Object.keys(cached.wards || {}).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0]
          if (firstWard) {
            setSelectedWard(firstWard)
            setSelectedYearMonth(getFirstYearMonth(cached, firstWard))
          }
        }
      })
    })
  }, [])

  // Lazy load master cities when drawer opens
  useEffect(() => {
    if (!showCityDrawer || masterCitiesLoaded.current) return
    masterCitiesLoaded.current = true
    resolveCommonCities().then(master => {
      if (master && master.length > 0) setAllCities(master)
    })
  }, [showCityDrawer])

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
      if (updated.length === 0) { setScanResult(null) }
    } else if (!isOn && !selectedCity) {
      setSelectedCity(city)
    }
    await saveCities(includedCities, updated)
  }

  const availableCities = allCities.filter(c => !includedCities.includes(c))

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

  const MONTH_NUM = { January:1, February:2, March:3, April:4, May:5, June:6, July:7, August:8, September:9, October:10, November:11, December:12 }

  const getFirstYearMonth = (data, ward) => {
    if (!data?.wards?.[ward]?.years) return null
    const list = []
    for (const [year, months] of Object.entries(data.wards[ward].years)) {
      for (const month of Object.keys(months)) {
        list.push({ year, month, key: `${year}/${month}` })
      }
    }
    list.sort((a, b) => b.year.localeCompare(a.year) || (MONTH_NUM[a.month] || 0) - (MONTH_NUM[b.month] || 0))
    return list[0]?.key || null
  }

  // Derived: ward list from scan result
  const wardList = scanResult
    ? Object.keys(scanResult.wards || {}).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    : []

  // Derived: year/month list for selected ward
  const yearMonthList = (() => {
    if (!scanResult || !selectedWard || !scanResult.wards?.[selectedWard]?.years) return []
    const list = []
    for (const [year, months] of Object.entries(scanResult.wards[selectedWard].years)) {
      for (const month of Object.keys(months)) {
        list.push({ year, month, key: `${year}/${month}` })
      }
    }
    return list.sort((a, b) => b.year.localeCompare(a.year) || (MONTH_NUM[a.month] || 0) - (MONTH_NUM[b.month] || 0))
  })()

  // Derived: date list for selected ward + year/month
  const dateList = (() => {
    if (!scanResult || !selectedWard || !selectedYearMonth) return []
    const [year, month] = selectedYearMonth.split('/')
    const datesObj = scanResult.wards?.[selectedWard]?.years?.[year]?.[month] || {}
    return Object.entries(datesObj).sort(([a], [b]) => a.localeCompare(b))
  })()

  function formatElapsed(seconds) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}h ${m}m ${s}s`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  function timeAgo(isoStr) {
    if (!isoStr) return ''
    const diff = Date.now() - new Date(isoStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
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
        if (!selectedWard) {
          const firstWard = Object.keys(result.wards || {}).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0]
          if (firstWard) setSelectedWard(firstWard)
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
      if (drawerScanData?.scannedMonths?.includes(monthKey)) continue // skip already scanned
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

  // All files for current view (selected ward + year/month)
  const allFiles = dateList.flatMap(([, files]) => files)

  // Auto-delete all data for current city — sequential month by month
  const handleDeleteAll = async () => {
    if (!scanResult || !selectedCity) return
    const totalFiles = scanResult.totalFiles || 0
    if (totalFiles === 0) return
    if (!window.confirm(`Delete ALL ${totalFiles.toLocaleString()} files from ${selectedCity}? This cannot be undone.`)) return

    setAutoDeleteRunning(true)
    setAutoDeleteStopping(false)
    stopAutoDeleteRef.current = false

    let working = JSON.parse(JSON.stringify(scanResult))
    let deletedSoFar = 0
    let failedSoFar = 0

    const wards = Object.keys(working.wards || {}).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    const totalWards = wards.length
    let wardIdx = 0

    outer: for (const ward of wards) {
      wardIdx++
      const wardData = working.wards[ward]
      if (!wardData?.years) continue

      const years = Object.keys(wardData.years).sort()
      for (const year of years) {
        const months = Object.keys(wardData.years[year] || {})
        for (const month of months) {
          if (stopAutoDeleteRef.current) break outer

          const dates = wardData.years[year][month] || {}
          const filesToDelete = Object.values(dates).flat()
          if (filesToDelete.length === 0) continue

          setAutoDeleteProgress({
            ward, year, month, wardIdx, totalWards,
            deleted: deletedSoFar, failed: failedSoFar,
            currentBatch: filesToDelete.length,
          })

          try {
            const { deleted, failed } = await deleteStorageFiles(filesToDelete)
            deletedSoFar += deleted
            failedSoFar += failed.length
            const failedSet = new Set(failed)

            // Remove deleted file paths from current month's dates
            for (const [date, files] of Object.entries(dates)) {
              dates[date] = files.filter(f => failedSet.has(f))
              if (dates[date].length === 0) delete dates[date]
            }
            // Cleanup empty parents
            if (Object.keys(dates).length === 0) delete wardData.years[year][month]
            if (Object.keys(wardData.years[year] || {}).length === 0) delete wardData.years[year]

            // Recalculate totals + persist
            let rootTotal = 0
            for (const [, wd] of Object.entries(working.wards || {})) {
              let wt = 0
              for (const [, ms] of Object.entries(wd.years || {})) {
                for (const [, ds] of Object.entries(ms)) {
                  for (const [, fs] of Object.entries(ds)) wt += fs.length
                }
              }
              wd.totalFiles = wt
              rootTotal += wt
            }
            working.totalFiles = rootTotal

            setScanResult({ ...working })
            if (selectedCity === drawerSelectedCity) setDrawerScanData({ ...working })
            await saveWardTripsScanResult(selectedCity, working).catch(() => {})
          } catch (err) {
            console.error('Auto delete failed for', ward, year, month, err)
            failedSoFar += filesToDelete.length
          }
        }
      }

      // After ward fully processed, drop it if empty
      if (working.wards[ward] && Object.keys(working.wards[ward].years || {}).length === 0) {
        delete working.wards[ward]
        await saveWardTripsScanResult(selectedCity, working).catch(() => {})
        setScanResult({ ...working })
        if (selectedCity === drawerSelectedCity) setDrawerScanData({ ...working })
      }
    }

    setAutoDeleteProgress({
      ward: '', year: '', month: '', wardIdx: totalWards, totalWards,
      deleted: deletedSoFar, failed: failedSoFar, currentBatch: 0, done: true,
    })
    setAutoDeleteRunning(false)
    setAutoDeleteStopping(false)
    stopAutoDeleteRef.current = false

    // Reset selection state since data may have shifted
    setSelectedFiles(new Set())
    const remainingWard = Object.keys(working.wards || {}).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0]
    setSelectedWard(remainingWard || null)
    setSelectedYearMonth(remainingWard ? getFirstYearMonth(working, remainingWard) : null)
  }

  const stopAutoDelete = () => {
    stopAutoDeleteRef.current = true
    setAutoDeleteStopping(true)
  }

  // Delete selected files
  const handleDeleteSelected = async () => {
    if (selectedFiles.size === 0) return
    setDeleting(true)
    try {
      const { deleted, failed } = await deleteStorageFiles([...selectedFiles])
      const failedSet = new Set(failed)
      const deletedPaths = new Set([...selectedFiles].filter(p => !failedSet.has(p)))
      setSelectedFiles(new Set(failed))

      if (scanResult && selectedWard && selectedYearMonth && deleted > 0) {
        const next = JSON.parse(JSON.stringify(scanResult))
        const [year, month] = selectedYearMonth.split('/')
        const dates = next.wards?.[selectedWard]?.years?.[year]?.[month]
        if (dates) {
          for (const [date, files] of Object.entries(dates)) {
            dates[date] = files.filter(f => !deletedPaths.has(f))
            if (dates[date].length === 0) delete dates[date]
          }
          // If month empty, remove it
          if (Object.keys(dates).length === 0) delete next.wards[selectedWard].years[year][month]
          // If year empty, remove it
          if (Object.keys(next.wards[selectedWard].years[year] || {}).length === 0) delete next.wards[selectedWard].years[year]
          // If ward has no years, remove it
          if (Object.keys(next.wards[selectedWard].years || {}).length === 0) delete next.wards[selectedWard]
        }

        // Recalculate totalFiles
        let rootTotal = 0
        for (const [, wd] of Object.entries(next.wards || {})) {
          let wardTotal = 0
          for (const [, months] of Object.entries(wd.years || {})) {
            for (const [, ds] of Object.entries(months)) {
              for (const [, fs] of Object.entries(ds)) {
                wardTotal += fs.length
              }
            }
          }
          wd.totalFiles = wardTotal
          rootTotal += wardTotal
        }
        next.totalFiles = rootTotal

        setScanResult(next)
        if (selectedCity === drawerSelectedCity) setDrawerScanData(next)
        saveWardTripsScanResult(selectedCity, next).catch(() => {})

        // Auto-advance if month emptied
        if (!next.wards?.[selectedWard]?.years?.[year]?.[month]) {
          setSelectedYearMonth(null)
        }
        // Auto-advance if ward emptied
        if (!next.wards?.[selectedWard]) {
          const nextWard = Object.keys(next.wards || {}).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0]
          setSelectedWard(nextWard || null)
          setSelectedYearMonth(null)
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
    setSelectedWard(null)
    setSelectedYearMonth(null)
    loadWardTripsScanResult(selectedCity).then(cached => {
      if (cached) {
        setScanResult(cached)
        const firstWard = Object.keys(cached.wards || {}).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0]
        if (firstWard) {
          setSelectedWard(firstWard)
          setSelectedYearMonth(getFirstYearMonth(cached, firstWard))
        }
      }
    }).finally(() => setLoadingScanResult(false))
  }, [selectedCity])

  // ── Drawer Render ──
  const renderCityDrawer = () => {
    const drawerCityIsOnMainPage = drawerSelectedCity ? mainPageCities.includes(drawerSelectedCity) : false
    const scannedMonths = drawerScanData?.scannedMonths || []
    const scannedCount = scannedMonths.length

    // Determine which scanned months have data
    const hasDataMonthKeys = new Set()
    if (drawerScanData?.wards) {
      for (const wardData of Object.values(drawerScanData.wards)) {
        for (const [y, months] of Object.entries(wardData.years || {})) {
          for (const m of Object.keys(months)) {
            hasDataMonthKeys.add(`${y}/${m}`)
          }
        }
      }
    }
    const hasDataCount = [...scannedMonths].filter(m => hasDataMonthKeys.has(m)).length
    const cleanedCount = scannedCount - hasDataCount
    const pendingCount = drawerYearMonths.length - scannedCount
    const totalDrawerFiles = drawerScanData?.totalFiles || 0

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
                  {/* City header */}
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

                    {drawerYearMonths.length > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden flex">
                            {cleanedCount > 0 && <div className="h-full bg-emerald-400 transition-all" style={{ width: `${(cleanedCount / drawerYearMonths.length) * 100}%` }} />}
                            {hasDataCount > 0 && <div className="h-full bg-amber-400 transition-all" style={{ width: `${(hasDataCount / drawerYearMonths.length) * 100}%` }} />}
                          </div>
                          <span className="text-[9px] text-slate-400 font-medium shrink-0">{scannedCount}/{drawerYearMonths.length}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5 text-[9px]"><span className="w-2.5 h-2.5 rounded bg-emerald-400 shrink-0" /><span className="text-slate-500">{cleanedCount} Cleaned</span></div>
                          <div className="flex items-center gap-1.5 text-[9px]"><span className="w-2.5 h-2.5 rounded bg-amber-400 shrink-0" /><span className="text-slate-500">{hasDataCount} Has Data</span></div>
                          <div className="flex items-center gap-1.5 text-[9px]"><span className="w-2.5 h-2.5 rounded bg-slate-200 shrink-0" /><span className="text-slate-400">{pendingCount} Pending</span></div>
                          {totalDrawerFiles > 0 && <span className="text-[9px] font-semibold text-amber-500 ml-auto">{totalDrawerFiles.toLocaleString()} files</span>}
                        </div>
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
                            const empty = { city: drawerSelectedCity, scannedAt: new Date().toISOString(), scannedMonths: [], wards: {} }
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
                                  const isScanned = scannedMonths.includes(monthKey)
                                  const hasData = isScanned && hasDataMonthKeys.has(monthKey)
                                  const isCleaned = isScanned && !hasData
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
                                          {monthScanProgress?.filesFound > 0 && (
                                            <span className="text-sky-500">{monthScanProgress.filesFound} files</span>
                                          )}
                                        </div>
                                      ) : hasData ? (
                                        <div className="text-[9px] font-semibold text-amber-600">Has data</div>
                                      ) : isCleaned ? (
                                        <div className="text-[9px] font-semibold text-emerald-500">Clean</div>
                                      ) : (
                                        <div className="text-[9px] text-slate-400">Pending</div>
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
  const hasData = !noCity && !!scanResult && wardList.length > 0
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
          {scanResult?.totalFiles > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-600">{scanResult.totalFiles.toLocaleString()} files</span>
          )}
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
          {scanResult?.scannedAt && !autoDeleteRunning && (
            <span className="text-[9px] text-slate-400">{timeAgo(scanResult.scannedAt)}</span>
          )}
          {autoDeleteRunning ? (
            autoDeleteStopping ? (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-200">
                <Loader2 size={12} className="animate-spin" /> Stopping...
              </span>
            ) : (
              <button onClick={stopAutoDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-red-500 text-white hover:bg-red-600 shadow-sm cursor-pointer">
                <X size={12} /> Stop
              </button>
            )
          ) : (
            scanResult?.totalFiles > 0 && (
              <button onClick={handleDeleteAll} disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer bg-red-500 text-white hover:bg-red-600 shadow-sm disabled:opacity-50">
                <Trash2 size={12} /> Delete All Data
              </button>
            )
          )}
          <button
            disabled={autoDeleteRunning}
            onClick={() => { setShowCityDrawer(true); if (!drawerSelectedCity && includedCities.length > 0) setDrawerSelectedCity(includedCities[0]) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer bg-slate-50 text-slate-600 border border-slate-200 hover:bg-teal-50 hover:text-teal-600 hover:border-teal-200 disabled:opacity-40 disabled:cursor-not-allowed">
            <Settings2 size={12} /> City Setting
          </button>
        </div>
      </div>

      {/* Auto delete progress bar */}
      {autoDeleteRunning && autoDeleteProgress && (
        <div className="px-4 py-2 bg-amber-50/60 border-b border-amber-200 flex items-center gap-3">
          <Loader2 size={13} className="animate-spin text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-semibold text-amber-700">
              <span>Ward {autoDeleteProgress.wardIdx}/{autoDeleteProgress.totalWards}</span>
              {autoDeleteProgress.ward && (
                <>
                  <span className="text-amber-400">·</span>
                  <span>{autoDeleteProgress.ward}</span>
                  <span className="text-amber-400">·</span>
                  <span>{autoDeleteProgress.month} {autoDeleteProgress.year}</span>
                </>
              )}
            </div>
            <div className="h-1 bg-amber-100 rounded-full mt-1 overflow-hidden">
              <div className="h-full bg-amber-500 transition-all" style={{ width: `${(autoDeleteProgress.wardIdx / Math.max(autoDeleteProgress.totalWards, 1)) * 100}%` }} />
            </div>
          </div>
          <div className="text-[10px] font-bold text-amber-600 shrink-0">
            {autoDeleteProgress.deleted.toLocaleString()} deleted
            {autoDeleteProgress.failed > 0 && <span className="text-red-500 ml-2">{autoDeleteProgress.failed} failed</span>}
          </div>
        </div>
      )}

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
        {/* Ward sidebar */}
        <div className="w-[130px] shrink-0 border-r border-slate-100 bg-slate-50/50 flex flex-col">
          <div className="px-3 py-2 border-b border-slate-100">
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Wards ({wardList.length})</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {wardList.map(ward => {
              const isSelected = selectedWard === ward
              const wardFiles = scanResult?.wards?.[ward]?.totalFiles || 0
              return (
                <button
                  key={ward}
                  onClick={() => { setSelectedWard(ward); setSelectedYearMonth(getFirstYearMonth(scanResult, ward)); setSelectedFiles(new Set()) }}
                  className={`w-full px-3 py-2 text-left transition-all cursor-pointer border-l-2 ${
                    isSelected
                      ? 'bg-white border-l-teal-500 text-teal-700'
                      : 'border-l-transparent text-slate-500 hover:bg-white/80 hover:text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-[10px] truncate ${isSelected ? 'font-bold' : 'font-medium'}`}>{ward}</span>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${isSelected ? 'bg-teal-500 text-white' : 'bg-teal-100 text-teal-600'}`}>{wardFiles}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {!selectedWard ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <span className="text-[11px] text-slate-400">Select a ward</span>
            </div>
          ) : (
            <>
              {/* Year/Month pills */}
              <div className="px-4 py-2.5 border-b border-slate-100 bg-white">
                <div className="flex items-center gap-2 flex-wrap">
                  {yearMonthList.map(ym => {
                    const isActive = selectedYearMonth === ym.key
                    return (
                      <button key={ym.key} onClick={() => { setSelectedYearMonth(selectedYearMonth === ym.key ? null : ym.key); setSelectedFiles(new Set()) }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-teal-500 text-white shadow-sm'
                            : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-teal-50 hover:text-teal-600'
                        }`}>
                        {ym.month} {ym.year}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Action bar */}
              {selectedYearMonth && allFiles.length > 0 && (
                <div className="px-4 py-1.5 border-b border-slate-100 bg-white flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-medium">{allFiles.length} files</span>
                  {selectedFiles.size > 0 && (
                    <button onClick={handleDeleteSelected} disabled={deleting}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer bg-red-500 text-white hover:bg-red-600 shadow-sm disabled:opacity-50">
                      {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      {deleting ? 'Deleting...' : `Delete ${selectedFiles.size} files`}
                    </button>
                  )}
                  <div className="ml-auto">
                    <button onClick={() => { if (selectedFiles.size === allFiles.length) setSelectedFiles(new Set()); else setSelectedFiles(new Set(allFiles)) }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                        selectedFiles.size === allFiles.length && allFiles.length > 0
                          ? 'bg-teal-500 text-white'
                          : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-teal-50'
                      }`}>
                      {selectedFiles.size === allFiles.length && allFiles.length > 0 ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                </div>
              )}

              {/* Date list */}
              <div className="flex-1 overflow-y-auto p-4 bg-slate-50/30">
                {!selectedYearMonth ? (
                  <div className="flex items-center justify-center h-32 text-slate-400 text-[11px]">Select a month above</div>
                ) : dateList.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-slate-400 text-[11px]">No dates found</div>
                ) : (
                  <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
                    {dateList.map(([date, files]) => {
                      const allChecked = files.length > 0 && files.every(f => selectedFiles.has(f))
                      const someChecked = files.some(f => selectedFiles.has(f))
                      return (
                        <div key={date}
                          onClick={() => {
                            setSelectedFiles(prev => {
                              const next = new Set(prev)
                              if (allChecked) files.forEach(f => next.delete(f))
                              else files.forEach(f => next.add(f))
                              return next
                            })
                          }}
                          className={`rounded-xl border p-3 text-center transition-all cursor-pointer ${
                            allChecked
                              ? 'border-teal-400 bg-teal-50 shadow-sm'
                              : someChecked
                                ? 'border-teal-200 bg-teal-50/30 hover:shadow-sm'
                                : 'border-slate-200 bg-white hover:shadow-sm'
                          }`}>
                          <Calendar size={14} className={`mx-auto mb-1 ${allChecked ? 'text-teal-500' : 'text-teal-400'}`} />
                          <span className="text-[10px] font-bold text-slate-700 block">{date.split('-').slice(1).join('-')}</span>
                          <span className={`text-[8px] font-semibold ${allChecked ? 'text-teal-500' : 'text-slate-400'}`}>{files.length} files</span>
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
