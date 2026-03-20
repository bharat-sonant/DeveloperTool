import { initializeApp } from 'firebase/app'
import { getDatabase, ref, get, query, orderByKey, limitToFirst } from 'firebase/database'
import { getStorage, ref as storageRef, listAll, getMetadata, getDownloadURL, deleteObject, uploadString, getBytes } from 'firebase/storage'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isConfigured = Boolean(firebaseConfig.projectId && firebaseConfig.databaseURL)

let app = null
let db = null
let storage = null

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig)
    db = getDatabase(app)
    storage = getStorage(app)
  } catch (e) {
    console.error('Firebase init failed:', e)
  }
}

export { db, storage }

// ── Realtime DB helpers ──

function ensureDb() {
  if (!db) throw new Error('Firebase not configured — add .env file')
}
function ensureStorage() {
  if (!storage) throw new Error('Firebase not configured — add .env file')
}

export async function getDbNodeSize(path) {
  ensureDb()
  const snapshot = await get(ref(db, path))
  if (!snapshot.exists()) return { exists: false, count: 0, sizeBytes: 0 }
  const data = snapshot.val()
  const json = JSON.stringify(data)
  const count = typeof data === 'object' && data !== null ? Object.keys(data).length : 1
  return { exists: true, count, sizeBytes: new Blob([json]).size }
}

export async function getDbChildren(path) {
  ensureDb()
  const snapshot = await get(ref(db, path))
  if (!snapshot.exists()) return []
  const data = snapshot.val()
  if (typeof data !== 'object' || data === null) return []
  return Object.keys(data)
}

export async function getDbNodePreview(path, limit = 5) {
  ensureDb()
  const snapshot = await get(query(ref(db, path), orderByKey(), limitToFirst(limit)))
  if (!snapshot.exists()) return null
  return snapshot.val()
}

// ── Storage helpers ──

export async function listStorageFolder(path) {
  ensureStorage()
  const folderRef = storageRef(storage, path)
  const result = await listAll(folderRef)
  return {
    folders: result.prefixes.map(p => ({ name: p.name, fullPath: p.fullPath })),
    files: result.items.map(i => ({ name: i.name, fullPath: i.fullPath })),
  }
}

// Pick a smart sample from an array: first 2, middle 1, last 2 (max 5)
function smartSample(arr, max = 5) {
  if (arr.length <= max) return arr
  const mid = Math.floor(arr.length / 2)
  const indices = new Set([0, 1, mid, arr.length - 2, arr.length - 1])
  return [...indices].sort((a, b) => a - b).map(i => arr[i])
}

export async function getAttendanceYears(cityPath) {
  ensureStorage()
  const basePath = `${cityPath}/AttendanceManagement`
  const result = await listAll(storageRef(storage, basePath))
  const years = new Set()

  // Check each month, but only sample ~5 employees per month
  const checks = result.prefixes.map(async (monthPrefix) => {
    try {
      const monthResult = await listAll(storageRef(storage, monthPrefix.fullPath))
      const sampled = smartSample(monthResult.prefixes)
      const empChecks = sampled.map(async (empPrefix) => {
        const files = await listAll(storageRef(storage, empPrefix.fullPath))
        files.items.forEach(f => {
          const match = f.name.match(/^(\d{4})-/)
          if (match) years.add(Number(match[1]))
        })
      })
      await Promise.all(empChecks)
    } catch { /* skip */ }
  })
  await Promise.all(checks)

  return [...years].sort((a, b) => a - b)
}

export async function getAttendanceMonths(cityPath, year) {
  ensureStorage()
  const basePath = `${cityPath}/AttendanceManagement`
  const result = await listAll(storageRef(storage, basePath))
  const yearStr = String(year)

  // Check each month in parallel — sample employees' filenames for year match
  const checks = result.prefixes.map(async (monthPrefix) => {
    try {
      // List employee folders inside this month
      const monthResult = await listAll(storageRef(storage, monthPrefix.fullPath))
      if (monthResult.prefixes.length === 0) return null

      // Sample ~5 employees — filenames start with YYYY-MM-DD
      const sample = smartSample(monthResult.prefixes)
      const empChecks = sample.map(async (empPrefix) => {
        const files = await listAll(storageRef(storage, empPrefix.fullPath))
        return files.items.some(f => f.name.startsWith(yearStr))
      })

      const results = await Promise.all(empChecks)
      if (results.some(Boolean)) {
        return { name: monthPrefix.name, fullPath: monthPrefix.fullPath }
      }
      return null
    } catch {
      return null
    }
  })

  return (await Promise.all(checks)).filter(Boolean)
}

