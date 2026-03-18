import { useState, useEffect } from 'react'
import { Loader2, Calendar, FileImage, Eye, EyeOff, Trash2, Search, RefreshCw, AlertTriangle, X } from 'lucide-react'
import { getEmployeeFiles, getFileDownloadURL, deleteStorageFiles, scanAttendanceCleanup, saveCleanupResult, loadCleanupResult } from '../../lib/firebase'
import { MONTH_ORDER, formatSize } from './utils'

export default function AttendanceSection({ selectedCity }) {
  // Scan state
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(null)
  const [scanResult, setScanResult] = useState(null)
  const [loadingScanResult, setLoadingScanResult] = useState(true)

  // Navigation state (driven by scan result)
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [selectedYear, setSelectedYear] = useState(null)
  const [selectedEmployee, setSelectedEmployee] = useState(null)

  // File browsing state
  const [empFiles, setEmpFiles] = useState([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [showImages, setShowImages] = useState(false)
  const [imageUrls, setImageUrls] = useState({})
  const [selectedFiles, setSelectedFiles] = useState(new Set())
  const [loadingImages, setLoadingImages] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showRescanModal, setShowRescanModal] = useState(false)


  // Derived: months from scan result sorted by MONTH_ORDER
  const scanMonths = scanResult
    ? Object.keys(scanResult.months).sort((a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b))
    : []

  // Derived: years in selected month
  const monthYears = (scanResult && selectedMonth && scanResult.months[selectedMonth]?.years)
    ? Object.keys(scanResult.months[selectedMonth].years).sort()
    : []

  // Derived: employees in selected month (filtered by year if selected)
  const monthEmployees = (() => {
    if (!scanResult || !selectedMonth || !scanResult.months[selectedMonth]) return []
    const emps = scanResult.months[selectedMonth].employees
    return Object.entries(emps)
      .map(([id, data]) => {
        if (!selectedYear) return { id, ...data }
        const filteredDates = Object.entries(data.dates || {}).filter(([d]) => d.startsWith(selectedYear))
        if (filteredDates.length === 0) return null
        const files = filteredDates.reduce((s, [, info]) => s + (info.in ? 1 : 0) + (info.out ? 1 : 0) + (info.other || 0), 0)
        return { id, files, dates: Object.fromEntries(filteredDates) }
      })
      .filter(Boolean)
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
  })()

  // Frozen prefixes for current + previous 2 months
  const frozenPrefixes = (() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth() + 1
    const prefixes = new Set()
    for (let i = 0; i < 3; i++) {
      let mo = m - i, yr = y
      if (mo <= 0) { mo += 12; yr -= 1 }
      prefixes.add(`${yr}-${String(mo).padStart(2, '0')}`)
    }
    return prefixes
  })()

  // Filter cached scan result to remove dates that are now frozen
  // (cached scan may have been created when different months were frozen)
  function filterScanResult(raw) {
    if (!raw || !raw.months) return raw
    const result = JSON.parse(JSON.stringify(raw))
    result.totalFiles = 0

    for (const [month, monthData] of Object.entries(result.months)) {
      monthData.totalFiles = 0
      const yearsCount = {}

      for (const [empId, empData] of Object.entries(monthData.employees)) {
        for (const dateStr of Object.keys(empData.dates || {})) {
          const ym = dateStr.slice(0, 7) // "YYYY-MM"
          if (frozenPrefixes.has(ym)) {
            delete empData.dates[dateStr]
          }
        }
        // Recalculate employee file count from remaining dates
        empData.files = Object.values(empData.dates || {}).reduce(
          (s, d) => s + (d.in ? 1 : 0) + (d.out ? 1 : 0) + (d.other || 0), 0
        )
        if (empData.files <= 0) {
          delete monthData.employees[empId]
        } else {
          // Accumulate per-year counts
          for (const dateStr of Object.keys(empData.dates)) {
            const yr = dateStr.slice(0, 4)
            yearsCount[yr] = (yearsCount[yr] || 0) +
              (empData.dates[dateStr].in ? 1 : 0) +
              (empData.dates[dateStr].out ? 1 : 0) +
              (empData.dates[dateStr].other || 0)
          }
          monthData.totalFiles += empData.files
        }
      }

      // Rebuild years from recalculated counts
      monthData.years = {}
      for (const [yr, count] of Object.entries(yearsCount)) {
        monthData.years[yr] = { files: count }
      }

      if (monthData.totalFiles <= 0) {
        delete result.months[month]
      } else {
        result.totalFiles += monthData.totalFiles
      }
    }

    return result
  }

  // Filter loaded files: exclude frozen + filter by selected year
  const filteredFiles = (() => {
    let files = empFiles.filter(f => {
      const match = f.name.match(/^(\d{4}-\d{2})/)
      return !match || !frozenPrefixes.has(match[1])
    })
    if (selectedYear) files = files.filter(f => f.name.startsWith(selectedYear))
    return files
  })()

  // ── Handlers ──

  const handleScan = async () => {
    setScanning(true)
    setScanProgress(null)
    try {
      console.log(`[Attendance] Starting scan for ${selectedCity}...`)
      const result = await scanAttendanceCleanup(selectedCity, (progress) => {
        setScanProgress(progress)
      })
      console.log(`[Attendance] Scan complete. ${result.totalFiles} files found. Saving...`)
      setScanResult(result)
      await saveCleanupResult(selectedCity, result)
      console.log(`[Attendance] Scan result saved to storage`)
      // Auto-select first month with data
      const firstMonth = Object.entries(result.months)
        .sort(([a], [b]) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b))
        .find(([, d]) => d.totalFiles > 0)
      if (firstMonth) {
        setSelectedMonth(firstMonth[0])
        setSelectedYear(null)
        setSelectedEmployee(null)
      }
    } catch {
      alert('Scan failed. Please try again.')
    }
    setScanning(false)
  }

  const handleDeleteSelected = async () => {
    if (selectedFiles.size === 0) return
    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedFiles.size} file(s)? This action cannot be undone.`
    )
    if (!confirmed) return
    setDeleting(true)
    try {
      console.log(`[Attendance] Deleting ${selectedFiles.size} files...`)
      const { deleted, failed } = await deleteStorageFiles([...selectedFiles])
      console.log(`[Attendance] Delete done. Deleted: ${deleted}, Failed: ${failed.length}`)
      const remainingFiles = empFiles.filter(f => !selectedFiles.has(f.fullPath) || failed.includes(f.fullPath))
      setEmpFiles(remainingFiles)
      setSelectedFiles(new Set(failed))

      // Update scan result counts after deletion + persist to Firebase
      if (scanResult && selectedMonth && selectedEmployee && deleted > 0) {
        const next = JSON.parse(JSON.stringify(scanResult))
        const deletedPaths = [...selectedFiles].filter(p => !failed.includes(p))
        next.totalFiles -= deletedPaths.length

        const monthData = next.months[selectedMonth]
        if (monthData) {
          monthData.totalFiles -= deletedPaths.length
          const empData = monthData.employees[selectedEmployee]
          if (empData) {
            empData.files -= deletedPaths.length
            deletedPaths.forEach(p => {
              const fileName = p.split('/').pop()
              const dateMatch = fileName.match(/^(\d{4}-\d{2}-\d{2})/)
              if (dateMatch && empData.dates[dateMatch[1]]) {
                const type = fileName.includes('InImage') ? 'in' : fileName.includes('outImage') ? 'out' : 'other'
                if (type === 'in') empData.dates[dateMatch[1]].in = false
                else if (type === 'out') empData.dates[dateMatch[1]].out = false
                const d = empData.dates[dateMatch[1]]
                if (!d.in && !d.out && (!d.other || d.other === 0)) {
                  delete empData.dates[dateMatch[1]]
                }
              }
              const yrMatch = fileName.match(/^(\d{4})/)
              if (yrMatch && monthData.years[yrMatch[1]]) {
                monthData.years[yrMatch[1]].files--
                if (monthData.years[yrMatch[1]].files <= 0) delete monthData.years[yrMatch[1]]
              }
            })
            if (empData.files <= 0) delete monthData.employees[selectedEmployee]
          }
          if (monthData.totalFiles <= 0) delete next.months[selectedMonth]
        }
        setScanResult(next)
        console.log(`[Attendance] Saving updated scan result after delete. New total: ${next.totalFiles}`)
        saveCleanupResult(selectedCity, next).catch(() => {})
      }

      if (remainingFiles.length === 0) {
        const currentIdx = monthEmployees.findIndex(e => e.id === selectedEmployee)
        const nextEmp = monthEmployees[currentIdx + 1] || monthEmployees[currentIdx - 1]
        setSelectedEmployee(nextEmp ? nextEmp.id : null)
      }

      if (failed.length > 0) {
        alert(`${deleted} file(s) deleted. ${failed.length} file(s) failed to delete.`)
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
    if (!selectedCity) return
    setLoadingScanResult(true)
    setScanResult(null)
    setSelectedMonth(null)
    setSelectedYear(null)
    setSelectedEmployee(null)
    setEmpFiles([])
    console.log(`[Attendance] Loading cached scan result for ${selectedCity}...`)
    loadCleanupResult(selectedCity).then(cached => {
      if (cached) {
        console.log(`[Attendance] Cached result loaded. Filtering frozen months...`)
        const filtered = filterScanResult(cached)
        console.log(`[Attendance] After filtering: ${filtered.totalFiles} files, ${Object.keys(filtered.months || {}).length} months`)
        setScanResult(filtered)
        const firstMonth = Object.entries(filtered.months)
          .sort(([a], [b]) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b))
          .find(([, d]) => d.totalFiles > 0)
        if (firstMonth) setSelectedMonth(firstMonth[0])
      }
    }).finally(() => setLoadingScanResult(false))
  }, [selectedCity])

  // Auto-select first employee when month/year changes
  useEffect(() => {
    if (monthEmployees.length > 0 && !monthEmployees.find(e => e.id === selectedEmployee)) {
      setSelectedEmployee(monthEmployees[0].id)
    }
  }, [selectedMonth, selectedYear, monthEmployees.length])

  useEffect(() => {
    if (!selectedCity || !selectedMonth || !selectedEmployee) { setEmpFiles([]); return }
    let cancelled = false
    setLoadingFiles(true)
    setImageUrls({})
    setSelectedFiles(new Set())
    console.log(`[Attendance] Loading files for ${selectedCity}/${selectedMonth}/${selectedEmployee}`)
    getEmployeeFiles(selectedCity, selectedMonth, selectedEmployee)
      .then(files => { if (!cancelled) setEmpFiles(files) })
      .catch(() => { if (!cancelled) setEmpFiles([]) })
      .finally(() => { if (!cancelled) setLoadingFiles(false) })
    return () => { cancelled = true }
  }, [selectedCity, selectedMonth, selectedEmployee])

  useEffect(() => {
    if (!showImages || empFiles.length === 0) return
    const toFetch = empFiles.filter(f => !imageUrls[f.fullPath])
    if (toFetch.length === 0) return
    console.log(`[Attendance] Fetching ${toFetch.length} image download URLs...`)
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
  }, [showImages, empFiles])

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
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
          <Search size={28} className="text-amber-500" />
        </div>
        <div className="text-center">
          <h3 className="text-sm font-semibold text-text mb-1">No Scan Data for {selectedCity}</h3>
          <p className="text-xs text-text-muted mb-4">Scan attendance folders to see what data needs cleanup</p>
        </div>
        <button
          onClick={handleScan}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 transition-all cursor-pointer shadow-sm"
        >
          <Search size={16} />
          Scan for Cleanup
        </button>
      </div>
    )
  }

  if (scanning) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 size={32} className="animate-spin text-amber-500" />
        <span className="text-sm font-medium text-amber-700">
          Scanning {scanProgress?.currentMonth || '...'}
        </span>
        {scanProgress && (
          <>
            <span className="text-xs text-text-muted">{scanProgress.scannedMonths}/{scanProgress.totalMonths} months</span>
            <div className="w-72 h-2 bg-amber-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-300"
                style={{ width: `${(scanProgress.scannedMonths / scanProgress.totalMonths) * 100}%` }}
              />
            </div>
          </>
        )}
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
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-lighter bg-surface">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-text">{selectedCity} — Storage Cleanup</h3>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-danger/10 text-danger border border-danger/20">
              {scanResult.totalFiles} files to delete
            </span>
            {scanResult.scannedAt && (
              <span className="text-[9px] text-text-muted">Scanned {timeAgo(scanResult.scannedAt)}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowRescanModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer bg-amber-500/10 text-amber-600 border border-amber-500/20 hover:bg-amber-500/20"
            >
              <RefreshCw size={12} />
              Re-scan
            </button>
          </div>
        </div>


        {/* Year filter + Employee + Files area */}
        {selectedMonth && scanResult.months[selectedMonth] && (
          <>
            {monthYears.length > 1 && (
              <div className="flex items-center gap-1.5 pb-3 mb-3 border-b border-surface-lighter">
                <span className="text-[10px] text-text-muted mr-1">Year:</span>
                <button
                  onClick={() => setSelectedYear(null)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                    !selectedYear ? 'bg-primary text-white shadow-sm' : 'bg-primary/8 text-primary border border-primary/20 hover:bg-primary/15'
                  }`}
                >
                  All ({scanResult.months[selectedMonth].totalFiles})
                </button>
                {monthYears.map(yr => {
                  const yd = scanResult.months[selectedMonth].years[yr]
                  return (
                    <button
                      key={yr}
                      onClick={() => setSelectedYear(selectedYear === yr ? null : yr)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                        selectedYear === yr ? 'bg-primary text-white shadow-sm' : 'bg-primary/8 text-primary border border-primary/20 hover:bg-primary/15'
                      }`}
                    >
                      {yr} ({yd.files})
                    </button>
                  )
                })}
              </div>
            )}

            <div className="flex flex-1 min-h-0">
              {/* Employee list */}
              <div className="w-32 shrink-0 border-r border-surface-lighter overflow-y-auto bg-gray-100">
                {monthEmployees.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-text-muted text-xs">No records</div>
                ) : (
                  <div className="flex flex-col">
                    {monthEmployees.map((emp, idx) => {
                      const isEmpSelected = selectedEmployee === emp.id
                      return (
                        <div key={emp.id}>
                          {idx > 0 && <hr className="border-surface-lighter" />}
                          <button
                            onClick={() => setSelectedEmployee(emp.id)}
                            className={`w-full px-3 py-2 text-left transition-all cursor-pointer ${
                              isEmpSelected ? 'bg-gray-200 border-r-2 border-gray-500' : 'hover:bg-gray-200/50'
                            }`}
                          >
                            <div className={`text-[11px] font-semibold ${isEmpSelected ? 'text-gray-800' : 'text-text'}`}>{emp.id}</div>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* File details */}
              <div className="flex-1 min-w-0 overflow-y-auto bg-white flex flex-col">
                {/* Month strip at top of content area */}
                <div className="flex items-center gap-2 flex-wrap px-4 py-2 border-b border-surface-lighter bg-white shrink-0">
                  {selectedEmployee && (
                    <>
                      <span className="text-[10px] font-semibold text-text">Employee {selectedEmployee}</span>
                      {filteredFiles.length > 0 && (
                        <span className="text-[9px] text-text-muted">
                          ({filteredFiles.length} files · {formatSize(filteredFiles.reduce((s, f) => s + f.size, 0))})
                        </span>
                      )}
                    </>
                  )}
                  {scanMonths.length > 0 && (
                    <>
                      {selectedEmployee && <span className="text-[10px] text-text-muted mx-1">|</span>}
                      {scanMonths.map(month => {
                        const data = scanResult.months[month]
                        const isSelected = selectedMonth === month
                        return (
                          <button
                            key={month}
                            onClick={() => { setSelectedMonth(isSelected ? null : month); setSelectedYear(null); setSelectedEmployee(null); setEmpFiles([]) }}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-primary text-white shadow-sm'
                                : 'bg-white text-black border border-primary/20 hover:bg-primary/15'
                            }`}
                          >
                            {month} <span className={`text-[8px] ${isSelected ? 'text-white' : 'text-danger'}`}>{data.totalFiles}</span>
                          </button>
                        )
                      })}
                    </>
                  )}
                  {scanMonths.length === 0 && (
                    <div className="text-xs text-success font-medium">All clean — no files to delete</div>
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
                    {filteredFiles.length > 0 && (
                      <button
                        onClick={() => {
                          if (selectedFiles.size === filteredFiles.length) {
                            setSelectedFiles(new Set())
                          } else {
                            setSelectedFiles(new Set(filteredFiles.map(f => f.fullPath)))
                          }
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                          selectedFiles.size === filteredFiles.length && filteredFiles.length > 0
                            ? 'bg-primary text-white'
                            : 'bg-surface border border-surface-lighter text-text-muted hover:border-primary/30'
                        }`}
                      >
                        {selectedFiles.size === filteredFiles.length && filteredFiles.length > 0 ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                {!selectedEmployee ? (
                  <div className="flex items-center justify-center h-full text-text-muted text-sm">Select an employee</div>
                ) : loadingFiles ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 size={20} className="animate-spin text-primary" />
                  </div>
                ) : filteredFiles.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-text-muted text-sm">No files found</div>
                ) : (
                  <div>
                    {(() => {
                      const grouped = {}
                      filteredFiles.forEach(file => {
                        const match = file.name.match(/^(\d{4}-\d{2}-\d{2})/)
                        const dateKey = match ? match[1] : 'Unknown'
                        if (!grouped[dateKey]) grouped[dateKey] = []
                        grouped[dateKey].push(file)
                      })
                      const sortedDates = Object.keys(grouped).sort()
                      return (
                        <div className="grid grid-cols-5 gap-3">
                          {sortedDates.map(dateKey => (
                            <div key={dateKey} className="rounded-[5px] border border-surface-lighter bg-surface-light/30 overflow-hidden">
                              <div className="flex items-center justify-between px-3 py-2 bg-gray-100 border-b border-surface-lighter">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="checkbox"
                                    className="w-3.5 h-3.5 rounded accent-primary cursor-pointer"
                                    checked={grouped[dateKey].every(f => selectedFiles.has(f.fullPath))}
                                    onChange={(e) => {
                                      setSelectedFiles(prev => {
                                        const next = new Set(prev)
                                        grouped[dateKey].forEach(f => {
                                          if (e.target.checked) next.add(f.fullPath)
                                          else next.delete(f.fullPath)
                                        })
                                        return next
                                      })
                                    }}
                                  />
                                  <Calendar size={12} className="text-primary/60" />
                                  <span className="text-[11px] font-semibold text-text">{dateKey}</span>
                                </div>
                                <span className="text-[9px] text-text-muted bg-white px-1.5 py-0.5 rounded-full">{grouped[dateKey].length} files</span>
                              </div>
                              <div className="p-2 grid grid-cols-2 gap-1.5">
                                {grouped[dateKey].map(file => {
                                  const type = file.name.includes('InImage') ? 'In' : file.name.includes('outImage') ? 'Out' : '—'
                                  return (
                                    <div
                                      key={file.name}
                                      className="flex flex-col gap-1.5 p-2 rounded-lg bg-white border border-surface-lighter hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group overflow-hidden"
                                    >
                                      {showImages && imageUrls[file.fullPath] ? (
                                        <img src={imageUrls[file.fullPath]} alt={file.name} className="w-full h-16 object-cover rounded-md bg-surface" loading="lazy" />
                                      ) : (
                                        <FileImage size={16} className="text-primary/40 group-hover:text-primary/70 transition-colors" />
                                      )}
                                      <div className="flex items-center justify-between">
                                        <span className="text-[9px] text-text-muted">{formatSize(file.size)}</span>
                                        <span className={`text-[9px] font-medium px-1 py-0.5 rounded ${
                                          type === 'In' ? 'bg-success/10 text-success' : type === 'Out' ? 'bg-danger/10 text-danger' : 'bg-surface-light text-text-muted'
                                        }`}>{type}</span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                )}
                </div>
              </div>
            </div>
          </>
        )}
    </div>
    </div>

    {/* Re-scan Confirmation Modal */}
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
                onClick={() => { setShowRescanModal(false); handleScan() }}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 transition-colors cursor-pointer shadow-lg shadow-amber-500/25"
              >
                Continue Scanning
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    <style>{`
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
    `}</style>
    </>
  )
}
