import { useState, useEffect, useRef } from 'react'
import { Loader2, FileImage, Search, RefreshCw, Calendar, Trash2, AlertTriangle, X, CheckSquare, Square, Clock } from 'lucide-react'
import { deleteStorageFiles, listAttendanceMonths, scanAttendanceCleanup, saveAttendanceScanResult, loadAttendanceScanResult, loadAttendanceCityConfig } from '../../lib/firebase'
import { MONTH_ORDER, formatSize } from './utils'
import CitySelector from '../CitySelector'
import { getCachedSectionConfig, cacheSectionConfig } from '../../lib/sectionConfig'

export default function AttendanceSection() {

  // City selection
  const cached = getCachedSectionConfig('attendance')
  const activeCities0 = cached.cities.filter(c => !cached.cleanedCities.includes(c))
  const [attCities, setAttCities] = useState(activeCities0)
  const [selectedCity, setSelectedCity] = useState(activeCities0[0] || null)


  useEffect(() => {
    const refresh = async () => {
      try {
        const remote = await loadAttendanceCityConfig()
        if (remote) {
          const active = remote.cities.filter(c => !remote.cleanedCities.includes(c))
          setAttCities(prev => JSON.stringify(prev) === JSON.stringify(active) ? prev : active)
          cacheSectionConfig('attendance', remote.cities, remote.cleanedCities)
        }
      } catch {
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
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [selectedEmployee, setSelectedEmployee] = useState(null)

  // Files from scanResult JSON (no extra Firebase calls)
  const [allDateFiles, setAllDateFiles] = useState({})
  const [selectedFiles, setSelectedFiles] = useState(new Set())
  const [deleting, setDeleting] = useState(false)

  // Month picker
  const [showRescanModal, setShowRescanModal] = useState(false)
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [availableMonths, setAvailableMonths] = useState([])
  const [pickedMonths, setPickedMonths] = useState(new Set())
  const [loadingMonths, setLoadingMonths] = useState(false)

  // Timer
  const [elapsedTime, setElapsedTime] = useState(0)
  const timerRef = useRef(null)

  // Derived
  const monthList = scanResult
    ? Object.keys(scanResult.months).sort((a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b))
    : []

  const employeeList = (scanResult && selectedMonth && scanResult.months[selectedMonth]?.employees)
    ? Object.entries(scanResult.months[selectedMonth].employees)
        .map(([id, data]) => ({ id, totalFiles: data.totalFiles }))
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
    : []

  const dateList = (scanResult && selectedMonth && selectedEmployee &&
    scanResult.months[selectedMonth]?.employees[selectedEmployee]?.dates)
    ? Object.entries(scanResult.months[selectedMonth].employees[selectedEmployee].dates)
        .sort(([a], [b]) => a.localeCompare(b))
    : []

  const allFiles = Object.values(allDateFiles).flat()

  // ── Month Picker ──

  const openMonthPicker = async () => {
    setLoadingMonths(true)
    setShowRescanModal(false)
    setShowMonthPicker(true)
    setPickedMonths(new Set())
    try {
      const folders = await listAttendanceMonths(selectedCity)
      setAvailableMonths(folders)
    } catch {
      setAvailableMonths([])
    }
    setLoadingMonths(false)
  }

  const toggleMonth = (month) => {
    setPickedMonths(prev => {
      const next = new Set(prev)
      if (next.has(month)) next.delete(month)
      else if (next.size < 3) next.add(month)
      return next
    })
  }

  const renderMonthPicker = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={() => setShowMonthPicker(false)} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-[slideUp_0.3s_ease-out]">
        <button onClick={() => setShowMonthPicker(false)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
          <X size={18} className="text-gray-400" />
        </button>
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Select Months to Scan</h3>
            <p className="text-xs text-gray-500">Choose up to <span className="font-semibold text-amber-600">3 months</span> at a time. Each month scans all employee folders.</p>
          </div>
          {loadingMonths ? (
            <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-amber-500" /><span className="text-sm text-text-muted ml-2">Loading months...</span></div>
          ) : availableMonths.length === 0 ? (
            <div className="text-center py-8 text-sm text-text-muted">No months found</div>
          ) : (
            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
              {availableMonths.map(month => {
                const isChecked = pickedMonths.has(month)
                const isDisabled = !isChecked && pickedMonths.size >= 3
                return (
                  <button key={month} onClick={() => !isDisabled && toggleMonth(month)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${isChecked ? 'bg-amber-50' : isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'}`}>
                    {isChecked ? <CheckSquare size={18} className="text-amber-500 shrink-0" /> : <Square size={18} className="text-gray-300 shrink-0" />}
                    <span className={`text-sm font-medium ${isChecked ? 'text-amber-700' : 'text-gray-700'}`}>{month}</span>
                  </button>
                )
              })}
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{pickedMonths.size}/3 selected</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowMonthPicker(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer">Cancel</button>
              <button onClick={() => handleScan([...pickedMonths])} disabled={pickedMonths.size === 0}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 transition-colors cursor-pointer shadow-lg shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed">
                Start Scan ({pickedMonths.size})
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

  const handleScan = async (months) => {
    setShowMonthPicker(false)
    setScanning(true)
    setScanProgress(null)
    setElapsedTime(0)
    timerRef.current = setInterval(() => setElapsedTime(t => t + 1), 1000)
    try {
      const result = await scanAttendanceCleanup(selectedCity, months, (progress) => {
        setScanProgress(progress)
      })
      setScanResult(result)
      const firstMonth = Object.keys(result.months)
        .sort((a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b))[0]
      if (firstMonth) {
        setSelectedMonth(firstMonth)
        setSelectedEmployee(null)
      }
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

      // Update allDateFiles
      setAllDateFiles(prev => {
        const next = {}
        for (const [date, files] of Object.entries(prev)) {
          next[date] = files.filter(f => !selectedFiles.has(f.fullPath) || failedSet.has(f.fullPath))
        }
        return next
      })
      setSelectedFiles(new Set(failed))

      // Update scanResult counts
      if (scanResult && selectedMonth && selectedEmployee && deleted > 0) {
        const next = JSON.parse(JSON.stringify(scanResult))
        const empData = next.months[selectedMonth]?.employees[selectedEmployee]
        if (empData) {
          const deletedPaths = new Set([...selectedFiles].filter(p => !failedSet.has(p)))
          for (const [date, dateData] of Object.entries(empData.dates || {})) {
            if (dateData.filesMeta) {
              dateData.filesMeta = dateData.filesMeta.filter(f => !deletedPaths.has(f.fullPath))
            }
            dateData.files = dateData.filesMeta?.length || 0
            if (dateData.files <= 0) delete empData.dates[date]
          }
          empData.totalFiles = Object.values(empData.dates || {}).reduce((s, d) => s + d.files, 0)
          if (empData.totalFiles <= 0) delete next.months[selectedMonth].employees[selectedEmployee]

          const monthData = next.months[selectedMonth]
          if (monthData) {
            monthData.totalFiles = Object.values(monthData.employees || {}).reduce((s, e) => s + e.totalFiles, 0)
            if (monthData.totalFiles <= 0) delete next.months[selectedMonth]
          }
          next.totalFiles = Object.values(next.months || {}).reduce((s, m) => s + m.totalFiles, 0)
        }
        setScanResult(next)
        saveAttendanceScanResult(selectedCity, next).catch(() => {})
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

  // Load scan result when city changes
  useEffect(() => {
    if (!selectedCity) { setLoadingScanResult(false); return }
    setLoadingScanResult(true)
    setScanResult(null)
    setSelectedMonth(null)
    setSelectedEmployee(null)
    setAllDateFiles({})
    loadAttendanceScanResult(selectedCity).then(cached => {
      if (cached) {
        setScanResult(cached)
        const firstMonth = Object.keys(cached.months || {})
          .sort((a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b))[0]
        if (firstMonth) setSelectedMonth(firstMonth)
      }
    }).finally(() => setLoadingScanResult(false))
  }, [selectedCity])

  // Auto-select first employee when month changes
  useEffect(() => {
    if (employeeList.length > 0 && !employeeList.find(e => e.id === selectedEmployee)) {
      setSelectedEmployee(employeeList[0].id)
    }
  }, [selectedMonth, employeeList.length])

  // Load files from scanResult JSON — NO Firebase hit
  useEffect(() => {
    if (!selectedCity || !selectedMonth || !selectedEmployee || !scanResult) {
      setAllDateFiles({})
      return
    }
    setSelectedFiles(new Set())
    const empData = scanResult.months[selectedMonth]?.employees[selectedEmployee]
    if (!empData?.dates) {
      setAllDateFiles({})
      return
    }
    const map = {}
    for (const [date, dateData] of Object.entries(empData.dates)) {
      map[date] = dateData.filesMeta || []
    }
    setAllDateFiles(map)
  }, [selectedCity, selectedMonth, selectedEmployee, scanResult])


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
        <CitySelector cities={attCities} selectedCity={selectedCity} onSelect={setSelectedCity} compact />
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
          <Search size={28} className="text-amber-500" />
        </div>
        <div className="text-center">
          <h3 className="text-sm font-semibold text-text mb-1">No Scan Data</h3>
          <p className="text-xs text-text-muted mb-1">Scan attendance folders to find old files for cleanup</p>
        </div>
        <button
          onClick={openMonthPicker}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 transition-all cursor-pointer shadow-sm"
        >
          <Search size={16} />
          Scan Attendance
        </button>
      </div>
      {showMonthPicker && renderMonthPicker()}
      </>
    )
  }

  if (scanning) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 size={28} className="animate-spin text-amber-500" />

        {scanProgress?.month && (
          <div className="text-center">
            <span className="text-xs text-text-muted">Month</span>
            <span className="text-sm font-bold text-amber-600 ml-1.5">{scanProgress.month}</span>
          </div>
        )}

        {scanProgress?.employee && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted">Employee</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {scanProgress.employee}
            </span>
          </div>
        )}

        <div className="flex items-center gap-4 text-[11px]">
          <div className="flex items-center gap-1.5 text-text-muted">
            <Clock size={12} />
            <span className="font-semibold text-amber-700">{formatElapsed(elapsedTime)}</span>
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
      background: 'conic-gradient(from var(--border-angle, 0deg), #f59e0b, #f97316, #ef4444, #f59e0b)',
      animation: 'spin-border 3s linear infinite'
    }}>
    <style>{`@keyframes spin-border { to { --border-angle: 360deg; } } @property --border-angle { syntax: "<angle>"; initial-value: 0deg; inherits: false; }`}</style>
    <div className="flex flex-col h-full rounded-[10px] overflow-hidden bg-white">
      {/* Top strip */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-lighter bg-surface">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text">Attendance</h3>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 border border-amber-500/20">
            {scanResult.totalFiles} files
          </span>
        </div>
        <div className="flex items-center gap-2">
          {scanResult.scannedAt && (
            <span className="text-[9px] text-text-muted">{timeAgo(scanResult.scannedAt)}</span>
          )}
          <button
            onClick={() => setShowRescanModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer bg-amber-500/10 text-amber-600 border border-amber-500/20 hover:bg-amber-500/20"
          >
            <RefreshCw size={12} />
            Re Scan
          </button>
          <div className="w-px h-5 bg-surface-lighter" />
          <CitySelector cities={attCities} selectedCity={selectedCity} onSelect={setSelectedCity} compact />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Employee list */}
        <div className="w-22 shrink-0 border-r border-surface-lighter flex flex-col bg-gray-100">
          <div className="flex-1 overflow-y-auto">
            {employeeList.length === 0 ? (
              <div className="flex items-center justify-center h-full text-text-muted text-xs">No employees</div>
            ) : (
              <div className="flex flex-col">
                {employeeList.map((emp, idx) => {
                  const isSelected = selectedEmployee === emp.id
                  return (
                    <div key={emp.id}>
                      {idx > 0 && <hr className="border-surface-lighter" />}
                      <button
                        onClick={() => { setSelectedEmployee(emp.id); setAllDateFiles({}) }}
                        className={`w-full px-3 py-2.5 text-left transition-all cursor-pointer ${
                          isSelected ? 'bg-gray-200 border-r-2 border-gray-500' : 'hover:bg-gray-200/50'
                        }`}
                      >
                        <div className={`text-[11px] font-semibold truncate ${isSelected ? 'text-gray-800' : 'text-text'}`}>
                          {emp.id}
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
          {!selectedMonth ? (
            <div className="flex items-center justify-center h-full text-text-muted text-sm">Select a month</div>
          ) : (
            <>
              <div className="px-4 pt-3 space-y-3">
                {/* Month pills */}
                <div className="flex items-center gap-2 flex-wrap">
                  {monthList.map(month => {
                    const isActive = selectedMonth === month
                    const mData = scanResult.months[month]
                    return (
                      <button
                        key={month}
                        onClick={() => { setSelectedMonth(month); setSelectedEmployee(null); setAllDateFiles({}) }}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                          isActive ? 'bg-primary text-white shadow-sm' : 'bg-primary/8 text-primary border border-primary/20 hover:bg-primary/15'
                        }`}
                      >
                        {month} ({mData.totalFiles})
                      </button>
                    )
                  })}
                  {selectedEmployee && Object.keys(allDateFiles).length > 0 && (
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
              {selectedEmployee ? (
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
                                  {files.map(file => {
                                    const type = file.source === 'in' ? 'In' : file.source === 'out' ? 'Out' : '—'
                                    return (
                                      <div
                                        key={file.fullPath}
                                        className="flex-shrink-0 flex flex-col gap-0.5 p-1 rounded-md bg-surface-light/50 border border-surface-lighter hover:border-primary/30 transition-all group overflow-hidden"
                                      >
                                        {file.url ? (
                                          <img src={file.url} alt="" className="w-[80px] h-[80px] object-cover rounded bg-surface" loading="lazy" />
                                        ) : (
                                          <div className="flex flex-col items-center justify-center w-[80px] h-[80px] bg-surface-light rounded">
                                            <FileImage size={12} className="text-primary/40 group-hover:text-primary/70 transition-colors" />
                                            <span className="text-[8px] text-text-muted mt-1">{formatSize(file.size)}</span>
                                            <span className={`text-[7px] font-medium mt-0.5 ${
                                              type === 'In' ? 'text-emerald-600' : type === 'Out' ? 'text-orange-600' : 'text-gray-400'
                                            }`}>{type}</span>
                                          </div>
                                        )}
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
              ) : (
                <div className="flex items-center justify-center flex-1 text-text-muted text-sm">Select an employee</div>
              )}
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
                This scans <span className="font-semibold text-amber-600">all employee folders</span> per month.
                It will take <span className="font-semibold">significantly longer</span> for months with many employees.
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
                <p className="text-xs text-amber-800 text-left">Selected months will be replaced with fresh data, other months stay intact</p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full pt-2">
              <button onClick={() => setShowRescanModal(false)} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer">
                Cancel
              </button>
              <button onClick={openMonthPicker} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 transition-colors cursor-pointer shadow-lg shadow-amber-500/25">
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {showMonthPicker && renderMonthPicker()}

    <style>{`
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
    `}</style>
    </>
  )
}