export async function getMonthEmployees(cityPath, month) {
  ensureStorage()
  const basePath = `${cityPath}/AttendanceManagement/${month}`
  const result = await listAll(storageRef(storage, basePath))

  // Just return employee folder names — no metadata fetching
  return result.prefixes.map(p => ({ id: p.name }))
}

export async function checkMonthHasData(cityPath, month) {
  ensureStorage()
  const basePath = `${cityPath}/AttendanceManagement/${month}`
  try {
    const result = await listAll(storageRef(storage, basePath))
    return { hasData: result.prefixes.length > 0, employeeCount: result.prefixes.length }
  } catch {
    return { hasData: false, employeeCount: 0 }
  }
}

export async function getEmployeeFiles(cityPath, month, employeeId) {
  ensureStorage()
  const basePath = `${cityPath}/AttendanceManagement/${month}/${employeeId}`
  console.log(`[Storage:getEmployeeFiles] listAll → ${basePath}`)
  const result = await listAll(storageRef(storage, basePath))
  console.log(`[Storage:getEmployeeFiles] ${result.items.length} files found, fetching metadata...`)

  // Get metadata for all files in parallel
  const metas = await Promise.all(result.items.map(f => {
    console.log(`[Storage:getEmployeeFiles] getMetadata → ${f.name}`)
    return getMetadata(f)
  }))
  console.log(`[Storage:getEmployeeFiles] Done. ${metas.length} metadata fetched`)
  return metas.map(m => ({
    name: m.name,
    fullPath: m.fullPath,
    size: m.size,
    contentType: m.contentType,
    timeCreated: m.timeCreated,
    updated: m.updated,
  }))
}

export async function getFileDownloadURL(fullPath) {
  ensureStorage()
  console.log(`[Storage:getFileDownloadURL] getDownloadURL → ${fullPath}`)
  return getDownloadURL(storageRef(storage, fullPath))
}

export async function deleteStorageFiles(fullPaths) {
  ensureStorage()
  console.log(`[Storage:deleteStorageFiles] Deleting ${fullPaths.length} files...`)
  fullPaths.forEach(p => console.log(`[Storage:deleteStorageFiles] deleteObject → ${p}`))
  const results = await Promise.allSettled(
    fullPaths.map(p => deleteObject(storageRef(storage, p)))
  )
  const failed = results
    .map((r, i) => r.status === 'rejected' ? fullPaths[i] : null)
    .filter(Boolean)
  console.log(`[Storage:deleteStorageFiles] Done. Deleted: ${fullPaths.length - failed.length}, Failed: ${failed.length}`)
  return { deleted: fullPaths.length - failed.length, failed }
}

// ── Scan Cleanup ──

