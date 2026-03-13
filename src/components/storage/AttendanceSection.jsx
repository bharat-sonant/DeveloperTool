import { useState, useEffect, useCallback } from 'react'
import { Folder, Loader2, Calendar, FileImage, Eye, EyeOff, Trash2 } from 'lucide-react'
import { getAttendanceYears, getAttendanceMonths, getMonthEmployees, getEmployeeFiles, getFileDownloadURL, deleteStorageFiles } from '../../lib/firebase'
import { MONTH_ORDER, formatSize, formatStorageCost } from './utils'

export default function AttendanceSection({ selectedCity }) {
  const [availableYears, setAvailableYears] = useState([])
  const [loadingYears, setLoadingYears] = useState(false)
  const [monthFolders, setMonthFolders] = useState([])
  const [selectedYear, setSelectedYear] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [employees, setEmployees] = useState([])
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [empFiles, setEmpFiles] = useState([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showImages, setShowImages] = useState(false)
  const [imageUrls, setImageUrls] = useState({})
  const [selectedFiles, setSelectedFiles] = useState(new Set())
  const [loadingImages, setLoadingImages] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDeleteSelected = async () => {
    if (selectedFiles.size === 0) return
    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedFiles.size} file(s)? This action cannot be undone.`
    )
    if (!confirmed) return
    setDeleting(true)
    try {
      const { deleted, failed } = await deleteStorageFiles([...selectedFiles])
      const remainingFiles = empFiles.filter(f => !selectedFiles.has(f.fullPath) || failed.includes(f.fullPath))
      setEmpFiles(remainingFiles)
      setSelectedFiles(new Set(failed))
      if (remainingFiles.length === 0) {
        const updatedEmployees = employees.filter(e => e.id !== selectedEmployee)
        setEmployees(updatedEmployees)
        if (updatedEmployees.length > 0) {
          setSelectedEmployee(updatedEmployees[0].id)
        } else {
          setSelectedEmployee(null)
          const updatedMonths = monthFolders.filter(m => m.name !== selectedMonth)
          setMonthFolders(updatedMonths)
          if (updatedMonths.length > 0) {
            setSelectedMonth(updatedMonths[0].name)
          } else {
            setSelectedMonth(null)
            const updatedYears = availableYears.filter(y => y !== selectedYear)
            setAvailableYears(updatedYears)
            if (updatedYears.length > 0) {
              setSelectedYear(updatedYears[0])
            } else {
              setSelectedYear(null)
            }
          }
        }
      }
      if (failed.length > 0) {
        alert(`${deleted} file(s) deleted. ${failed.length} file(s) failed to delete.`)
      }
    } catch {
      alert('Failed to delete files. Please try again.')
    }
    setDeleting(false)
  }

  useEffect(() => {
    if (!selectedCity) return
    let cancelled = false
    setLoadingYears(true)
    setAvailableYears([])
    setSelectedYear(null)
    getAttendanceYears(selectedCity)
      .then(years => {
        if (cancelled) return
        setAvailableYears(years)
        if (years.length > 0) setSelectedYear(years[0])
      })
      .catch(() => { if (!cancelled) setAvailableYears([]) })
      .finally(() => { if (!cancelled) setLoadingYears(false) })
    return () => { cancelled = true }
  }, [selectedCity])

  const loadAttendance = useCallback(async () => {
    if (!selectedCity || !selectedYear) return
    setLoading(true)
    try {
      const months = await getAttendanceMonths(selectedCity, selectedYear)
      const sorted = months.sort((a, b) => MONTH_ORDER.indexOf(a.name) - MONTH_ORDER.indexOf(b.name))
      setMonthFolders(sorted)
      if (sorted.length > 0) setSelectedMonth(sorted[0].name)
    } catch {
      setMonthFolders([])
    }
    setLoading(false)
  }, [selectedCity, selectedYear])

  useEffect(() => { loadAttendance() }, [loadAttendance])
  useEffect(() => { setSelectedMonth(null); setEmployees([]); setSelectedEmployee(null); setEmpFiles([]) }, [selectedCity, selectedYear])

  useEffect(() => {
    if (!selectedCity || !selectedMonth) { setEmployees([]); setSelectedEmployee(null); return }
    let cancelled = false
    setLoadingEmployees(true)
    setSelectedEmployee(null)
    setEmpFiles([])
    getMonthEmployees(selectedCity, selectedMonth, selectedYear)
      .then(emps => {
        if (cancelled) return
        const sorted = emps.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
        setEmployees(sorted)
        if (sorted.length > 0) setSelectedEmployee(sorted[0].id)
      })
      .catch(() => { if (!cancelled) setEmployees([]) })
      .finally(() => { if (!cancelled) setLoadingEmployees(false) })
    return () => { cancelled = true }
  }, [selectedCity, selectedMonth, selectedYear])

  useEffect(() => {
    if (!selectedCity || !selectedMonth || !selectedEmployee) { setEmpFiles([]); return }
    let cancelled = false
    setLoadingFiles(true)
    setImageUrls({})
    setSelectedFiles(new Set())
    getEmployeeFiles(selectedCity, selectedMonth, selectedEmployee, selectedYear)
      .then(files => { if (!cancelled) setEmpFiles(files) })
      .catch(() => { if (!cancelled) setEmpFiles([]) })
      .finally(() => { if (!cancelled) setLoadingFiles(false) })
    return () => { cancelled = true }
  }, [selectedCity, selectedMonth, selectedEmployee, selectedYear])

  useEffect(() => {
    if (!showImages || empFiles.length === 0) return
    const toFetch = empFiles.filter(f => !imageUrls[f.fullPath])
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
  }, [showImages, empFiles])

  return (
    <div>
      {/* Header bar */}
      <div className="flex items-center justify-between pb-4 border-b border-surface-lighter">
        <div className="flex items-center gap-2.5">
          {employees.length > 0 && (() => {
            const totalBytes = employees.reduce((sum, e) => sum + e.totalSize, 0)
            return (
              <span className="text-[10px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20">
                {formatSize(totalBytes)} · {formatStorageCost(totalBytes)}
              </span>
            )
          })()}
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-text-muted" />
          {loadingYears ? (
            <Loader2 size={14} className="animate-spin text-primary" />
          ) : (
            <div className="flex gap-1">
              {availableYears.map(year => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                    selectedYear === year
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-surface border border-surface-lighter text-text-muted hover:border-primary/30'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="pt-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-primary" />
          </div>
        ) : monthFolders.length === 0 ? (
          <div className="text-center py-12 text-text-muted text-sm">No data found</div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Month strip */}
            <div className="flex items-center gap-1.5 pb-3 mb-3 border-b border-surface-lighter overflow-x-auto">
              {monthFolders.map(month => {
                const isSelected = selectedMonth === month.name
                return (
                  <button
                    key={month.name}
                    onClick={() => setSelectedMonth(isSelected ? null : month.name)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-surface border border-surface-lighter text-text-muted hover:border-primary/30 hover:text-primary'
                    }`}
                  >
                    <Folder size={14} strokeWidth={1.5} className={isSelected ? 'text-white' : 'text-amber-400'} fill="currentColor" />
                    {month.name}
                  </button>
                )
              })}
              <div className="flex items-center gap-1.5 ml-auto shrink-0">
                <span className="text-[10px] font-semibold text-primary bg-primary/8 px-2.5 py-1 rounded-md border border-primary/20">
                  {employees.length} employees
                </span>
                <span className="text-[10px] font-semibold text-accent bg-accent/10 px-2.5 py-1 rounded-md border border-accent/20">
                  {formatSize(employees.reduce((sum, e) => sum + e.totalSize, 0))}
                </span>
              </div>
            </div>

            {/* Employee + content area */}
            <div className="flex flex-1 min-h-0">
              {/* Employee list */}
              <div className="w-28 shrink-0 border-r border-surface-lighter overflow-y-auto">
                {!selectedMonth ? (
                  <div className="flex items-center justify-center h-full text-text-muted text-xs">Select a month</div>
                ) : loadingEmployees ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 size={18} className="animate-spin text-primary" />
                  </div>
                ) : employees.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-text-muted text-xs">No records</div>
                ) : (
                  <div className="flex flex-col">
                    {employees.map((emp, idx) => {
                      const isEmpSelected = selectedEmployee === emp.id
                      return (
                        <div key={emp.id}>
                          {idx > 0 && <hr className="border-surface-lighter" />}
                          <button
                            onClick={() => setSelectedEmployee(emp.id)}
                            className={`w-full px-3 py-2 text-left transition-all cursor-pointer ${
                              isEmpSelected ? 'bg-accent/12 border-r-2 border-accent' : 'hover:bg-surface-light'
                            }`}
                          >
                            <div className={`text-[11px] font-semibold ${isEmpSelected ? 'text-accent' : 'text-text'}`}>{emp.id}</div>
                            <div className={`text-[9px] mt-0.5 ${isEmpSelected ? 'text-accent/70' : 'text-text-muted'}`}>{emp.fileCount} files</div>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* File details */}
              <div className="flex-1 min-w-0 overflow-y-auto p-4 bg-white">
                {!selectedEmployee ? (
                  <div className="flex items-center justify-center h-full text-text-muted text-sm">Select an employee</div>
                ) : loadingFiles ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 size={20} className="animate-spin text-primary" />
                  </div>
                ) : empFiles.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-text-muted text-sm">No files found</div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-text">Employee {selectedEmployee}</h3>
                        <span className="text-[11px] text-text-muted bg-surface px-2 py-0.5 rounded-full border border-surface-lighter">
                          {empFiles.length} files · {formatSize(empFiles.reduce((s, f) => s + f.size, 0))}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedFiles.size > 0 && (
                          <button
                            onClick={handleDeleteSelected}
                            disabled={deleting}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 disabled:opacity-50"
                          >
                            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            {deleting ? 'Deleting...' : `Delete Selected (${selectedFiles.size})`}
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
                        <button
                          onClick={() => {
                            if (selectedFiles.size === empFiles.length) {
                              setSelectedFiles(new Set())
                            } else {
                              setSelectedFiles(new Set(empFiles.map(f => f.fullPath)))
                            }
                          }}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                            selectedFiles.size === empFiles.length && empFiles.length > 0
                              ? 'bg-primary text-white'
                              : 'bg-surface border border-surface-lighter text-text-muted hover:border-primary/30'
                          }`}
                        >
                          {selectedFiles.size === empFiles.length && empFiles.length > 0 ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>
                    </div>
                    {(() => {
                      const grouped = {}
                      empFiles.forEach(file => {
                        const match = file.name.match(/^(\d{4}-\d{2}-\d{2})/)
                        const dateKey = match ? match[1] : 'Unknown'
                        if (!grouped[dateKey]) grouped[dateKey] = []
                        grouped[dateKey].push(file)
                      })
                      const sortedDates = Object.keys(grouped).sort()
                      return (
                        <div className="grid grid-cols-5 gap-3">
                          {sortedDates.map(dateKey => (
                            <div key={dateKey} className="rounded-xl border border-surface-lighter bg-surface-light/30 overflow-hidden">
                              <div className="flex items-center justify-between px-3 py-2 bg-surface-light/50 border-b border-surface-lighter">
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
        )}
      </div>
    </div>
  )
}
