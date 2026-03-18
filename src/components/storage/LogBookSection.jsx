import { useState, useEffect, useRef } from 'react'
import { Loader2, FileImage, Eye, EyeOff, Search, RefreshCw, Calendar, Trash2, AlertTriangle, X, CheckSquare, Square, Clock } from 'lucide-react'
import { getFileDownloadURL, scanLogBookImages, saveLogBookScanResult, loadLogBookScanResult, getLogBookDateFiles, deleteStorageFiles, listStorageFolders } from '../../lib/firebase'
import { formatSize } from './utils'

export default function LogBookSection({ selectedCity }) {
  // Scan state
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(null)
  const [scanResult, setScanResult] = useState(null)
  const [loadingScanResult, setLoadingScanResult] = useState(true)

  // Navigation
  const [selectedWard, setSelectedWard] = useState(null)
  const [selectedYear, setSelectedYear] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(null)
  // File browsing
  const [allDateFiles, setAllDateFiles] = useState({})
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [showImages, setShowImages] = useState(false)
  const [imageUrls, setImageUrls] = useState({})
  const [loadingImages, setLoadingImages] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState(new Set())
  const [deleting, setDeleting] = useState(false)
  const [showRescanModal, setShowRescanModal] = useState(false)
  const [showWardPicker, setShowWardPicker] = useState(false)
  const [availableWards, setAvailableWards] = useState([])
  const [pickedWards, setPickedWards] = useState(new Set())
  const [loadingWards, setLoadingWards] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const timerRef = useRef(null)

  // Frozen months: current month + previous month
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const frozenYearMonths = (() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth() + 1
    const pairs = []
    for (let i = 0; i < 2; i++) {
      let mo = m - i, yr = y
      if (mo <= 0) { mo += 12; yr -= 1 }
      pairs.push({ year: String(yr), month: mo })
    }
    return pairs
  })()

  function monthToNumber(monthStr) {
    const num = parseInt(monthStr, 10)
    if (!isNaN(num)) return num
    const idx = MONTH_NAMES.findIndex(n => n.toLowerCase() === monthStr.toLowerCase())
    return idx >= 0 ? idx + 1 : -1
  }

  function isFrozenMonth(year, month) {
    const mo = monthToNumber(month)
    return frozenYearMonths.some(f => f.year === String(year) && f.month === mo)
  }

  function filterScanResult(raw) {
    if (!raw || !raw.wards) return raw
    const result = JSON.parse(JSON.stringify(raw))
    result.totalFiles = 0
    for (const [wardName, wardData] of Object.entries(result.wards)) {
      wardData.totalFiles = 0
      for (const [year, yearData] of Object.entries(wardData.years)) {
        yearData.totalFiles = 0
        for (const month of Object.keys(yearData.months)) {
          if (isFrozenMonth(year, month)) {
            delete yearData.months[month]
          } else {
            yearData.totalFiles += yearData.months[month].totalFiles
          }
        }
        if (yearData.totalFiles <= 0) delete wardData.years[year]
        else wardData.totalFiles += yearData.totalFiles
      }
      if (wardData.totalFiles <= 0) delete result.wards[wardName]
      else result.totalFiles += wardData.totalFiles
    }
    return result
  }

  // Derived data
  const wardList = scanResult
    ? Object.keys(scanResult.wards).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    : []

  const yearList = (scanResult && selectedWard && scanResult.wards[selectedWard]?.years)
    ? Object.keys(scanResult.wards[selectedWard].years).sort()
    : []

  const monthList = (scanResult && selectedWard && selectedYear && scanResult.wards[selectedWard]?.years[selectedYear]?.months)
    ? Object.keys(scanResult.wards[selectedWard].years[selectedYear].months).sort()
    : []

  const dateList = (scanResult && selectedWard && selectedYear && selectedMonth && scanResult.wards[selectedWard]?.years[selectedYear]?.months[selectedMonth]?.dates)
    ? Object.entries(scanResult.wards[selectedWard].years[selectedYear].months[selectedMonth].dates)
        .sort(([a], [b]) => a.localeCompare(b))
    : []

  const openWardPicker = async () => {
    setLoadingWards(true)
    setShowRescanModal(false)
    setShowWardPicker(true)
    setPickedWards(new Set())
    try {
      const folders = await listStorageFolders(`${selectedCity}/LogBookImages`)
      setAvailableWards(folders)
    } catch {
      setAvailableWards([])
    }
    setLoadingWards(false)
  }

  const toggleWard = (ward) => {
    setPickedWards(prev => {
      const next = new Set(prev)
      if (next.has(ward)) { next.delete(ward) }
      else if (next.size < 3) { next.add(ward) }
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
            <p className="text-xs text-gray-500">Choose up to <span className="font-semibold text-violet-600">3 wards</span> at a time to scan.</p>
          </div>
          {loadingWards ? (
            <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-violet-500" /><span className="text-sm text-text-muted ml-2">Loading wards...</span></div>
          ) : availableWards.length === 0 ? (
            <div className="text-center py-8 text-sm text-text-muted">No wards found</div>
          ) : (
            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
              {availableWards.map(ward => {
                const isChecked = pickedWards.has(ward)
                const isDisabled = !isChecked && pickedWards.size >= 3
                return (
                  <button key={ward} onClick={() => !isDisabled && toggleWard(ward)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${isChecked ? 'bg-violet-50' : isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'}`}>
                    {isChecked ? <CheckSquare size={18} className="text-violet-500 shrink-0" /> : <Square size={18} className="text-gray-300 shrink-0" />}
                    <span className={`text-sm font-medium ${isChecked ? 'text-violet-700' : 'text-gray-700'}`}>{ward}</span>
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
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-violet-500 hover:bg-violet-600 transition-colors cursor-pointer shadow-lg shadow-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed">
                Start Scan ({pickedWards.size})
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

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
      const wardsToScan = wards && wards.length > 0 ? wards : null
      const rawResult = await scanLogBookImages(selectedCity, (progress) => {
        setScanProgress(progress)
      }, wardsToScan)

      let finalRaw = rawResult
      if (wardsToScan && scanResult) {
        const existing = JSON.parse(JSON.stringify(scanResult))
        for (const [w, wd] of Object.entries(rawResult.wards)) {
          existing.wards[w] = wd
        }
        existing.totalFiles = Object.values(existing.wards).reduce((s, w) => s + w.totalFiles, 0)
        existing.scannedAt = rawResult.scannedAt
        finalRaw = existing
      }

      await saveLogBookScanResult(selectedCity, finalRaw)
      const result = filterScanResult(finalRaw)
      setScanResult(result)
      if (Object.keys(result.wards).length > 0) {
        const firstWard = Object.keys(result.wards).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0]
        setSelectedWard(firstWard)
        setSelectedYear(null)
        setSelectedMonth(null)
        setAllDateFiles({})
      }
    } catch {
      alert('Scan failed. Please try again.')
    }
    clearInterval(timerRef.current)
    setScanning(false)
  }

  const allFiles = Object.values(allDateFiles).flat()

  const handleDeleteSelected = async () => {
    if (selectedFiles.size === 0) return
    const confirmed = window.confirm(`Are you sure you want to delete ${selectedFiles.size} file(s)? This action cannot be undone.`)
    if (!confirmed) return
    setDeleting(true)
    try {
      const { deleted, failed } = await deleteStorageFiles([...selectedFiles])
      const failedSet = new Set(failed)
      const deletedCount = deleted

      setAllDateFiles(prev => {
        const next = {}
        for (const [date, files] of Object.entries(prev)) {
          next[date] = files.filter(f => !selectedFiles.has(f.fullPath) || failedSet.has(f.fullPath))
        }
        return next
      })
      setSelectedFiles(new Set(failed))

      if (scanResult && selectedWard && selectedYear && selectedMonth && deletedCount > 0) {
        const next = JSON.parse(JSON.stringify(scanResult))
        const monthData = next.wards[selectedWard]?.years[selectedYear]?.months[selectedMonth]
        if (monthData) {
          for (const [date, dateData] of Object.entries(monthData.dates || {})) {
            const dateFiles = allDateFiles[date] || []
            const deletedInDate = dateFiles.filter(f => selectedFiles.has(f.fullPath) && !failedSet.has(f.fullPath)).length
            dateData.files -= deletedInDate
            if (dateData.files <= 0) delete monthData.dates[date]
          }
          monthData.totalFiles = Object.values(monthData.dates || {}).reduce((s, d) => s + d.files, 0)
          if (monthData.totalFiles <= 0) {
            delete next.wards[selectedWard].years[selectedYear].months[selectedMonth]
          }
          const yearData = next.wards[selectedWard].years[selectedYear]
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
        saveLogBookScanResult(selectedCity, next).catch(() => {})
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

  // Effects
  useEffect(() => {
    if (!selectedCity) return
    setLoadingScanResult(true)
    setScanResult(null)
    setSelectedWard(null)
    setSelectedYear(null)
    setSelectedMonth(null)
    setAllDateFiles({})
    loadLogBookScanResult(selectedCity).then(cached => {
      if (cached) {
        const filtered = filterScanResult(cached)
        setScanResult(filtered)
        const firstWard = Object.keys(filtered.wards).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0]
        if (firstWard) setSelectedWard(firstWard)
      }
    }).finally(() => setLoadingScanResult(false))
  }, [selectedCity])

  useEffect(() => {
    if (yearList.length > 0 && !yearList.includes(selectedYear)) {
      setSelectedYear(yearList[0])
      setSelectedMonth(null)
      setAllDateFiles({})
    }
  }, [selectedWard])

  useEffect(() => {
    if (monthList.length > 0 && !monthList.includes(selectedMonth)) {
      setSelectedMonth(monthList[0])
      setAllDateFiles({})
    }
  }, [selectedYear, monthList.length])

  useEffect(() => {
    if (!selectedCity || !selectedWard || !selectedYear || !selectedMonth) {
      setAllDateFiles({})
      return
    }
    let cancelled = false
    setLoadingFiles(true)
    setImageUrls({})
    setSelectedFiles(new Set())
    const dates = dateList.map(([date]) => date)
    Promise.all(
      dates.map(date =>
        getLogBookDateFiles(selectedCity, selectedWard, selectedYear, selectedMonth, date)
          .then(files => ({ date, files }))
          .catch(() => ({ date, files: [] }))
      )
    ).then(results => {
      if (cancelled) return
      const map = {}
      results.forEach(r => { map[r.date] = r.files })
      setAllDateFiles(map)
    }).finally(() => { if (!cancelled) setLoadingFiles(false) })
    return () => { cancelled = true }
  }, [selectedCity, selectedWard, selectedYear, selectedMonth])

  useEffect(() => {
    const allFiles = Object.values(allDateFiles).flat()
    if (!showImages || allFiles.length === 0) return
    const toFetch = allFiles.filter(f => !imageUrls[f.fullPath])
    if (toFetch.length === 0) return
    let cancelled = false
    setLoadingImages(true)
    Promise.all(
      toFetch.map(f =>
        getFileDownloadURL(f.fullPath)
          .then(url => ({ path: f.fullPath, url }))
          .catch(() => ({ path: f.fullPath, url: null }))
      )
    ).then(results => {
      if (cancelled) return
      setImageUrls(prev => {
        const next = { ...prev }
        results.forEach(r => { next[r.path] = r.url })
        return next
      })
    }).finally(() => { if (!cancelled) setLoadingImages(false) })
    return () => { cancelled = true }
  }, [showImages, allDateFiles])

  // Render
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
        <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center">
          <Search size={28} className="text-violet-500" />
        </div>
        <div className="text-center">
          <h3 className="text-sm font-semibold text-text mb-1">No Scan Data for {selectedCity}</h3>
          <p className="text-xs text-text-muted mb-4">Scan LogBook folders to see stored images</p>
        </div>
        <button
          onClick={openWardPicker}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-violet-500 text-white hover:bg-violet-600 transition-all cursor-pointer shadow-sm"
        >
          <Search size={16} />
          Scan LogBook
        </button>
      </div>
      {showWardPicker && renderWardPicker()}
      </>
    )
  }

  if (scanning) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 size={32} className="animate-spin text-violet-500" />
        <span className="text-sm font-medium text-violet-700">
          Scanning {scanProgress?.currentWard || '...'}
        </span>
        {scanProgress && (
          <>
            <span className="text-xs text-text-muted">{scanProgress.scannedWards}/{scanProgress.totalWards} wards</span>
            <div className="w-72 h-2 bg-violet-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all duration-300"
                style={{ width: `${(scanProgress.scannedWards / scanProgress.totalWards) * 100}%` }}
              />
            </div>
          </>
        )}
        <div className="flex items-center gap-1.5 text-xs text-text-muted mt-1">
          <Clock size={12} />
          <span>Elapsed: <span className="font-semibold text-violet-700">{formatElapsed(elapsedTime)}</span></span>
        </div>
      </div>
    )
  }

  return (
    <>
    <div className="h-full p-[1px] rounded-xl relative overflow-hidden" style={{
      background: 'conic-gradient(from var(--border-angle, 0deg), #818cf8, #a78bfa, #f472b6, #818cf8)',
      animation: 'spin-border 3s linear infinite'
    }}>
    <style>{`@keyframes spin-border { to { --border-angle: 360deg; } } @property --border-angle { syntax: "<angle>"; initial-value: 0deg; inherits: false; }`}</style>
    <div className="flex flex-col h-full rounded-[10px] overflow-hidden bg-white">
      {/* Full-width top strip */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-lighter bg-surface">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text">{selectedCity} — LogBook Images</h3>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-600 border border-violet-500/20">
            {scanResult.totalFiles} files
          </span>
        </div>
        <div className="flex items-center gap-3">
          {scanResult.scannedAt && (
            <span className="text-[9px] text-text-muted">{timeAgo(scanResult.scannedAt)}</span>
          )}
          <button
            onClick={() => setShowRescanModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer bg-violet-500/10 text-violet-600 border border-violet-500/20 hover:bg-violet-500/20"
          >
            <RefreshCw size={12} />
            Re Scan
          </button>
        </div>
      </div>

      {/* Body: Ward list + Content */}
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

      {/* Right: Content area */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {!selectedWard ? (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">Select a ward</div>
        ) : !scanResult.wards[selectedWard] ? (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">No data for this ward</div>
        ) : (
          <>
            {/* Year + Month filters */}
            <div className="px-4 pt-3 space-y-3">
              {/* Year cards */}
              {yearList.length > 0 && !selectedYear && (
                <div>
                  <h4 className="text-xs font-semibold text-text mb-2">{selectedWard} — Years</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {yearList.map(yr => {
                      const yd = scanResult.wards[selectedWard].years[yr]
                      const monthCount = Object.keys(yd.months).length
                      return (
                        <button
                          key={yr}
                          onClick={() => { setSelectedYear(yr); setSelectedMonth(null); setAllDateFiles({}) }}
                          className="flex flex-col items-center gap-1 p-3 rounded-xl border border-violet-200/60 bg-gradient-to-br from-violet-50 to-purple-50 hover:border-violet-400 hover:shadow-md transition-all cursor-pointer group"
                        >
                          <span className="text-lg font-bold text-violet-700 group-hover:text-violet-800">{yr}</span>
                          <span className="text-[10px] font-medium text-violet-600">{yd.totalFiles} files</span>
                          <span className="text-[9px] text-text-muted">{monthCount} month{monthCount !== 1 ? 's' : ''}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Selected year header + month tabs in one row */}
              {selectedYear && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => { setSelectedYear(null); setSelectedMonth(null); setAllDateFiles({}) }}
                    className="text-[10px] font-semibold text-violet-600 hover:text-violet-800 transition-colors cursor-pointer"
                  >
                    {selectedWard}
                  </button>
                  <span className="text-[10px] text-text-muted">/</span>
                  <span className="text-[10px] font-bold text-text">{selectedYear}</span>
                  <span className="text-[9px] text-text-muted">({scanResult.wards[selectedWard].years[selectedYear].totalFiles} files)</span>
                  {monthList.length > 0 && (
                    <>
                      <span className="text-[10px] text-text-muted mx-1">|</span>
                      {monthList.map(mo => {
                        const md = scanResult.wards[selectedWard].years[selectedYear].months[mo]
                        return (
                          <button
                            key={mo}
                            onClick={() => { setSelectedMonth(selectedMonth === mo ? null : mo); setAllDateFiles({}) }}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                              selectedMonth === mo ? 'bg-primary text-white shadow-sm' : 'bg-primary/8 text-primary border border-primary/20 hover:bg-primary/15'
                            }`}
                          >
                            {mo} ({md.totalFiles})
                          </button>
                        )
                      })}
                    </>
                  )}
                  {selectedMonth && Object.keys(allDateFiles).length > 0 && (
                    <span className="text-[9px] text-text-muted">
                      · {formatSize(Object.values(allDateFiles).flat().reduce((s, f) => s + f.size, 0))}
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
                    <button
                      onClick={() => setShowImages(prev => !prev)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                        showImages ? 'bg-primary text-white' : 'bg-surface border border-surface-lighter text-text-muted hover:border-primary/30'
                      }`}
                    >
                      {showImages ? <Eye size={13} /> : <EyeOff size={13} />}
                      {showImages ? 'Images ON' : 'Images OFF'}
                      {loadingImages && <Loader2 size={12} className="animate-spin ml-0.5" />}
                    </button>
                    {allFiles.length > 0 && (
                      <button
                        onClick={() => {
                          if (selectedFiles.size === allFiles.length) {
                            setSelectedFiles(new Set())
                          } else {
                            setSelectedFiles(new Set(allFiles.map(f => f.fullPath)))
                          }
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
              )}
            </div>

            {/* Date cards grid */}
            {selectedYear && selectedMonth ? (
              <div className="flex-1 overflow-y-auto mt-3 border-t border-surface-lighter p-4">
                {dateList.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-text-muted text-xs">No dates found</div>
                ) : (
                  <div>
                    {loadingFiles ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 size={18} className="animate-spin text-primary" />
                        <span className="text-xs text-text-muted ml-2">Loading files...</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-8 gap-2">
                        {dateList.map(([date, info]) => {
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
                                      {formatSize(files.reduce((s, f) => s + f.size, 0))}
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
                                  <div>
                                    <div className="flex gap-1 overflow-x-auto justify-center">
                                      {files.map(file => (
                                        <div
                                          key={file.name}
                                          className="flex-shrink-0 flex flex-col gap-0.5 p-1 rounded-md bg-surface-light/50 border border-surface-lighter hover:border-primary/30 transition-all group overflow-hidden"
                                        >
                                          {showImages && imageUrls[file.fullPath] ? (
                                            <img src={imageUrls[file.fullPath]} alt={file.name} className="w-[90px] h-[90px] object-cover rounded bg-surface" loading="lazy" />
                                          ) : (
                                            <div className="flex flex-col items-center justify-center w-[90px] h-[90px] bg-surface-light rounded">
                                              <FileImage size={12} className="text-primary/40 group-hover:text-primary/70 transition-colors" />
                                              <span className="text-[8px] text-text-muted mt-1">{formatSize(file.size)}</span>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : selectedYear ? (
              <div className="flex items-center justify-center flex-1 text-text-muted text-sm">
                Select a month
              </div>
            ) : null}
          </>
        )}
      </div>
      </div>
    </div>
    </div>

    {showRescanModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={() => setShowRescanModal(false)} />
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-[slideUp_0.3s_ease-out]">
          <button
            onClick={() => setShowRescanModal(false)}
            className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X size={18} className="text-gray-400" />
          </button>

          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle size={28} className="text-amber-500" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Re-scan Confirmation</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Re-scanning is a <span className="font-semibold text-amber-600">time-consuming process</span>.
                Depending on total files, it can take <span className="font-semibold">several hours</span> to complete.
              </p>
            </div>

            <div className="w-full bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
              <div className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <p className="text-xs text-amber-800 text-left">Each scan reads metadata of every file in storage, which significantly <span className="font-semibold">increases server costs</span></p>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <p className="text-xs text-amber-800 text-left">Avoid scanning repeatedly — only re-scan when new data has been added or files have changed</p>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <p className="text-xs text-amber-800 text-left">Previous scan results will be replaced with fresh data</p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full pt-2">
              <button
                onClick={() => setShowRescanModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={openWardPicker}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 transition-colors cursor-pointer shadow-lg shadow-amber-500/25"
              >
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