export async function scanAttendanceCleanup(cityPath, onProgress) {
  ensureStorage()
  const basePath = `${cityPath}/AttendanceManagement`
  console.log(`[Storage:scanAttendance] listAll → ${basePath}`)
  const monthsResult = await listAll(storageRef(storage, basePath))
  const monthFolders = monthsResult.prefixes.map(p => p.name).sort()
  console.log(`[Storage:scanAttendance] ${monthFolders.length} month folders found:`, monthFolders)

  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const frozenPrefixes = new Set()
  for (let i = 0; i < 3; i++) {
    let mo = m - i, yr = y
    if (mo <= 0) { mo += 12; yr -= 1 }
    frozenPrefixes.add(`${yr}-${String(mo).padStart(2, '0')}`)
  }

  const result = {
    city: cityPath,
    scannedAt: now.toISOString(),
    totalFiles: 0,
    months: {},
  }

  let scannedMonths = 0
  for (const month of monthFolders) {
    if (month === 'cleanupScanResult.json') continue
    console.log(`[Storage:scanAttendance] listAll → ${basePath}/${month}`)
    const empResult = await listAll(storageRef(storage, `${basePath}/${month}`))
    const empFolders = empResult.prefixes
    console.log(`[Storage:scanAttendance] ${month}: ${empFolders.length} employee folders`)

    const monthData = { totalFiles: 0, years: {}, employees: {} }

    for (const empRef of empFolders) {
      console.log(`[Storage:scanAttendance] listAll → ${empRef.fullPath}`)
      const filesResult = await listAll(storageRef(storage, empRef.fullPath))
      const empId = empRef.name
      console.log(`[Storage:scanAttendance] ${month}/${empId}: ${filesResult.items.length} files`)
      const empData = { files: 0, dates: {} }

      for (const fileItem of filesResult.items) {
        const fullMatch = fileItem.name.match(/^(\d{4})-(\d{2})-(\d{2})/)
        if (!fullMatch) continue
        const yearMonth = `${fullMatch[1]}-${fullMatch[2]}`
        if (frozenPrefixes.has(yearMonth)) continue

        const dateStr = `${fullMatch[1]}-${fullMatch[2]}-${fullMatch[3]}`
        const yearStr = fullMatch[1]
        const type = fileItem.name.includes('InImage') ? 'in' : fileItem.name.includes('outImage') ? 'out' : 'other'

        empData.files++

        if (!empData.dates[dateStr]) empData.dates[dateStr] = { in: false, out: false, other: 0 }
        if (type === 'in') empData.dates[dateStr].in = true
        else if (type === 'out') empData.dates[dateStr].out = true
        else empData.dates[dateStr].other++

        if (!monthData.years[yearStr]) monthData.years[yearStr] = { files: 0 }
        monthData.years[yearStr].files++
      }

      if (empData.files > 0) {
        monthData.employees[empId] = empData
        monthData.totalFiles += empData.files
      }
    }

    if (monthData.totalFiles > 0) {
      result.months[month] = monthData
      result.totalFiles += monthData.totalFiles
    }

    scannedMonths++
    if (onProgress) onProgress({ scannedMonths, totalMonths: monthFolders.length, currentMonth: month })
  }

  return result
}

export async function saveCleanupResult(cityPath, data) {
  ensureStorage()
  const filePath = `${cityPath}/AttendanceManagement/cleanupScanResult.json`
  console.log(`[Storage:saveCleanupResult] uploadString → ${filePath}`)
  const fileRef = storageRef(storage, filePath)
  await uploadString(fileRef, JSON.stringify(data), 'raw', { contentType: 'application/json' })
  console.log(`[Storage:saveCleanupResult] Saved successfully`)
}

export async function loadCleanupResult(cityPath) {
  ensureStorage()
  const path = `${cityPath}/AttendanceManagement/cleanupScanResult.json`
  console.log(`[Storage:loadCleanupResult] getBytes → ${path}`)
  try {
    const fileRef = storageRef(storage, path)
    const bytes = await getBytes(fileRef)
    const text = new TextDecoder().decode(bytes)
    const data = JSON.parse(text)
    console.log(`[Storage:loadCleanupResult] Loaded. ${data.totalFiles} total files, ${Object.keys(data.months || {}).length} months`)
    return data
  } catch {
    console.log(`[Storage:loadCleanupResult] No cached result found`)
    return null
  }
}

// ── DutyOn Scan ──
// Structure: {city}/DutyOnImages/{ward}/{year}/{month}/{date}/{images}

// List top-level folders inside a storage path (for ward/folder picker)
export async function listStorageFolders(path) {
  ensureStorage()
  const result = await listAll(storageRef(storage, path))
  return result.prefixes.map(p => p.name).filter(n => !n.endsWith('.json')).sort()
}

