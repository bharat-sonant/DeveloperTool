import { useState, useEffect, useRef } from 'react'
import { Loader2, FileImage, Eye, EyeOff, Search, RefreshCw, Calendar, Trash2, AlertTriangle, X, CheckSquare, Square, Clock } from 'lucide-react'
import { getFileDownloadURL, saveDutyOnOffScanResult, loadDutyOnOffScanResult, deleteStorageFiles, listDutyOnOffWards } from '../../lib/firebase'
import { formatSize } from './utils'
import CitySelector from '../CitySelector'

const DUTY_CITIES = ['Ajmer', 'Bharatpur', 'Bundi', 'Chennai', 'Chirawa', 'Dausa', 'Dei-Bundi', 'Etmadpur', 'Sikar']

const SOURCE_LABELS = {
  DutyOnImages: { short: 'On', color: 'bg-emerald-100 text-emerald-700' },
  DutyOutImages: { short: 'Out', color: 'bg-orange-100 text-orange-700' },
  DutyOnMeterReadingImages: { short: 'On Meter', color: 'bg-sky-100 text-sky-700' },
  DutyOutMeterReadingImages: { short: 'Out Meter', color: 'bg-purple-100 text-purple-700' },
}

export default function DutyOnOffSection() {
  const [selectedCity, setSelectedCity] = useState(DUTY_CITIES[0])
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(null)
  const [scanResult, setScanResult] = useState(null)
  const [loadingScanResult, setLoadingScanResult] = useState(true)

  const [selectedWard, setSelectedWard] = useState(null)
  const [selectedYear, setSelectedYear] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(null)
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

  const wardList = scanResult
    ? Object.keys(scanResult.wards).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    : []

  // Flat year-month list: [{year, month, totalFiles, data}]
  const yearMonthList = (() => {
    if (!scanResult || !selectedWard || !scanResult.wards[selectedWard]?.years) return []
    const list = []
    for (const [year, yearData] of Object.entries(scanResult.wards[selectedWard].years)) {
      for (const [month, monthData] of Object.entries(yearData.months)) {
        list.push({ year, month, totalFiles: monthData.totalFiles, key: `${year}-${month}` })
      }
    }
    // Sort descending: latest year-month first (chronological, not alphabetical)
    const MONTH_ORDER = { January:1, February:2, March:3, April:4, May:5, June:6, July:7, August:8, September:9, October:10, November:11, December:12 }
    return list.sort((a, b) => b.year.localeCompare(a.year) || (MONTH_ORDER[b.month] || 0) - (MONTH_ORDER[a.month] || 0))
  })()

  const selectedYearMonth = selectedYear && selectedMonth ? `${selectedYear}-${selectedMonth}` : null

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
      const folders = await listDutyOnOffWards(selectedCity)
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
            <p className="text-xs text-gray-500">Choose up to <span className="font-semibold text-rose-600">3 wards</span> at a time. Scans all 4 duty sources per ward.</p>
          </div>
          {loadingWards ? (
            <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-rose-500" /><span className="text-sm text-text-muted ml-2">Loading wards...</span></div>
          ) : availableWards.length === 0 ? (
            <div className="text-center py-8 text-sm text-text-muted">No wards found</div>
          ) : (
            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
              {availableWards.map(ward => {
                const isChecked = pickedWards.has(ward)
                const isDisabled = !isChecked && pickedWards.size >= 3
                return (
                  <button key={ward} onClick={() => !isDisabled && toggleWard(ward)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${isChecked ? 'bg-rose-50' : isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'}`}>
                    {isChecked ? <CheckSquare size={18} className="text-rose-500 shrink-0" /> : <Square size={18} className="text-gray-300 shrink-0" />}
                    <span className={`text-sm font-medium ${isChecked ? 'text-rose-700' : 'text-gray-700'}`}>{ward}</span>
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
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-rose-500 hover:bg-rose-600 transition-colors cursor-pointer shadow-lg shadow-rose-500/25 disabled:opacity-50 disabled:cursor-not-allowed">
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

  // Short source name for progress display
  function shortSource(source) {
    return SOURCE_LABELS[source]?.short || source
  }

  const handleScan = async (wards) => {
    setShowWardPicker(false)
    setScanning(true)
    setScanProgress(null)
    setElapsedTime(0)
    timerRef.current = setInterval(() => setElapsedTime(t => t + 1), 1000)
    try {
      const SOURCES = ['DutyOnImages', 'DutyOutImages', 'DutyOnMeterReadingImages', 'DutyOutMeterReadingImages']
      const { listAll: fbListAll, ref: fbRef } = await import('firebase/storage')
      const { storage: fbStorage } = await import('../../lib/firebase')
      let hitCount = 0

      // Load existing scan result to merge with new wards
      const existing = await loadDutyOnOffScanResult(selectedCity)
      const scanData = {
        city: selectedCity,
        scannedAt: new Date().toISOString(),
        totalFiles: 0,
        wards: existing?.wards || {},
      }
      // Remove wards being re-scanned (fresh data will replace them)
      for (const ward of wards) {
        delete scanData.wards[ward]
      }

      const progress = { ward: '', source: '', path: '', hits: 0, filesFound: 0, lastFile: '' }
      const updateProgress = (updates) => {
        Object.assign(progress, updates)
        setScanProgress({ ...progress })
      }

      for (const ward of wards) {
        updateProgress({ ward, source: '', path: `${ward}/...`, lastFile: '' })
        const wardData = { totalFiles: 0, years: {} }

        for (const source of SOURCES) {
          const path = `${selectedCity}/${source}/${ward}`
          hitCount++
          updateProgress({ source, hits: hitCount, path: `${ward}/${shortSource(source)}` })
          try {
            const result = await fbListAll(fbRef(fbStorage, path))

            // Collect year folders
            for (const prefix of result.prefixes) {
              const year = prefix.name
              if (!wardData.years[year]) wardData.years[year] = { totalFiles: 0, months: {} }
            }

            // Go into each year → list months
            for (const yearRef of result.prefixes) {
              const year = yearRef.name
              const yearPath = `${path}/${year}`
              hitCount++
              updateProgress({ hits: hitCount, path: `${ward}/${shortSource(source)}/${year}` })
              try {
                const monthsResult = await fbListAll(fbRef(fbStorage, yearPath))

                // Skip current month and previous month (frozen)
                const MONTH_NUM = { January:1, February:2, March:3, April:4, May:5, June:6, July:7, August:8, September:9, October:10, November:11, December:12 }
                const now = new Date()
                const curM = now.getMonth() + 1
                const curY = now.getFullYear()
                const prevM = curM === 1 ? 12 : curM - 1
                const prevY = curM === 1 ? curY - 1 : curY
                const yNum = parseInt(year)

                // Collect only non-frozen months
                for (const monthRef of monthsResult.prefixes) {
                  const month = monthRef.name
                  const mNum = MONTH_NUM[month] || 0
                  if ((yNum === curY && mNum === curM) || (yNum === prevY && mNum === prevM)) continue
                  if (!wardData.years[year].months[month]) wardData.years[year].months[month] = { totalFiles: 0, dates: {} }
                }

                // Go into each month → list dates
                for (const eachMonthRef of monthsResult.prefixes) {
                  const month = eachMonthRef.name
                  const mNum = MONTH_NUM[month] || 0
                  if ((yNum === curY && mNum === curM) || (yNum === prevY && mNum === prevM)) {
                    continue
                  }
                  const monthPath = `${yearPath}/${month}`
                  hitCount++
                  updateProgress({ hits: hitCount, path: `${ward}/${shortSource(source)}/${year}/${month}` })
                  try {
                    const datesResult = await fbListAll(fbRef(fbStorage, monthPath))

                    // Collect all dates
                    for (const dateRef of datesResult.prefixes) {
                      const date = dateRef.name
                      if (!wardData.years[year].months[month].dates[date]) wardData.years[year].months[month].dates[date] = { files: 0 }
                    }

                    // Scan ALL dates in parallel → list files + metadata
                    const allDates = datesResult.prefixes

                    const { getMetadata: fbGetMetadata } = await import('firebase/storage')

                    await Promise.all(allDates.map(async (dateRef) => {
                      const date = dateRef.name
                      const datePath = `${monthPath}/${date}`
                      hitCount++
                      updateProgress({ hits: hitCount, path: `${ward}/${shortSource(source)}/${year}/${month}/${date}` })
                      try {
                        const filesResult = await fbListAll(fbRef(fbStorage, datePath))

                        // Fetch metadata for all files in this date in parallel
                        const filesMeta = await Promise.all(filesResult.items.map(async (item) => {
                          hitCount++
                          updateProgress({ hits: hitCount, lastFile: item.name, filesFound: scanData.totalFiles })
                          try {
                            const meta = await fbGetMetadata(item)
                            return {
                              name: item.name,
                              fullPath: item.fullPath,
                              size: meta.size,
                              contentType: meta.contentType,
                              timeCreated: meta.timeCreated,
                              source,
                            }
                          } catch {
                            return null
                          }
                        }))

                        const validMeta = filesMeta.filter(Boolean)

                        // Update scanData
                        wardData.years[year].months[month].dates[date].files += filesResult.items.length
                        if (!wardData.years[year].months[month].dates[date].filesMeta) wardData.years[year].months[month].dates[date].filesMeta = []
                        wardData.years[year].months[month].dates[date].filesMeta.push(...validMeta)
                        wardData.years[year].months[month].totalFiles += filesResult.items.length
                        wardData.years[year].totalFiles += filesResult.items.length
                        wardData.totalFiles += filesResult.items.length
                        scanData.totalFiles += filesResult.items.length
                        updateProgress({ filesFound: scanData.totalFiles })
                      } catch {
                      }
                    }))
                  } catch (err) { hitCount++ }
                }

              } catch (err) { hitCount++ }
            }
          } catch (err) { hitCount++ }
        }

        // Only include wards that have files
        if (wardData.totalFiles > 0) {
          scanData.wards[ward] = wardData
        }
      }

      // Recalculate totalFiles across all wards (existing + newly scanned)
      scanData.totalFiles = Object.values(scanData.wards).reduce((s, w) => s + w.totalFiles, 0)

      // Save merged scanData to storage
      await saveDutyOnOffScanResult(selectedCity, scanData)

      // Set state from saved JSON → UI renders from this, no extra Firebase hits
      setScanResult(scanData)
      const firstWard = Object.keys(scanData.wards).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0]
      if (firstWard) setSelectedWard(firstWard)
    } catch {
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
          const deletedPaths = new Set([...selectedFiles].filter(p => !failedSet.has(p)))
          for (const [date, dateData] of Object.entries(monthData.dates || {})) {
            // Remove deleted files from filesMeta
            if (dateData.filesMeta) {
              dateData.filesMeta = dateData.filesMeta.filter(f => !deletedPaths.has(f.fullPath))
            }
            dateData.files = dateData.filesMeta?.length || 0
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
        saveDutyOnOffScanResult(selectedCity, next).catch(() => {})
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
    loadDutyOnOffScanResult(selectedCity).then(cached => {
      if (cached) {
        setScanResult(cached)
        const firstWard = Object.keys(cached.wards).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0]
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

  // Load files from scanResult JSON — no Firebase hit
  useEffect(() => {
    if (!selectedCity || !selectedWard || !selectedYear || !selectedMonth || !scanResult) {
      setAllDateFiles({})
      return
    }
    setImageUrls({})
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
        <CitySelector cities={DUTY_CITIES} selectedCity={selectedCity} onSelect={setSelectedCity} compact />
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center">
          <Search size={28} className="text-rose-500" />
        </div>
        <div className="text-center">
          <h3 className="text-sm font-semibold text-text mb-1">No Scan Data</h3>
          <p className="text-xs text-text-muted mb-1">Scan all Duty folders (On, Out, On Meter, Out Meter)</p>
          <div className="flex items-center justify-center gap-1.5 flex-wrap mt-2">
            {Object.values(SOURCE_LABELS).map(s => (
              <span key={s.short} className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${s.color}`}>{s.short}</span>
            ))}
          </div>
        </div>
        <button
          onClick={openWardPicker}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-rose-500 text-white hover:bg-rose-600 transition-all cursor-pointer shadow-sm"
        >
          <Search size={16} />
          Scan Duty On/Off
        </button>
      </div>
      {showWardPicker && renderWardPicker()}
      </>
    )
  }

  if (scanning) {
    const SOURCES_LIST = ['DutyOnImages', 'DutyOutImages', 'DutyOnMeterReadingImages', 'DutyOutMeterReadingImages']
    const sourceIdx = scanProgress?.source ? SOURCES_LIST.indexOf(scanProgress.source) : -1
    const sourcePct = sourceIdx >= 0 ? Math.round(((sourceIdx + 0.5) / SOURCES_LIST.length) * 100) : 0
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 size={28} className="animate-spin text-rose-500" />

        {/* Ward */}
        {scanProgress?.ward && (
          <div className="text-center">
            <span className="text-xs text-text-muted">Ward</span>
            <span className="text-sm font-bold text-rose-600 ml-1.5">{scanProgress.ward}</span>
          </div>
        )}

        {/* Source with color */}
        {scanProgress?.source && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted">Scanning</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SOURCE_LABELS[scanProgress.source]?.color || 'bg-gray-100 text-gray-700'}`}>
              {SOURCE_LABELS[scanProgress.source]?.short || scanProgress.source}
            </span>
          </div>
        )}

        {/* Progress bar */}
        <div className="w-48">
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-rose-400 to-rose-600 rounded-full transition-all duration-500" style={{ width: `${sourcePct}%` }} />
          </div>
          <div className="flex justify-between mt-1">
            {SOURCES_LIST.map((s, i) => (
              <div key={s} className={`w-2 h-2 rounded-full transition-all ${i <= sourceIdx ? 'bg-rose-500' : 'bg-gray-200'}`} />
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-[11px]">
          <div className="flex items-center gap-1.5 text-text-muted">
            <Clock size={12} />
            <span className="font-semibold text-rose-700">{formatElapsed(elapsedTime)}</span>
          </div>
          {scanProgress?.filesFound > 0 && (
            <span className="text-text-muted">
              <span className="font-bold text-emerald-600">{scanProgress.filesFound}</span> files
            </span>
          )}
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
      {/* Top strip */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-lighter bg-surface">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text">Duty On/Off</h3>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 border border-rose-500/20">
            {scanResult.totalFiles} files
          </span>
        </div>
        <div className="flex items-center gap-2">
          {scanResult.scannedAt && (
            <span className="text-[9px] text-text-muted">{timeAgo(scanResult.scannedAt)}</span>
          )}
          <button
            onClick={() => setShowRescanModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer bg-rose-500/10 text-rose-600 border border-rose-500/20 hover:bg-rose-500/20"
          >
            <RefreshCw size={12} />
            Re Scan
          </button>
          <div className="w-px h-5 bg-surface-lighter" />
          <CitySelector cities={DUTY_CITIES} selectedCity={selectedCity} onSelect={setSelectedCity} compact />
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
                    · {formatSize(Object.values(allDateFiles).flat().reduce((s, f) => s + (f.size || 0), 0))}
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
                      <div className="grid grid-cols-3 gap-2">
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
                                  <div>
                                    <div className="flex gap-1 overflow-x-auto justify-center">
                                      {files.map(file => (
                                        <div
                                          key={file.fullPath}
                                          className="flex-shrink-0 flex flex-col gap-0.5 p-1 rounded-md bg-surface-light/50 border border-surface-lighter hover:border-primary/30 transition-all group overflow-hidden"
                                        >
                                          {showImages && imageUrls[file.fullPath] ? (
                                            <img src={imageUrls[file.fullPath]} alt={file.name} className="w-[80px] h-[80px] object-cover rounded bg-surface" loading="lazy" />
                                          ) : (
                                            <div className="flex flex-col items-center justify-center w-[80px] h-[80px] bg-surface-light rounded">
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
                This scans <span className="font-semibold text-rose-600">4 duty folders</span> per ward.
                It will take <span className="font-semibold">significantly longer</span> than single-source scans.
              </p>
            </div>

            <div className="w-full bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
              <div className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <p className="text-xs text-amber-800 text-left">Scans DutyOn, DutyOut, OnMeter, OutMeter — <span className="font-semibold">4× the API calls</span> per ward</p>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <p className="text-xs text-amber-800 text-left">Avoid scanning repeatedly — only re-scan when new data has been added</p>
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
