import { useState, useEffect, useRef } from 'react'
import { Loader2, FileImage, Search, RefreshCw, Calendar, Trash2, X, Clock, Settings2, Check, MapPin, ClipboardList } from 'lucide-react'
import { deleteStorageFiles, listAttendanceMonths, scanAttendanceCleanup, saveAttendanceScanResult, loadAttendanceScanResult, resolveCommonCities, loadAttendanceCities, saveAttendanceCities } from '../../lib/firebase'
import { MONTH_ORDER, formatSize } from './utils'

export default function AttendanceSection() {
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

  const [selectedMonth, setSelectedMonth] = useState(null)
  const [selectedEmployee, setSelectedEmployee] = useState(null)

  const [allDateFiles, setAllDateFiles] = useState({})
  const [selectedFiles, setSelectedFiles] = useState(new Set())
  const [deleting, setDeleting] = useState(false)

  const [showCityDrawer, setShowCityDrawer] = useState(false)
  const [showAvailableCities, setShowAvailableCities] = useState(false)
  const [drawerSelectedCity, setDrawerSelectedCity] = useState(null)
  const [drawerMonths, setDrawerMonths] = useState([])
  const [drawerScanData, setDrawerScanData] = useState(null)
  const [loadingDrawerMonths, setLoadingDrawerMonths] = useState(false)
  const [scanningMonth, setScanningMonth] = useState(null)
  const [monthScanProgress, setMonthScanProgress] = useState(null)
  const [monthScanElapsed, setMonthScanElapsed] = useState(0)
  const monthTimerRef = useRef(null)
  const [scanAllRunning, setScanAllRunning] = useState(false)
  const [scanAllStopping, setScanAllStopping] = useState(false)
  const [resettingMonth, setResettingMonth] = useState(null)
  const stopScanAllRef = useRef(false)

  useEffect(() => {
    loadAttendanceCities().then(async (config) => {
      if (config.included.length > 0) {
        setIncludedCities(config.included)
        setMainPageCities(config.mainPage)
        const firstCity = config.mainPage[0] || config.included[0]
        if (firstCity) {
          setSelectedCity(firstCity)
          const cached = await loadAttendanceScanResult(firstCity)
          if (cached) {
            setScanResult(cached)
            const firstMonth = Object.entries(cached.months || {}).filter(([, m]) => (m.totalFiles || 0) > 0).map(([k]) => k).sort((a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b))[0]
            if (firstMonth) setSelectedMonth(firstMonth)
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
    await saveAttendanceCities(included, mainPage)
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

  useEffect(() => {
    if (!drawerSelectedCity) { setDrawerMonths([]); setDrawerScanData(null); return }
    setLoadingDrawerMonths(true)
    Promise.all([
      listAttendanceMonths(drawerSelectedCity),
      loadAttendanceScanResult(drawerSelectedCity),
    ]).then(([months, scanData]) => {
      setDrawerMonths(months || [])
      setDrawerScanData(scanData || null)
    }).catch(() => { setDrawerMonths([]); setDrawerScanData(null) })
      .finally(() => setLoadingDrawerMonths(false))
  }, [drawerSelectedCity])

  // Main page derived data
  const monthList = scanResult
    ? Object.entries(scanResult.months).filter(([, m]) => (m.totalFiles || 0) > 0).map(([k]) => k).sort((a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b))
    : []

  const employeeList = (scanResult && selectedMonth && scanResult.months[selectedMonth]?.employees)
    ? Object.entries(scanResult.months[selectedMonth].employees)
        .filter(([, e]) => (e.totalFiles || 0) > 0)
        .map(([id, data]) => ({ id, totalFiles: data.totalFiles }))
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
    : []

  const dateList = (scanResult && selectedMonth && selectedEmployee &&
    scanResult.months[selectedMonth]?.employees[selectedEmployee]?.dates)
    ? Object.entries(scanResult.months[selectedMonth].employees[selectedEmployee].dates)
        .sort(([a], [b]) => a.localeCompare(b))
    : []

  const allFiles = Object.values(allDateFiles).flat()

  function formatElapsed(seconds) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}h ${m}m ${s}s`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  const handleSingleMonthScan = async (city, month) => {
    setScanningMonth(month)
    setMonthScanProgress(null)
    setMonthScanElapsed(0)
    monthTimerRef.current = setInterval(() => setMonthScanElapsed(t => t + 1), 1000)
    try {
      const result = await scanAttendanceCleanup(city, [month], (progress) => {
        setMonthScanProgress(progress)
      })
      if (city === selectedCity) {
        setScanResult(result)
        const firstMonth = Object.entries(result.months || {}).filter(([, m]) => (m.totalFiles || 0) > 0).map(([k]) => k).sort((a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b))[0]
        if (firstMonth && !selectedMonth) setSelectedMonth(firstMonth)
      }
      setDrawerScanData(prev => {
        const next = prev ? JSON.parse(JSON.stringify(prev)) : { months: {} }
        next.months[month] = result?.months?.[month] || { totalFiles: 0, totalSize: 0, employees: {} }
        return next
      })
    } catch {
      alert('Scan failed. Please try again.')
    }
    clearInterval(monthTimerRef.current)
    setScanningMonth(null)
    setMonthScanProgress(null)
  }

  const handleScanAll = async () => {
    const city = drawerSelectedCity
    if (!city || drawerMonths.length === 0) return
    setScanAllRunning(true)
    setScanAllStopping(false)
    stopScanAllRef.current = false

    for (const month of drawerMonths) {
      if (stopScanAllRef.current) break
      if (drawerScanData?.months?.[month]) continue

      setScanningMonth(month)
      setMonthScanProgress(null)
      setMonthScanElapsed(0)
      monthTimerRef.current = setInterval(() => setMonthScanElapsed(t => t + 1), 1000)

      try {
        const result = await scanAttendanceCleanup(city, [month], (progress) => {
          setMonthScanProgress(progress)
        })
        if (city === selectedCity) {
          setScanResult(result)
          const firstM = Object.entries(result.months || {}).filter(([, m]) => (m.totalFiles || 0) > 0).map(([k]) => k).sort((a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b))[0]
          if (firstM && !selectedMonth) setSelectedMonth(firstM)
        }
        setDrawerScanData(prev => {
          const next = prev ? JSON.parse(JSON.stringify(prev)) : { months: {} }
          next.months[month] = result?.months?.[month] || { totalFiles: 0, totalSize: 0, employees: {} }
          return next
        })
      } catch {
        // skip failed month
      }

      clearInterval(monthTimerRef.current)
      setScanningMonth(null)
      setMonthScanProgress(null)
    }

    setScanAllRunning(false)
    setScanAllStopping(false)
    stopScanAllRef.current = false
  }

  const stopScanAll = () => {
    stopScanAllRef.current = true
    setScanAllStopping(true)
  }

  const handleDeleteSelected = async () => {
    if (selectedFiles.size === 0) return
    setDeleting(true)
    try {
      const { deleted, failed } = await deleteStorageFiles([...selectedFiles])
      const failedSet = new Set(failed)

      setAllDateFiles(prev => {
        const next = {}
        for (const [date, files] of Object.entries(prev)) {
          next[date] = files.filter(f => !selectedFiles.has(f.fullPath) || failedSet.has(f.fullPath))
        }
        return next
      })
      setSelectedFiles(new Set(failed))

      if (scanResult && selectedMonth && selectedEmployee && deleted > 0) {
        const next = JSON.parse(JSON.stringify(scanResult))
        const empData = next.months[selectedMonth]?.employees[selectedEmployee]
        if (empData) {
          const deletedPaths = new Set([...selectedFiles].filter(p => !failedSet.has(p)))
          for (const [date, files] of Object.entries(empData.dates || {})) {
            empData.dates[date] = files.filter(f => !deletedPaths.has(f.fullPath))
            if (!empData.dates[date].length) delete empData.dates[date]
          }
          const empFiles = Object.values(empData.dates || {}).flat()
          empData.totalFiles = empFiles.length
          empData.totalSize = empFiles.reduce((s, f) => s + (f.size || 0), 0)

          const monthData = next.months[selectedMonth]
          if (monthData) {
            monthData.totalFiles = Object.values(monthData.employees || {}).reduce((s, e) => s + e.totalFiles, 0)
            monthData.totalSize = Object.values(monthData.employees || {}).reduce((s, e) => s + (e.totalSize || 0), 0)
          }
          next.totalFiles = Object.values(next.months || {}).reduce((s, m) => s + m.totalFiles, 0)
          next.totalSize = Object.values(next.months || {}).reduce((s, m) => s + (m.totalSize || 0), 0)
        }
        setScanResult(next)
        if (selectedCity === drawerSelectedCity) setDrawerScanData(next)
        saveAttendanceScanResult(selectedCity, next).catch(() => {})

        // Auto-select next employee/month
        const empStillHasData = next.months[selectedMonth]?.employees[selectedEmployee]?.totalFiles > 0
        if (!empStillHasData) {
          const nextEmp = Object.entries(next.months[selectedMonth]?.employees || {}).filter(([, e]) => (e.totalFiles || 0) > 0).map(([k]) => k).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0]
          if (nextEmp) {
            setSelectedEmployee(nextEmp)
          } else {
            // Month empty — next month
            const nextMonth = Object.entries(next.months || {}).filter(([, m]) => (m.totalFiles || 0) > 0).map(([k]) => k).sort((a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b))[0]
            setSelectedMonth(nextMonth || null)
            setSelectedEmployee(null)
          }
          setAllDateFiles({})
        }
      }

      if (failed.length > 0) alert(`${deleted} file(s) deleted. ${failed.length} file(s) failed.`)
    } catch {
      alert('Failed to delete files. Please try again.')
    }
    setDeleting(false)
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

  useEffect(() => {
    if (!selectedCity) { setLoadingScanResult(false); return }
    if (!initialLoadDone.current) return
    setLoadingScanResult(true)
    setScanResult(null)
    setSelectedMonth(null)
    setSelectedEmployee(null)
    setAllDateFiles({})
    loadAttendanceScanResult(selectedCity).then(cached => {
      if (cached) {
        setScanResult(cached)
        const firstMonth = Object.entries(cached.months || {}).filter(([, m]) => (m.totalFiles || 0) > 0).map(([k]) => k).sort((a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b))[0]
        if (firstMonth) setSelectedMonth(firstMonth)
      }
    }).finally(() => setLoadingScanResult(false))
  }, [selectedCity])

  useEffect(() => {
    if (employeeList.length > 0 && !employeeList.find(e => e.id === selectedEmployee)) {
      setSelectedEmployee(employeeList[0].id)
    }
  }, [selectedMonth, employeeList.length])

  useEffect(() => {
    if (!selectedCity || !selectedMonth || !selectedEmployee || !scanResult) {
      setAllDateFiles({})
      return
    }
    setSelectedFiles(new Set())
    const empData = scanResult.months[selectedMonth]?.employees[selectedEmployee]
    if (!empData?.dates) { setAllDateFiles({}); return }
    const map = {}
    for (const [date, files] of Object.entries(empData.dates)) {
      map[date] = Array.isArray(files) ? files : []
    }
    setAllDateFiles(map)
  }, [selectedCity, selectedMonth, selectedEmployee, scanResult])

  // ── Drawer ──
  const renderCityDrawer = () => {
    const drawerCityIsOnMainPage = drawerSelectedCity ? mainPageCities.includes(drawerSelectedCity) : false
    const scannedCount = drawerScanData?.months ? Object.keys(drawerScanData.months).length : 0
    const cleanedCount = drawerScanData?.months ? Object.values(drawerScanData.months).filter(m => (m.totalFiles || 0) === 0).length : 0
    const hasDataCount = scannedCount - cleanedCount

    return (
    <>
      <div className={`fixed inset-0 z-50 transition-opacity duration-200 ${showCityDrawer ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={() => !scanningMonth && setShowCityDrawer(false)} />
        <div className={`absolute top-0 right-0 h-full w-[55vw] bg-gradient-to-b from-white to-slate-50/80 shadow-2xl transition-transform duration-300 ease-out flex flex-col ${showCityDrawer ? 'translate-x-0' : 'translate-x-full'}`}>

          <div className="px-5 py-3.5 border-b border-slate-100 bg-white flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm">
              <Settings2 size={14} className="text-white" />
            </div>
            <h3 className="text-[13px] font-bold text-slate-800 flex-1">City Setting</h3>
            <button disabled={!!scanningMonth} onClick={() => setShowAvailableCities(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200/80 hover:bg-amber-100 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
              <span className="text-sm leading-none">+</span> Add City
            </button>
            {savingCities && <Loader2 size={14} className="animate-spin text-amber-400" />}
            <button disabled={!!scanningMonth} onClick={() => !scanningMonth && setShowCityDrawer(false)}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${scanningMonth ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-100 cursor-pointer'}`}>
              <X size={15} className="text-slate-400" />
            </button>
          </div>

          <div className="flex flex-1 min-h-0">
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
                      <button key={city} disabled={!!scanningMonth}
                        onClick={() => !scanningMonth && setDrawerSelectedCity(city)}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-all border-l-2 ${
                          scanningMonth ? (isSelected ? 'bg-amber-50/80 border-l-amber-500 text-amber-700 cursor-not-allowed' : 'border-l-transparent text-slate-400 cursor-not-allowed opacity-50')
                            : isSelected ? 'bg-amber-50/80 border-l-amber-500 text-amber-700 cursor-pointer' : 'border-l-transparent hover:bg-slate-50 text-slate-600 cursor-pointer'
                        }`}>
                        <span className={`text-[11px] flex-1 truncate ${isSelected ? 'font-bold' : 'font-medium'}`}>{city}</span>
                        {isOnPage && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                      </button>
                    )
                  })
                )}
              </div>
            </div>

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
                  <div className="px-5 py-3 border-b border-slate-100 bg-white">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[14px] font-bold text-slate-800 flex-1">{drawerSelectedCity}</h3>
                      <button disabled={savingCities} onClick={() => toggleMainPage(drawerSelectedCity)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer disabled:opacity-50 ${
                          drawerCityIsOnMainPage ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20 hover:bg-emerald-600' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200'
                        }`}>
                        {drawerCityIsOnMainPage ? '✓ On Page' : 'Show on Page'}
                      </button>
                      {!drawerCityIsOnMainPage && (
                        <button disabled={savingCities} onClick={() => { removeCity(drawerSelectedCity); setDrawerSelectedCity(null) }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer disabled:opacity-50 text-red-400 border border-red-200/80 hover:bg-red-50 hover:text-red-600">
                          <X size={11} /> Remove
                        </button>
                      )}
                    </div>
                    {drawerMonths.length > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden flex">
                            {cleanedCount > 0 && <div className="h-full bg-emerald-400 transition-all" style={{ width: `${(cleanedCount / drawerMonths.length) * 100}%` }} />}
                            {hasDataCount > 0 && <div className="h-full bg-amber-400 transition-all" style={{ width: `${(hasDataCount / drawerMonths.length) * 100}%` }} />}
                          </div>
                          <span className="text-[9px] text-slate-400 font-medium shrink-0">{scannedCount}/{drawerMonths.length}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5 text-[9px]"><span className="w-2.5 h-2.5 rounded bg-emerald-400 shrink-0" /><span className="text-slate-500">{cleanedCount} Cleaned</span></div>
                          <div className="flex items-center gap-1.5 text-[9px]"><span className="w-2.5 h-2.5 rounded bg-amber-400 shrink-0" /><span className="text-slate-500">{hasDataCount} Has Data</span></div>
                          <div className="flex items-center gap-1.5 text-[9px]"><span className="w-2.5 h-2.5 rounded bg-slate-200 shrink-0" /><span className="text-slate-400">{drawerMonths.length - scannedCount} Pending</span></div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="px-5 py-2 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500">Months</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200/60 text-slate-500 font-semibold">{drawerMonths.length}</span>
                      {drawerScanData?.months && scannedCount > 0 && !scanAllRunning && (
                        <button onClick={() => {
                          if (!window.confirm(`Reset scan data for ${drawerSelectedCity}?`)) return
                          setDrawerScanData(null)
                          saveAttendanceScanResult(drawerSelectedCity, { city: drawerSelectedCity, scannedAt: new Date().toISOString(), totalFiles: 0, totalSize: 0, months: {} })
                          if (drawerSelectedCity === selectedCity) setScanResult(null)
                        }} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-semibold text-red-400 hover:bg-red-50 border border-red-200/60 transition-all cursor-pointer">
                          <RefreshCw size={8} /> Reset All
                        </button>
                      )}
                    </div>
                    {scanAllRunning ? (
                      scanAllStopping ? (
                        <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">Stopping after {scanningMonth}...</span>
                      ) : (
                        <button onClick={stopScanAll} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-semibold bg-red-500 text-white hover:bg-red-600 transition-all cursor-pointer shadow-sm">
                          <X size={10} /> Stop Scanning
                        </button>
                      )
                    ) : (
                      <button disabled={!!scanningMonth} onClick={handleScanAll}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-all cursor-pointer disabled:opacity-30 shadow-sm">
                        <Search size={10} /> Start Scan
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {loadingDrawerMonths ? (
                      <div className="flex items-center justify-center py-12 gap-2"><Loader2 size={16} className="animate-spin text-amber-400" /><span className="text-xs text-text-muted">Loading months...</span></div>
                    ) : drawerMonths.length === 0 ? (
                      <div className="text-center py-12 text-xs text-text-muted">No months found</div>
                    ) : (
                      <div className="grid grid-cols-4 gap-2 p-3">
                        {drawerMonths.map((month) => {
                          const monthData = drawerScanData?.months?.[month]
                          const isScanned = !!monthData
                          const isCleaned = isScanned && (monthData.totalFiles || 0) === 0
                          const hasData = isScanned && (monthData.totalFiles || 0) > 0
                          const isThisScanning = scanningMonth === month
                          return (
                            <div key={month} className={`relative rounded-xl border p-3 transition-all ${
                              isThisScanning ? 'border-amber-300 bg-amber-50 shadow-sm' : isCleaned ? 'border-emerald-200 bg-emerald-50/40' : hasData ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200 bg-white hover:shadow-sm'
                            }`}>
                              {!isThisScanning && isScanned && !scanningMonth && (
                                resettingMonth === month ? (
                                  <div className="absolute top-1.5 right-1.5"><Loader2 size={10} className="animate-spin text-amber-500" /></div>
                                ) : (
                                  <button disabled={!!resettingMonth} onClick={async () => {
                                    setResettingMonth(month)
                                    const result = await loadAttendanceScanResult(drawerSelectedCity)
                                    if (result?.months?.[month]) {
                                      delete result.months[month]
                                      result.totalFiles = Object.values(result.months).reduce((s, m) => s + m.totalFiles, 0)
                                      await saveAttendanceScanResult(drawerSelectedCity, result)
                                      if (drawerSelectedCity === selectedCity) setScanResult(result)
                                    }
                                    setDrawerScanData(prev => {
                                      if (!prev) return prev
                                      const next = JSON.parse(JSON.stringify(prev))
                                      delete next.months[month]
                                      return next
                                    })
                                    setResettingMonth(null)
                                  }} className="absolute top-1.5 right-1.5 text-[7px] font-semibold text-slate-300 hover:text-red-500 transition-colors cursor-pointer disabled:opacity-30">✕</button>
                                )
                              )}
                              <div className="flex items-center gap-1.5 mb-2">
                                {isThisScanning ? <Loader2 size={11} className="animate-spin text-amber-500 shrink-0" />
                                  : isCleaned ? <Check size={11} className="text-emerald-500 shrink-0" strokeWidth={3} />
                                  : hasData ? <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                                  : <span className="w-2 h-2 rounded-full bg-slate-200 shrink-0" />}
                                <span className={`text-[11px] font-bold truncate ${isThisScanning ? 'text-amber-700' : isCleaned ? 'text-emerald-600' : hasData ? 'text-slate-700' : 'text-slate-400'}`}>{month}</span>
                              </div>
                              {isThisScanning ? (
                                <div className="flex items-center gap-2 text-[8px] flex-wrap">
                                  <span className="font-semibold text-amber-600">{formatElapsed(monthScanElapsed)}</span>
                                  {monthScanProgress?.filesFound > 0 && <span className="font-bold text-emerald-600">{monthScanProgress.filesFound} · {formatSize(monthScanProgress.totalSize || 0)}</span>}
                                  {monthScanProgress?.hits > 0 && <span className="text-sky-500">{monthScanProgress.hits} hits</span>}
                                </div>
                              ) : hasData ? (
                                <div className="text-[9px] font-semibold text-amber-600">{monthData.totalFiles} files · {formatSize(monthData.totalSize || 0)}</div>
                              ) : isCleaned ? (
                                <div className="text-[9px] font-semibold text-emerald-500">Cleaned ✓</div>
                              ) : (
                                <div className="text-[9px] text-slate-400">Pending</div>
                              )}
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

          {showAvailableCities && (
            <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
              <div className="absolute inset-0 bg-black/20" onClick={() => setShowAvailableCities(false)} />
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col animate-[slideUp_0.2s_ease-out]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-surface-lighter">
                  <h4 className="text-sm font-bold text-text">Available Cities ({availableCities.length})</h4>
                  <button onClick={() => setShowAvailableCities(false)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"><X size={16} className="text-gray-400" /></button>
                </div>
                <div className="p-3 overflow-y-auto flex-1">
                  {availableCities.length === 0 ? (
                    <p className="text-xs text-text-muted text-center py-4">All cities already included</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {availableCities.map(city => (
                        <button key={city} disabled={savingCities} onClick={() => addCity(city)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer disabled:opacity-50 bg-surface-light text-slate-500 border border-slate-200 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200">
                          <span className="text-amber-400 text-xs">+</span>
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
  const hasData = !noCity && !!scanResult
  const noData = !noCity && !scanResult

  return (
    <>
    <div className="h-full p-[1px] rounded-xl relative overflow-hidden" style={{
      background: 'conic-gradient(from var(--border-angle, 0deg), #f59e0b, #f97316, #ef4444, #f59e0b)',
      animation: 'spin-border 3s linear infinite'
    }}>
    <style>{`@keyframes spin-border { to { --border-angle: 360deg; } } @property --border-angle { syntax: "<angle>"; initial-value: 0deg; inherits: false; }`}</style>
    <div className="flex flex-col h-full rounded-[10px] overflow-hidden bg-white">
      <div className="flex items-center px-4 py-2 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <ClipboardList size={13} className="text-white" />
          </div>
          <h3 className="text-[13px] font-bold text-slate-800">Attendance</h3>
          {hasData && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200/60">
              <span className="text-[10px] font-bold text-amber-600">{scanResult.totalFiles}</span>
              <span className="text-[9px] text-amber-400">files</span>
              <span className="text-[9px] text-amber-300">·</span>
              <span className="text-[10px] font-semibold text-amber-500">{formatSize(scanResult.totalSize || 0)}</span>
            </div>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center gap-1.5 mx-4">
          {mainPageCities.map(city => (
            <button key={city} onClick={() => setSelectedCity(city)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCity === city ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200'
              }`}>
              {city}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasData && scanResult.scannedAt && (
            <span className="text-[9px] text-slate-400 flex items-center gap-1"><Clock size={10} />{timeAgo(scanResult.scannedAt)}</span>
          )}
          <button onClick={() => { setShowCityDrawer(true); if (!drawerSelectedCity && includedCities.length > 0) setDrawerSelectedCity(includedCities[0]) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer bg-slate-50 text-slate-600 border border-slate-200 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200">
            <Settings2 size={12} /> City Setting
          </button>
        </div>
      </div>

      {noCity ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center border border-slate-200/50">
            <Settings2 size={26} className="text-slate-300" />
          </div>
          <div className="text-center">
            <h3 className="text-sm font-bold text-slate-700 mb-1">No city on page</h3>
            <p className="text-[11px] text-slate-400 max-w-xs">Open <button onClick={() => { setShowCityDrawer(true); if (!drawerSelectedCity && includedCities.length > 0) setDrawerSelectedCity(includedCities[0]) }} className="font-bold text-amber-500 hover:text-amber-600 cursor-pointer underline underline-offset-2">City Setting</button> and mark cities as "Show on Page"</p>
          </div>
        </div>
      ) : noData ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center border border-amber-200/50">
            <Search size={26} className="text-amber-300" />
          </div>
          <div className="text-center">
            <h3 className="text-sm font-bold text-slate-700 mb-1">{selectedCity ? `No scan data for ${selectedCity}` : 'No Scan Data'}</h3>
            <p className="text-[11px] text-slate-400 max-w-xs">Open <button onClick={() => { setShowCityDrawer(true); setDrawerSelectedCity(selectedCity) }} className="font-bold text-amber-500 hover:text-amber-600 cursor-pointer underline underline-offset-2">City Setting</button> → select months → Start Scan</p>
          </div>
        </div>
      ) : (
      <div className="flex flex-1 min-h-0">
        {/* Month + Employee sidebar */}
        <div className="w-[100px] shrink-0 border-r border-slate-100 bg-slate-50/50 flex flex-col">
          <div className="px-3 py-2 border-b border-slate-100">
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Months</span>
          </div>
          <div className="overflow-y-auto border-b border-slate-100">
            {monthList.map(month => (
              <button key={month} onClick={() => { setSelectedMonth(month); setSelectedEmployee(null); setAllDateFiles({}) }}
                className={`w-full px-3 py-2 text-left transition-all cursor-pointer border-l-2 ${
                  selectedMonth === month ? 'bg-white border-l-amber-500 text-amber-700' : 'border-l-transparent text-slate-500 hover:bg-white/80'
                }`}>
                <span className={`text-[10px] block ${selectedMonth === month ? 'font-bold' : 'font-medium'}`}>{month}</span>
              </button>
            ))}
          </div>
          {selectedMonth && (
            <>
              <div className="px-3 py-2 border-b border-slate-100">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Employees</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {employeeList.map(emp => (
                  <button key={emp.id} onClick={() => { setSelectedEmployee(emp.id); setAllDateFiles({}) }}
                    className={`w-full px-3 py-1.5 text-left transition-all cursor-pointer border-l-2 ${
                      selectedEmployee === emp.id ? 'bg-white border-l-amber-500 text-amber-700' : 'border-l-transparent text-slate-500 hover:bg-white/80'
                    }`}>
                    <span className={`text-[10px] block truncate ${selectedEmployee === emp.id ? 'font-bold' : 'font-medium'}`}>{emp.id}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {!selectedMonth ? (
            <div className="flex items-center justify-center h-full"><span className="text-[11px] text-slate-400">← Select a month</span></div>
          ) : !selectedEmployee ? (
            <div className="flex items-center justify-center h-full"><span className="text-[11px] text-slate-400">← Select an employee</span></div>
          ) : (
            <>
              <div className="px-4 py-2.5 border-b border-slate-100 bg-white">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-slate-700">Employee {selectedEmployee}</span>
                  {Object.keys(allDateFiles).length > 0 && (
                    <span className="text-[9px] text-slate-400 font-medium">· {allFiles.length} files · {formatSize(allFiles.reduce((s, f) => s + (f.size || 0), 0))}</span>
                  )}
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
                          selectedFiles.size === allFiles.length && allFiles.length > 0 ? 'bg-amber-500 text-white' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-amber-50'
                        }`}>
                        {selectedFiles.size === allFiles.length && allFiles.length > 0 ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 bg-slate-50/30">
                {dateList.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-slate-400 text-[11px]">No dates found</div>
                ) : (
                  <div className="grid grid-cols-5 gap-2.5">
                    {dateList.map(([date]) => {
                      const files = allDateFiles[date] || []
                      const allChecked = files.length > 0 && files.every(f => selectedFiles.has(f.fullPath))
                      return (
                        <div key={date} className={`rounded-xl border overflow-hidden transition-all ${allChecked ? 'border-amber-300 bg-amber-50/30 shadow-sm' : 'border-slate-200/80 bg-white hover:shadow-sm'}`}>
                          <div className="px-2.5 py-2 flex items-center justify-between bg-gradient-to-r from-slate-50 to-transparent">
                            <div className="flex items-center gap-1.5">
                              <Calendar size={11} className="text-slate-400" />
                              <span className="text-[10px] font-bold text-slate-700">{date}</span>
                            </div>
                            {files.length > 0 && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[8px] text-slate-400 font-medium">{formatSize(files.reduce((s, f) => s + (f.size || 0), 0))}</span>
                                <input type="checkbox" className="w-3.5 h-3.5 rounded accent-amber-500 cursor-pointer" checked={allChecked}
                                  onChange={(e) => { setSelectedFiles(prev => { const next = new Set(prev); files.forEach(f => { if (e.target.checked) next.add(f.fullPath); else next.delete(f.fullPath) }); return next }) }} />
                              </div>
                            )}
                          </div>
                          <div className="px-2 py-2">
                            {files.length === 0 ? (
                              <div className="text-center py-2 text-slate-300 text-[9px]">Empty</div>
                            ) : (
                              <div className="flex gap-1.5 overflow-x-auto justify-center">
                                {files.map(file => {
                                  const type = file.source === 'in' ? 'In' : file.source === 'out' ? 'Out' : '—'
                                  return (
                                    <div key={file.fullPath} className="flex-shrink-0 flex flex-col items-center justify-center gap-1 p-1.5 rounded-lg bg-slate-50 border border-slate-100 w-[55px] h-[45px]">
                                      <FileImage size={11} className="text-amber-400/60" />
                                      <span className="text-[7px] text-slate-400 font-medium">{type}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
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