export async function scanDutyOnImages(cityPath, onProgress, selectedWards) {
  ensureStorage()
  const basePath = `${cityPath}/DutyOnImages`
  const wardsResult = await listAll(storageRef(storage, basePath))
  const wardFolders = wardsResult.prefixes.map(p => p.name).sort()
  const wardsToScan = selectedWards ? wardFolders.filter(w => selectedWards.includes(w)) : wardFolders

  const result = {
    city: cityPath,
    scannedAt: new Date().toISOString(),
    totalFiles: 0,
    wards: {},
  }

  let scannedWards = 0
  for (const ward of wardsToScan) {
    if (ward === 'dutyOnScanResult.json') continue
    const wardData = { totalFiles: 0, years: {} }

    const yearsResult = await listAll(storageRef(storage, `${basePath}/${ward}`))
    for (const yearRef of yearsResult.prefixes) {
      const year = yearRef.name
      const yearData = { totalFiles: 0, months: {} }

      const monthsResult = await listAll(storageRef(storage, yearRef.fullPath))
      for (const monthRef of monthsResult.prefixes) {
        const month = monthRef.name
        const monthData = { totalFiles: 0, dates: {} }

        const datesResult = await listAll(storageRef(storage, monthRef.fullPath))
        for (const dateRef of datesResult.prefixes) {
          const date = dateRef.name
          const filesResult = await listAll(storageRef(storage, dateRef.fullPath))
          const fileCount = filesResult.items.length
          if (fileCount > 0) {
            monthData.dates[date] = { files: fileCount }
            monthData.totalFiles += fileCount
          }
        }

        if (monthData.totalFiles > 0) {
          yearData.months[month] = monthData
          yearData.totalFiles += monthData.totalFiles
        }
      }

      if (yearData.totalFiles > 0) {
        wardData.years[year] = yearData
        wardData.totalFiles += yearData.totalFiles
      }
    }

    if (wardData.totalFiles > 0) {
      result.wards[ward] = wardData
      result.totalFiles += wardData.totalFiles
    }

    scannedWards++
    if (onProgress) onProgress({ scannedWards, totalWards: wardsToScan.length, currentWard: ward })
  }

  return result
}

export async function saveDutyOnScanResult(cityPath, data) {
  ensureStorage()
  const filePath = `${cityPath}/DutyOnImages/dutyOnScanResult.json`
  const fileRef = storageRef(storage, filePath)
  await uploadString(fileRef, JSON.stringify(data), 'raw', { contentType: 'application/json' })
}

export async function loadDutyOnScanResult(cityPath) {
  ensureStorage()
  try {
    const fileRef = storageRef(storage, `${cityPath}/DutyOnImages/dutyOnScanResult.json`)
    const bytes = await getBytes(fileRef)
    const text = new TextDecoder().decode(bytes)
    return JSON.parse(text)
  } catch {
    return null
  }
}

export async function getDutyOnDateFiles(cityPath, ward, year, month, date) {
  ensureStorage()
  const basePath = `${cityPath}/DutyOnImages/${ward}/${year}/${month}/${date}`
  const result = await listAll(storageRef(storage, basePath))
  const metas = await Promise.all(result.items.map(f => getMetadata(f)))
  return metas.map(m => ({
    name: m.name,
    fullPath: m.fullPath,
    size: m.size,
    contentType: m.contentType,
    timeCreated: m.timeCreated,
    updated: m.updated,
  }))
}

// ── DutyOff Scan ──
// Structure: {city}/DutyOutImages/{ward}/{year}/{month}/{date}/{images}

export async function scanDutyOffImages(cityPath, onProgress, selectedWards) {
  ensureStorage()
  const basePath = `${cityPath}/DutyOutImages`
  const wardsResult = await listAll(storageRef(storage, basePath))
  const allWards = wardsResult.prefixes.map(p => p.name).sort()
  const wardFolders = selectedWards ? allWards.filter(w => selectedWards.includes(w)) : allWards

  const result = {
    city: cityPath,
    scannedAt: new Date().toISOString(),
    totalFiles: 0,
    wards: {},
  }

  let scannedWards = 0
  for (const ward of wardFolders) {
    if (ward === 'dutyOffScanResult.json') continue
    const wardData = { totalFiles: 0, years: {} }

    const yearsResult = await listAll(storageRef(storage, `${basePath}/${ward}`))
    for (const yearRef of yearsResult.prefixes) {
      const year = yearRef.name
      const yearData = { totalFiles: 0, months: {} }

      const monthsResult = await listAll(storageRef(storage, yearRef.fullPath))
      for (const monthRef of monthsResult.prefixes) {
        const month = monthRef.name
        const monthData = { totalFiles: 0, dates: {} }

        const datesResult = await listAll(storageRef(storage, monthRef.fullPath))
        for (const dateRef of datesResult.prefixes) {
          const date = dateRef.name
          const filesResult = await listAll(storageRef(storage, dateRef.fullPath))
          const fileCount = filesResult.items.length
          if (fileCount > 0) {
            monthData.dates[date] = { files: fileCount }
            monthData.totalFiles += fileCount
          }
        }

        if (monthData.totalFiles > 0) {
          yearData.months[month] = monthData
          yearData.totalFiles += monthData.totalFiles
        }
      }

      if (yearData.totalFiles > 0) {
        wardData.years[year] = yearData
        wardData.totalFiles += yearData.totalFiles
      }
    }

    if (wardData.totalFiles > 0) {
      result.wards[ward] = wardData
      result.totalFiles += wardData.totalFiles
    }

    scannedWards++
    if (onProgress) onProgress({ scannedWards, totalWards: wardFolders.length, currentWard: ward })
  }

  return result
}

