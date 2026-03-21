import { useState, useEffect, useRef } from 'react'
import { Loader2, FileImage, Search, RefreshCw, Calendar, Trash2, AlertTriangle, X, CheckSquare, Square, Clock } from 'lucide-react'
import { deleteStorageFiles, listSkipLineWards, scanSkipLineImages, saveSkipLineScanResult, loadSkipLineScanResult, loadSkipLineCityConfig } from '../../lib/firebase'
import { formatSize } from './utils'
import CitySelector from '../CitySelector'
import { getCachedSectionConfig, cacheSectionConfig } from '../../lib/sectionConfig'

export default function SkipLineSection() {
  // City selection
  const cached = getCachedSectionConfig('skipLine')
  const activeCities0 = cached.cities.filter(c => !cached.cleanedCities.includes(c))
  const [slCities, setSlCities] = useState(activeCities0)
  const [selectedCity, setSelectedCity] = useState(activeCities0[0] || null)

  useEffect(() => {
    const refresh = async () => {
      try {
        const remote = await loadSkipLineCityConfig()
        if (remote) {
          const active = remote.cities.filter(c => !remote.cleanedCities.includes(c))
          setSlCities(prev => JSON.stringify(prev) === JSON.stringify(active) ? prev : active)
          cacheSectionConfig('skipLine', remote.cities, remote.cleanedCities)
        }
      } catch (err) {
        console.warn('Could not load skip line cities:', err.message)
      }
    }
    refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])

  // Scan state
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(null)
  const [scanResult, setScanResult] = useState(null)
  const [loadingScanResult, setLoadingScanResult] = useState(true)

  // Navigation
  const [selectedWard, setSelectedWard] = useState(null)
  const [selectedYear, setSelectedYear] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(null)

  // Files from scanResult JSON (zero Firebase calls)
  const [allDateFiles, setAllDateFiles] = useState({})
  const [selectedFiles, setSelectedFiles] = useState(new Set())
  const [deleting, setDeleting] = useState(false)

  // Ward picker
  const [showRescanModal, setShowRescanModal] = useState(false)
  const [showWardPicker, setShowWardPicker] = useState(false)
  const [availableWards, setAvailableWards] = useState([])
  const [pickedWards, setPickedWards] = useState(new Set())
  const [loadingWards, setLoadingWards] = useState(false)

  // Timer
  const [elapsedTime, setElapsedTime] = useState(0)
  const timerRef = useRef(null)

  // Derived
  const wardList = scanResult
    ? Object.keys(scanResult.wards).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    : []

  const MONTH_ORDER = { January:1, February:2, March:3, April:4, May:5, June:6, July:7, August:8, September:9, October:10, November:11, December:12 }

  const yearMonthList = (() => {
    if (!scanResult || !selectedWard || !scanResult.wards[selectedWard]?.years) return []
    const list = []
    for (const [year, yearData] of Object.entries(scanResult.wards[selectedWard].years)) {
      for (const [month, monthData] of Object.entries(yearData.months)) {
        list.push({ year, month, totalFiles: monthData.totalFiles, key: `${year}-${month}` })
      }
    }
    return list.sort((a, b) => b.year.localeCompare(a.year) || (MONTH_ORDER[b.month] || 0) - (MONTH_ORDER[a.month] || 0))
  })()

  const selectedYearMonth = selectedYear && selectedMonth ? `${selectedYear}-${selectedMonth}` : null

  const dateList = (scanResult && selectedWard && selectedYear && selectedMonth &&
    scanResult.wards[selectedWard]?.years[selectedYear]?.months[selectedMonth]?.dates)
    ? Object.entries(scanResult.wards[selectedWard].years[selectedYear].months[selectedMonth].dates)
        .sort(([a], [b]) => a.localeCompare(b))
    : []

  const allFiles = Object.values(allDateFiles).flat()

  // ── Ward Picker ──

  const openWardPicker = async () => {
    setLoadingWards(true)
    setShowRescanModal(false)
    setShowWardPicker(true)
    setPickedWards(new Set())
    try {
      const folders = await listSkipLineWards(selectedCity)
      setAvailableWards(folders)
    } catch {
      setAvailableWards([])
    }
    setLoadingWards(false)
  }

  const toggleWard = (ward) => {
    setPickedWards(prev => {
      const next = new Set(prev)
      if (next.has(ward)) next.delete(ward)
      else if (next.size < 3) next.add(ward)
      return next
    })
  }

  const renderWardPicker = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={() => setShowWardPicker(false)} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-[slideUp_0.3s_ease-out]">
        <button onClick={() => setShowWardPicker(false)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
          <X size={18} className="text-gray-400" />
        </button>
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Select Wards to Scan</h3>
            <p className="text-xs text-gray-500">Choose up to <span className="font-semibold text-cyan-600">3 wards</span> at a time.</p>
          </div>
          {loadingWards ? (
            <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-cyan-500" /><span className="text-sm text-text-muted ml-2">Loading wards...</span></div>
          ) : availableWards.length === 0 ? (
            <div className="text-center py-8 text-sm text-text-muted">No wards found</div>
          ) : (
            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
              {availableWards.map(ward => {
                const isChecked = pickedWards.has(ward)
                const isDisabled = !isChecked && pickedWards.size >= 3
                return (
                  <button key={ward} onClick={() => !isDisabled && toggleWard(ward)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${isChecked ? 'bg-cyan-50' : isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'}`}>
                    {isChecked ? <CheckSquare size={18} className="text-cyan-500 shrink-0" /> : <Square size={18} className="text-gray-300 shrink-0" />}
                    <span className={`text-sm font-medium ${isChecked ? 'text-cyan-700' : 'text-gray-700'}`}>{ward}</span>
                  </button>
                )
              })}
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{pickedWards.size}/3 selected</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowWardPicker(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer">Cancel</button>
              <button onClick={() => handleScan([...pickedWards])} disabled={pickedWards.size === 0}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-cyan-500 hover:bg-cyan-600 transition-colors cursor-pointer shadow-lg shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed">
                Start Scan ({pickedWards.size})
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // ── Handlers ──

  function formatElapsed(seconds) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}h ${m}m ${s}s`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  const handleScan = async (wards) => {
    setShowWardPicker(false)
    setScanning(true)
    setScanProgress(null)
    setElapsedTime(0)
    timerRef.current = setInterval(() => setElapsedTime(t => t + 1), 1000)
    try {
      const result = await scanSkipLineImages(selectedCity, wards, (progress) => {
        setScanProgress(progress)
      })
      setScanResult(result)
      const firstWard = Object.keys(result.wards).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0]
      if (firstWard) setSelectedWard(firstWard)
    } catch {
      alert('Scan failed. Please try again.')
    }
    clearInterval(timerRef.current)
    setScanning(false)
  }

  const handleDeleteSelected = async () => {
    if (selectedFiles.size === 0) return
    const confirmed = window.confirm(`Are you sure you want to delete ${selectedFiles.size} file(s)? This action cannot be undone.`)
    if (!confirmed) return
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

      if (scanResult && selectedWard && selectedYear && selectedMonth && deleted > 0) {
        const next = JSON.parse(JSON.stringify(scanResult))
        const monthData = next.wards[selectedWard]?.years[selectedYear]?.months[selectedMonth]
        if (monthData) {
          const deletedPaths = new Set([...selectedFiles].filter(p => !failedSet.has(p)))
          for (const [date, dateData] of Object.entries(monthData.dates || {})) {
            if (dateData.filesMeta) {
              dateData.filesMeta = dateData.filesMeta.filter(f => !deletedPaths.has(f.fullPath))
            }
            dateData.files = dateData.filesMeta?.length || 0
            if (dateData.files <= 0) delete monthData.dates[date]
          }
          monthData.totalFiles = Object.values(monthData.dates || {}).reduce((s, d) => s + d.files, 0)
          if (monthData.totalFiles <= 0) delete next.wards[selectedWard].years[selectedYear].months[selectedMonth]

          const yearData = next.wards[selectedWard]?.years[selectedYear]
          if (yearData) {
            yearData.totalFiles = Object.values(yearData.months || {}).reduce((s, m) => s + m.totalFiles, 0)
            if (yearData.totalFiles <= 0) delete next.wards[selectedWard].years[selectedYear]
          }
          const wardData = next.wards[selectedWard]
          if (wardData) {
            wardData.totalFiles = Object.values(wardData.years || {}).reduce((s, y) => s + y.totalFiles, 0)
            if (wardData.totalFiles <= 0) delete next.wards[selectedWard]
          }
          next.totalFiles = Object.values(next.wards || {}).reduce((s, w) => s + w.totalFiles, 0)
        }
        setScanResult(next)
        saveSkipLineScanResult(selectedCity, next).catch(() => {})
      }

      if (failed.length > 0) {
        alert(`${deleted} file(s) deleted. ${failed.length} file(s) failed.`)
      }
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

  // ── Effects ──

  useEffect(() => {
    if (!selectedCity) { setLoadingScanResult(false); return }
    setLoadingScanResult(true)
    setScanResult(null)
    setSelectedWard(null)
    setSelectedYear(null)
    setSelectedMonth(null)
    setAllDateFiles({})
    loadSkipLineScanResult(selectedCity).then(cached => {
      if (cached) {
        setScanResult(cached)
        const firstWard = Object.keys(cached.wards || {}).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0]
        if (firstWard) setSelectedWard(firstWard)
      }
    }).finally(() => setLoadingScanResult(false))
  }, [selectedCity])

  // Auto-select first year-month when ward changes
  useEffect(() => {
    if (yearMonthList.length > 0 && !selectedYearMonth) {
      setSelectedYear(yearMonthList[0].year)
      setSelectedMonth(yearMonthList[0].month)
      setAllDateFiles({})
    }
  }, [selectedWard, yearMonthList.length])

  // Load files from scanResult JSON — zero Firebase calls
  useEffect(() => {
    if (!selectedCity || !selectedWard || !selectedYear || !selectedMonth || !scanResult) {
      setAllDateFiles({})
      return
    }
    setSelectedFiles(new Set())
    const monthData = scanResult.wards[selectedWard]?.years[selectedYear]?.months[selectedMonth]
    if (!monthData?.dates) {
      setAllDateFiles({})
      return
    }
    const map = {}
    for (const [date, dateData] of Object.entries(monthData.dates)) {
      map[date] = dateData.filesMeta || []
    }
    setAllDateFiles(map)
  }, [selectedCity, selectedWard, selectedYear, selectedMonth, scanResult])

  // ── Render ──

  if (loadingScanResult) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={20} className="animate-spin text-primary" />
      </div>
    )
  }

  if (!scanResult && !scanning) {
    return (
      <>
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <CitySelector cities={slCities} selectedCity={selectedCity} onSelect={setSelectedCity} compact />
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center">
          <Search size={28} className="text-cyan-500" />
        </div>
        <div className="text-center">
          <h3 className="text-sm font-semibold text-text mb-1">No Scan Data</h3>
          <p className="text-xs text-text-muted mb-1">Scan skip line folders to find old files for cleanup</p>
        </div>
        <button
          onClick={openWardPicker}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-cyan-500 text-white hover:bg-cyan-600 transition-all cursor-pointer shadow-sm"
        >
          <Search size={16} />
          Scan Skip Line
        </button>
      </div>
      {showWardPicker && renderWardPicker()}
      </>
    )
  }

  if (scanning) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 size={28} className="animate-spin text-cyan-500" />

        {scanProgress?.ward && (
          <div className="text-center">
            <span className="text-xs text-text-muted">Ward</span>
            <span className="text-sm font-bold text-cyan-600 ml-1.5">{scanProgress.ward}</span>
          </div>
        )}

        <div className="flex items-center gap-4 text-[11px]">
          <div className="flex items-center gap-1.5 text-text-muted">
            <Clock size={12} />
            <span className="font-semibold text-cyan-700">{formatElapsed(elapsedTime)}</span>
          </div>
          {scanProgress?.filesFound > 0 && (
            <span className="text-text-muted">
              <span className="font-bold text-emerald-600">{scanProgress.filesFound}</span> files
            </span>
          )}
          {scanProgress?.hits > 0 && (
            <span className="text-text-muted">
              <span className="font-bold text-sky-600">{scanProgress.hits}</span> API hits
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
    <div className="h-full p-[1px] rounded-xl relative overflow-hidden" style={{
      background: 'conic-gradient(from var(--border-angle, 0deg), #06b6d4, #14b8a6, #22d3ee, #06b6d4)',
      animation: 'spin-border 3s linear infinite'
    }}>
    <style>{`@keyframes spin-border { to { --border-angle: 360deg; } } @property --border-angle { syntax: "<angle>"; initial-value: 0deg; inherits: false; }`}</style>
    <div className="flex flex-col h-full rounded-[10px] overflow-hidden bg-white">
      {/* Top strip */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-lighter bg-surface">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text">Skip Line</h3>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 border border-cyan-500/20">
            {scanResult.totalFiles} files
          </span>
        </div>
        <div className="flex items-center gap-2">
          {scanResult.scannedAt && (
            <span className="text-[9px] text-text-muted">{timeAgo(scanResult.scannedAt)}</span>
          )}
          <button
            onClick={() => setShowRescanModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer bg-cyan-500/10 text-cyan-600 border border-cyan-500/20 hover:bg-cyan-500/20"
          >
            <RefreshCw size={12} />
            Re Scan
          </button>
          <div className="w-px h-5 bg-surface-lighter" />
          <CitySelector cities={slCities} selectedCity={selectedCity} onSelect={setSelectedCity} compact />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Ward list */}
        <div className="w-22 shrink-0 border-r border-surface-lighter flex flex-col bg-gray-100">
          <div className="flex-1 overflow-y-auto">
            {wardList.length === 0 ? (
              <div className="flex items-center justify-center h-full text-text-muted text-xs">No wards</div>
            ) : (
              <div className="flex flex-col">
                {wardList.map((ward, idx) => {
                  const isSelected = selectedWard === ward
                  return (
                    <div key={ward}>
                      {idx > 0 && <hr className="border-surface-lighter" />}
                      <button
                        onClick={() => { setSelectedWard(ward); setSelectedYear(null); setSelectedMonth(null); setAllDateFiles({}) }}
                        className={`w-full px-3 py-2.5 text-left transition-all cursor-pointer ${
                          isSelected ? 'bg-gray-200 border-r-2 border-gray-500' : 'hover:bg-gray-200/50'
                        }`}
                      >
                        <div className={`text-[11px] font-semibold truncate ${isSelected ? 'text-gray-800' : 'text-text'}`}>
                          {ward}
                        </div>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Content */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {!selectedWard ? (
            <div className="flex items-center justify-center h-full text-text-muted text-sm">Select a ward</div>
          ) : !scanResult.wards[selectedWard] ? (
            <div className="flex items-center justify-center h-full text-text-muted text-sm">No data for this ward</div>
          ) : (
            <>
              <div className="px-4 pt-3 space-y-3">
                {/* Year-Month pills */}
                <div className="flex items-center gap-2 flex-wrap">
                  {yearMonthList.map(ym => {
                    const isActive = selectedYearMonth === ym.key
                    return (
                      <button
                        key={ym.key}
                        onClick={() => { setSelectedYear(ym.year); setSelectedMonth(ym.month); setAllDateFiles({}) }}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                          isActive ? 'bg-primary text-white shadow-sm' : 'bg-primary/8 text-primary border border-primary/20 hover:bg-primary/15'
                        }`}
                      >
                        {ym.month} {ym.year} ({ym.totalFiles})
                      </button>
                    )
                  })}
                  {selectedMonth && Object.keys(allDateFiles).length > 0 && (
                    <span className="text-[9px] text-text-muted">
                      · {formatSize(allFiles.reduce((s, f) => s + (f.size || 0), 0))}
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 ml-auto">
                    {selectedFiles.size > 0 && (
                      <button
                        onClick={handleDeleteSelected}
                        disabled={deleting}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 disabled:opacity-50"
                      >
                        {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        {deleting ? 'Deleting...' : `Delete (${selectedFiles.size})`}
                      </button>
                    )}
                    {allFiles.length > 0 && (
                      <button
                        onClick={() => {
                          if (selectedFiles.size === allFiles.length) setSelectedFiles(new Set())
                          else setSelectedFiles(new Set(allFiles.map(f => f.fullPath)))
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                          selectedFiles.size === allFiles.length && allFiles.length > 0
                            ? 'bg-primary text-white'
                            : 'bg-surface border border-surface-lighter text-text-muted hover:border-primary/30'
                        }`}
                      >
                        {selectedFiles.size === allFiles.length && allFiles.length > 0 ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Date cards grid */}
              {selectedYear && selectedMonth ? (
                <div className="flex-1 overflow-y-auto mt-3 border-t border-surface-lighter p-4">
                  {dateList.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-text-muted text-xs">No dates found</div>
                  ) : (
                    <div className="grid grid-cols-5 gap-2">
                      {dateList.map(([date]) => {
                        const files = allDateFiles[date] || []
                        return (
                          <div key={date} className="rounded-[5px] border border-surface-lighter overflow-hidden">
                            <div className="px-2 py-1.5 flex items-center justify-between bg-gray-100">
                              <div className="flex items-center gap-1.5">
                                <Calendar size={12} className="text-gray-500" />
                                <span className="text-[10px] font-semibold text-gray-700">{date}</span>
                              </div>
                              {files.length > 0 && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[8px] text-gray-500">
                                    {formatSize(files.reduce((s, f) => s + (f.size || 0), 0))}
                                  </span>
                                  <input
                                    type="checkbox"
                                    className="w-3 h-3 rounded accent-primary cursor-pointer"
                                    checked={files.every(f => selectedFiles.has(f.fullPath))}
                                    onChange={(e) => {
                                      setSelectedFiles(prev => {
                                        const next = new Set(prev)
                                        files.forEach(f => {
                                          if (e.target.checked) next.add(f.fullPath)
                                          else next.delete(f.fullPath)
                                        })
                                        return next
                                      })
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                            <div className="p-2 bg-white">
                              {files.length === 0 ? (
                                <div className="text-center py-1 text-text-muted text-[9px]">No files</div>
                              ) : (
                                <div className="flex gap-1 overflow-x-auto justify-center">
                                  {files.map(file => (
                                    <div
                                      key={file.fullPath}
                                      className="flex-shrink-0 flex flex-col gap-0.5 p-1 rounded-md bg-surface-light/50 border border-surface-lighter hover:border-primary/30 transition-all group overflow-hidden"
                                    >
                                      {file.url ? (
                                        <img src={file.url} alt={file.name} className="w-[80px] h-[80px] object-cover rounded bg-surface" loading="lazy" />
                                      ) : (
                                        <div className="flex flex-col items-center justify-center w-[80px] h-[80px] bg-surface-light rounded">
                                          <FileImage size={12} className="text-primary/40 group-hover:text-primary/70 transition-colors" />
                                          <span className="text-[8px] text-text-muted mt-1">{formatSize(file.size)}</span>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
    </div>

    {/* Re-scan Confirmation Modal */}
    {showRescanModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={() => setShowRescanModal(false)} />
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-[slideUp_0.3s_ease-out]">
          <button onClick={() => setShowRescanModal(false)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
            <X size={18} className="text-gray-400" />
          </button>
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle size={28} className="text-amber-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Re-scan Confirmation</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                This scans <span className="font-semibold text-cyan-600">all folders</span> per ward.
                It can take <span className="font-semibold">significantly longer</span> for wards with many files.
              </p>
            </div>
            <div className="w-full bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
              <div className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <p className="text-xs text-amber-800 text-left">Each scan reads metadata of every file — <span className="font-semibold">increases API costs</span></p>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <p className="text-xs text-amber-800 text-left">Avoid scanning repeatedly — only re-scan when new data has been added</p>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <p className="text-xs text-amber-800 text-left">Selected wards will be replaced with fresh data, other wards stay intact</p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full pt-2">
              <button onClick={() => setShowRescanModal(false)} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer">
                Cancel
              </button>
              <button onClick={openWardPicker} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-cyan-500 hover:bg-cyan-600 transition-colors cursor-pointer shadow-lg shadow-cyan-500/25">
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {showWardPicker && renderWardPicker()}

    <style>{`
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
    `}</style>
    </>
  )
}