export async function saveDutyOffScanResult(cityPath, data) {
  ensureStorage()
  const filePath = `${cityPath}/DutyOutImages/dutyOffScanResult.json`
  const fileRef = storageRef(storage, filePath)
  await uploadString(fileRef, JSON.stringify(data), 'raw', { contentType: 'application/json' })
}

export async function loadDutyOffScanResult(cityPath) {
  ensureStorage()
  try {
    const fileRef = storageRef(storage, `${cityPath}/DutyOutImages/dutyOffScanResult.json`)
    const bytes = await getBytes(fileRef)
    const text = new TextDecoder().decode(bytes)
    return JSON.parse(text)
  } catch {
    return null
  }
}

export async function getDutyOffDateFiles(cityPath, ward, year, month, date) {
  ensureStorage()
  const basePath = `${cityPath}/DutyOutImages/${ward}/${year}/${month}/${date}`
  const result = await listAll(storageRef(storage, basePath))
  const metas = await Promise.all(result.items.map(f => getMetadata(f)))
  return metas.map(m => ({
    name: m.name,
    fullPath: m.fullPath,
    size: m.size,
    contentType: m.contentType,
    timeCreated: m.timeCreated,
    updated: m.updated,
  }))
}

// ── SkipLine Scan ──
// Structure: {city}/SkipData/{ward}/{year}/{month}/{date}/{images}

export async function scanSkipLineImages(cityPath, onProgress, selectedWards) {
  ensureStorage()
  const basePath = `${cityPath}/SkipData`
  const wardsResult = await listAll(storageRef(storage, basePath))
  const allWards = wardsResult.prefixes.map(p => p.name).sort()
  const wardFolders = selectedWards ? allWards.filter(w => selectedWards.includes(w)) : allWards

  const result = {
    city: cityPath,
    scannedAt: new Date().toISOString(),
    totalFiles: 0,
    wards: {},
  }

  let scannedWards = 0
  for (const ward of wardFolders) {
    if (ward === 'skipLineScanResult.json') continue
    const wardData = { totalFiles: 0, years: {} }

    const yearsResult = await listAll(storageRef(storage, `${basePath}/${ward}`))
    for (const yearRef of yearsResult.prefixes) {
      const year = yearRef.name
      const yearData = { totalFiles: 0, months: {} }

      const monthsResult = await listAll(storageRef(storage, yearRef.fullPath))
      for (const monthRef of monthsResult.prefixes) {
        const month = monthRef.name
        const monthData = { totalFiles: 0, dates: {} }

        const datesResult = await listAll(storageRef(storage, monthRef.fullPath))
        for (const dateRef of datesResult.prefixes) {
          const date = dateRef.name
          const filesResult = await listAll(storageRef(storage, dateRef.fullPath))
          const fileCount = filesResult.items.length
          if (fileCount > 0) {
            monthData.dates[date] = { files: fileCount }
            monthData.totalFiles += fileCount
          }
        }

        if (monthData.totalFiles > 0) {
          yearData.months[month] = monthData
          yearData.totalFiles += monthData.totalFiles
        }
      }

      if (yearData.totalFiles > 0) {
        wardData.years[year] = yearData
        wardData.totalFiles += yearData.totalFiles
      }
    }

    if (wardData.totalFiles > 0) {
      result.wards[ward] = wardData
      result.totalFiles += wardData.totalFiles
    }

    scannedWards++
    if (onProgress) onProgress({ scannedWards, totalWards: wardFolders.length, currentWard: ward })
  }

  return result
}

export async function saveSkipLineScanResult(cityPath, data) {
  ensureStorage()
  const filePath = `${cityPath}/SkipData/skipLineScanResult.json`
  const fileRef = storageRef(storage, filePath)
  await uploadString(fileRef, JSON.stringify(data), 'raw', { contentType: 'application/json' })
}

export async function loadSkipLineScanResult(cityPath) {
  ensureStorage()
  try {
    const fileRef = storageRef(storage, `${cityPath}/SkipData/skipLineScanResult.json`)
    const bytes = await getBytes(fileRef)
    const text = new TextDecoder().decode(bytes)
    return JSON.parse(text)
  } catch {
    return null
  }
}

export async function getSkipLineDateFiles(cityPath, ward, year, month, date) {
  ensureStorage()
  const basePath = `${cityPath}/SkipData/${ward}/${year}/${month}/${date}`
  const result = await listAll(storageRef(storage, basePath))
  const metas = await Promise.all(result.items.map(f => getMetadata(f)))
  return metas.map(m => ({
    name: m.name,
    fullPath: m.fullPath,
    size: m.size,
    contentType: m.contentType,
    timeCreated: m.timeCreated,
    updated: m.updated,
  }))
}

// ── LogBook Scan ──
// Structure: {city}/LogBookImages/{ward}/{year}/{month}/{date}/{images}

export async function scanLogBookImages(cityPath, onProgress, selectedWards) {
  ensureStorage()
  const basePath = `${cityPath}/LogBookImages`
  const wardsResult = await listAll(storageRef(storage, basePath))
  const allWards = wardsResult.prefixes.map(p => p.name).sort()
  const wardFolders = selectedWards ? allWards.filter(w => selectedWards.includes(w)) : allWards

  const result = {
    city: cityPath,
    scannedAt: new Date().toISOString(),
    totalFiles: 0,
    wards: {},
  }

  let scannedWards = 0
  for (const ward of wardFolders) {
    if (ward === 'logBookScanResult.json') continue
    const wardData = { totalFiles: 0, years: {} }

    const yearsResult = await listAll(storageRef(storage, `${basePath}/${ward}`))
    for (const yearRef of yearsResult.prefixes) {
      const year = yearRef.name
      const yearData = { totalFiles: 0, months: {} }

      const monthsResult = await listAll(storageRef(storage, yearRef.fullPath))
      for (const monthRef of monthsResult.prefixes) {
        const month = monthRef.name
        const monthData = { totalFiles: 0, dates: {} }

        const datesResult = await listAll(storageRef(storage, monthRef.fullPath))
        for (const dateRef of datesResult.prefixes) {
          const date = dateRef.name
          const filesResult = await listAll(storageRef(storage, dateRef.fullPath))
          const fileCount = filesResult.items.length
          if (fileCount > 0) {
            monthData.dates[date] = { files: fileCount }
            monthData.totalFiles += fileCount
          }
        }

        if (monthData.totalFiles > 0) {
          yearData.months[month] = monthData
          yearData.totalFiles += monthData.totalFiles
        }
      }

      if (yearData.totalFiles > 0) {
        wardData.years[year] = yearData
        wardData.totalFiles += yearData.totalFiles
      }
    }

    if (wardData.totalFiles > 0) {
      result.wards[ward] = wardData
      result.totalFiles += wardData.totalFiles
    }

    scannedWards++
    if (onProgress) onProgress({ scannedWards, totalWards: wardFolders.length, currentWard: ward })
  }

  return result
}

export async function saveLogBookScanResult(cityPath, data) {
  ensureStorage()
  const filePath = `${cityPath}/LogBookImages/logBookScanResult.json`
  const fileRef = storageRef(storage, filePath)
  await uploadString(fileRef, JSON.stringify(data), 'raw', { contentType: 'application/json' })
}

export async function loadLogBookScanResult(cityPath) {
  ensureStorage()
  try {
    const fileRef = storageRef(storage, `${cityPath}/LogBookImages/logBookScanResult.json`)
    const bytes = await getBytes(fileRef)
    const text = new TextDecoder().decode(bytes)
    return JSON.parse(text)
  } catch {
    return null
  }
}

export async function getLogBookDateFiles(cityPath, ward, year, month, date) {
  ensureStorage()
  const basePath = `${cityPath}/LogBookImages/${ward}/${year}/${month}/${date}`
  const result = await listAll(storageRef(storage, basePath))
  const metas = await Promise.all(result.items.map(f => getMetadata(f)))
  return metas.map(m => ({
    name: m.name,
    fullPath: m.fullPath,
    size: m.size,
    contentType: m.contentType,
    timeCreated: m.timeCreated,
    updated: m.updated,
  }))
}

// ── DutyOnOff Combined Scan ──
// Scans 4 sources: DutyOnImages, DutyOutImages, DutyOnMeterReadingImages, DutyOutMeterReadingImages
// All share structure: {city}/{source}/{ward}/{year}/{month}/{date}/{images}

const DUTY_ONOFF_SOURCES = ['DutyOnImages', 'DutyOutImages', 'DutyOnMeterReadingImages', 'DutyOutMeterReadingImages']

// Get union of wards across all 4 duty sources
export async function listDutyOnOffWards(cityPath) {
  ensureStorage()
  const wardSet = new Set()
  for (const source of DUTY_ONOFF_SOURCES) {
    try {
      const result = await listAll(storageRef(storage, `${cityPath}/${source}`))
      console.log(`[DutyOnOff] ${source}: found ${result.prefixes.length} ward folders`)
      result.prefixes.forEach(p => {
        if (!p.name.endsWith('.json')) wardSet.add(p.name)
      })
    } catch (err) {
      console.warn(`[DutyOnOff] Failed to list wards for ${source}:`, err.message)
    }
  }
  console.log(`[DutyOnOff] Total unique wards:`, [...wardSet])
  return [...wardSet].sort()
}

export async function scanDutyOnOffImages(cityPath, onProgress, selectedWards) {
  ensureStorage()
  const allWards = await listDutyOnOffWards(cityPath)
  const wardsToScan = selectedWards ? allWards.filter(w => selectedWards.includes(w)) : allWards

  const result = {
    city: cityPath,
    scannedAt: new Date().toISOString(),
    totalFiles: 0,
    wards: {},
  }

  const totalSteps = wardsToScan.length * DUTY_ONOFF_SOURCES.length
  let completedSteps = 0
  let apiHits = 0

  for (const ward of wardsToScan) {
    const wardData = result.wards[ward] || { totalFiles: 0, years: {} }

    for (const source of DUTY_ONOFF_SOURCES) {
      const basePath = `${cityPath}/${source}/${ward}`
      console.log(`[DutyOnOff] Scanning: ${basePath}`)

      try {
        apiHits++
        const yearsResult = await listAll(storageRef(storage, basePath))
        console.log(`[DutyOnOff] [Hit #${apiHits}] ${source}/${ward}: ${yearsResult.prefixes.length} years found`)

        for (const yearRef of yearsResult.prefixes) {
          const year = yearRef.name
          if (!wardData.years[year]) wardData.years[year] = { totalFiles: 0, months: {} }
          const yearData = wardData.years[year]

          apiHits++
          const monthsResult = await listAll(storageRef(storage, yearRef.fullPath))
          console.log(`[DutyOnOff] [Hit #${apiHits}] ${source}/${ward}/${year}: ${monthsResult.prefixes.length} months`)

          for (const monthRef of monthsResult.prefixes) {
            const month = monthRef.name
            if (!yearData.months[month]) yearData.months[month] = { totalFiles: 0, dates: {} }
            const monthData = yearData.months[month]

            apiHits++
            const datesResult = await listAll(storageRef(storage, monthRef.fullPath))
            console.log(`[DutyOnOff] [Hit #${apiHits}] ${source}/${ward}/${year}/${month}: ${datesResult.prefixes.length} dates`)

            // Scan all dates in parallel for speed
            const datePromises = datesResult.prefixes.map(async (dateRef) => {
              const date = dateRef.name
              apiHits++
              const hitNum = apiHits
              const filesResult = await listAll(storageRef(storage, dateRef.fullPath))
              const fileCount = filesResult.items.length
              console.log(`[DutyOnOff] [Hit #${hitNum}] ${source}/${ward}/${year}/${month}/${date}: ${fileCount} files`)
              return { date, fileCount }
            })
            const dateResults = await Promise.all(datePromises)

            for (const { date, fileCount } of dateResults) {
              if (fileCount > 0) {
                if (!monthData.dates[date]) monthData.dates[date] = { files: 0, bySource: {} }
                monthData.dates[date].files += fileCount
                monthData.dates[date].bySource[source] = fileCount
                monthData.totalFiles += fileCount
                yearData.totalFiles += fileCount
                wardData.totalFiles += fileCount
                result.totalFiles += fileCount
              }
            }
          }
        }
      } catch (err) {
        console.error(`[DutyOnOff] Error scanning ${source}/${ward}:`, err.message)
      }

      completedSteps++
      if (onProgress) onProgress({ completedSteps, totalSteps, currentWard: ward, currentSource: source })
    }

    if (wardData.totalFiles > 0) {
      for (const [yr, yd] of Object.entries(wardData.years)) {
        for (const [mo, md] of Object.entries(yd.months)) {
          if (md.totalFiles <= 0) delete yd.months[mo]
        }
        if (yd.totalFiles <= 0) delete wardData.years[yr]
      }
      result.wards[ward] = wardData
    }
  }

  console.log(`[DutyOnOff] ✅ Scan complete. Total API hits: ${apiHits}, Total files: ${result.totalFiles}, Wards:`, Object.keys(result.wards))
  return result
}

export async function saveDutyOnOffScanResult(cityPath, data) {
  ensureStorage()
  const filePath = `${cityPath}/dutyOnOffScanResult.json`
  const fileRef = storageRef(storage, filePath)
  await uploadString(fileRef, JSON.stringify(data), 'raw', { contentType: 'application/json' })
}

export async function loadDutyOnOffScanResult(cityPath) {
  ensureStorage()
  try {
    const fileRef = storageRef(storage, `${cityPath}/dutyOnOffScanResult.json`)
    const bytes = await getBytes(fileRef)
    const text = new TextDecoder().decode(bytes)
    return JSON.parse(text)
  } catch {
    return null
  }
}

export async function getDutyOnOffDateFiles(cityPath, ward, year, month, date) {
  ensureStorage()
  const allFiles = []
  for (const source of DUTY_ONOFF_SOURCES) {
    const basePath = `${cityPath}/${source}/${ward}/${year}/${month}/${date}`
    try {
      const result = await listAll(storageRef(storage, basePath))
      if (result.items.length === 0) continue
      console.log(`[DutyOnOff Files] ${source}/${date}: ${result.items.length} files`)
      const metas = await Promise.all(result.items.map(f => getMetadata(f)))
      metas.forEach(m => {
        allFiles.push({
          name: m.name,
          fullPath: m.fullPath,
          size: m.size,
          contentType: m.contentType,
          timeCreated: m.timeCreated,
          updated: m.updated,
          source,
        })
      })
    } catch (err) {
      console.warn(`[DutyOnOff Files] Error fetching ${source}/${date}:`, err.message)
    }
  }
  return allFiles
}

// ── DutyOnOff City Config (stored in Firebase Storage) ──
const CITY_CONFIG_PATH = 'Common/DeveloperTool/DutyOnOffCityData.json'

export async function loadDutyOnOffCities() {
  ensureStorage()
  try {
    const fileRef = storageRef(storage, CITY_CONFIG_PATH)
    const url = await getDownloadURL(fileRef)
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    return data.cities || []
  } catch {
    return null
  }
}

export async function saveDutyOnOffCities(cities) {
  ensureStorage()
  const sorted = [...cities].sort((a, b) => a.localeCompare(b))
  const fileRef = storageRef(storage, CITY_CONFIG_PATH)
  await uploadString(fileRef, JSON.stringify({ cities: sorted }), 'raw', { contentType: 'application/json' })
  return sorted
}

export async function getStorageFolderSize(path) {
  ensureStorage()
  const folderRef = storageRef(storage, path)
  const result = await listAll(folderRef)

  let totalSize = 0
  let fileCount = result.items.length

  // Get size of files in this folder
  const metadataPromises = result.items.map(item => getMetadata(item))
  const metadatas = await Promise.all(metadataPromises)
  metadatas.forEach(m => { totalSize += m.size })

  // Recurse into subfolders
  for (const prefix of result.prefixes) {
    const sub = await getStorageFolderSize(prefix.fullPath)
    totalSize += sub.totalSize
    fileCount += sub.fileCount
  }

  return { totalSize, fileCount }
}
