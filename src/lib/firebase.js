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

// ── Attendance Scan ──
// Structure: {city}/AttendanceManagement/{month}/{employee}/{date-files}

const MONTH_SORT_ORDER = { January:1, February:2, March:3, April:4, May:5, June:6, July:7, August:8, September:9, October:10, November:11, December:12 }

/** List all month folders under {city}/AttendanceManagement */
export async function listAttendanceMonths(cityPath) {
  ensureStorage()
  const basePath = `${cityPath}/AttendanceManagement`
  const result = await listAll(storageRef(storage, basePath))
  return result.prefixes
    .map(p => p.name)
    .filter(n => !n.endsWith('.json'))
    .sort((a, b) => (MONTH_SORT_ORDER[a] || 99) - (MONTH_SORT_ORDER[b] || 99))
}

/** Scan selected months via REST API — collects employee IDs per month */
export async function scanAttendanceCleanup(cityPath, selectedMonths, onProgress) {
  ensureStorage()
  const bucket = firebaseConfig.storageBucket
  const basePath = `${cityPath}/AttendanceManagement`

  const now = new Date()
  const curY = now.getFullYear()
  const curM = now.getMonth() + 1
  const prevM = curM === 1 ? 12 : curM - 1
  const prevY = curM === 1 ? curY - 1 : curY
  const frozenPrefixes = new Set([
    `${curY}-${String(curM).padStart(2, '0')}`,
    `${prevY}-${String(prevM).padStart(2, '0')}`,
  ])

  const existing = await loadAttendanceScanResult(cityPath)
  const scanData = {
    city: cityPath,
    scannedAt: now.toISOString(),
    totalFiles: 0,
    employees: existing?.employees || {},
    scannedMonths: existing?.scannedMonths || [],
  }

  const progress = { month: '', filesFound: 0 }
  const emit = (updates) => { Object.assign(progress, updates); onProgress?.({ ...progress }) }

  for (const month of selectedMonths) {
    emit({ month })

    // REST API: fetch ALL files under this month
    const prefix = `${basePath}/${month}/`
    const allFiles = await listAllFilesByPrefix(bucket, prefix, (count) => {
      emit({ filesFound: count })
    })

    // Parse paths: {city}/AttendanceManagement/{month}/{employee}/{filename}
    // filename: 2025-04-15_InImage.jpg → year = 2025, yearMonth = 2025-04
    const monthParts = prefix.split('/').filter(Boolean).length
    for (const file of allFiles) {
      const parts = file.fullPath.split('/')
      if (parts.length < monthParts + 2) continue
      const empId = parts[monthParts]
      const fileName = parts[parts.length - 1]

      const dateMatch = fileName.match(/^(\d{4})-(\d{2})-(\d{2})/)
      if (!dateMatch) continue
      const yearMonth = `${dateMatch[1]}-${dateMatch[2]}`
      if (frozenPrefixes.has(yearMonth)) continue // skip current + previous month

      const year = dateMatch[1]
      const date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
      const source = fileName.includes('InImage') ? 'in' : fileName.includes('outImage') ? 'out' : 'other'

      if (!scanData.employees[empId]) scanData.employees[empId] = { totalFiles: 0, years: {} }
      if (!scanData.employees[empId].years[year]) scanData.employees[empId].years[year] = {}
      if (!scanData.employees[empId].years[year][month]) scanData.employees[empId].years[year][month] = {}
      if (!scanData.employees[empId].years[year][month][date]) scanData.employees[empId].years[year][month][date] = []
      scanData.employees[empId].years[year][month][date].push({ fullPath: file.fullPath, source })
      scanData.employees[empId].totalFiles++
    }

    // Track this month as scanned
    if (!scanData.scannedMonths.includes(month)) {
      scanData.scannedMonths.push(month)
    }
  }

  scanData.totalFiles = Object.values(scanData.employees).reduce((s, e) => s + e.totalFiles, 0)
  await saveAttendanceScanResult(cityPath, scanData)
  return scanData
}

export async function saveAttendanceScanResult(cityPath, data) {
  ensureStorage()
  const filePath = `Common/DeveloperTool/Attendance/${cityPath}.json`
  const fileRef = storageRef(storage, filePath)
  await uploadString(fileRef, JSON.stringify(data), 'raw', { contentType: 'application/json' })
}

export async function loadAttendanceScanResult(cityPath) {
  ensureStorage()
  try {
    const fileRef = storageRef(storage, `Common/DeveloperTool/Attendance/${cityPath}.json`)
    const url = await getDownloadURL(fileRef)
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now(), { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch {
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

/** List ward folders under {city}/SkipData */
export async function listSkipLineWards(cityPath) {
  ensureStorage()
  const basePath = `${cityPath}/SkipData`
  const result = await listAll(storageRef(storage, basePath))
  return result.prefixes.map(p => p.name).filter(n => !n.endsWith('.json')).sort()
}

/** Scan selected wards — stores fullPath + size only, merges with existing */
export async function scanSkipLineImages(cityPath, selectedWards, onProgress) {
  ensureStorage()
  const basePath = `${cityPath}/SkipData`

  const now = new Date()
  const curY = now.getFullYear()
  const curM = now.getMonth() + 1
  const prevM = curM === 1 ? 12 : curM - 1
  const prevY = curM === 1 ? curY - 1 : curY
  const MONTH_NUM = { January:1, February:2, March:3, April:4, May:5, June:6, July:7, August:8, September:9, October:10, November:11, December:12 }

  const existing = await loadSkipLineScanResult(cityPath)
  const scanData = {
    city: cityPath,
    scannedAt: now.toISOString(),
    totalFiles: 0,
    totalSize: 0,
    wards: existing?.wards || {},
  }
  for (const ward of selectedWards) {
    delete scanData.wards[ward]
  }

  let hitCount = 0
  const progress = { ward: '', path: '', hits: 0, filesFound: 0, totalSize: 0, lastFile: '' }
  const updateProgress = (updates) => {
    Object.assign(progress, updates)
    if (onProgress) onProgress({ ...progress })
  }

  for (const ward of selectedWards) {
    updateProgress({ ward, path: `${ward}/...`, lastFile: '' })
    const wardData = { totalFiles: 0, totalSize: 0, years: {} }

    hitCount++
    updateProgress({ hits: hitCount })
    const yearsResult = await listAll(storageRef(storage, `${basePath}/${ward}`))

    for (const yearRef of yearsResult.prefixes) {
      const year = yearRef.name
      hitCount++
      updateProgress({ hits: hitCount, path: `${ward}/${year}` })
      const monthsResult = await listAll(storageRef(storage, yearRef.fullPath))

      for (const monthRef of monthsResult.prefixes) {
        const month = monthRef.name
        const mNum = MONTH_NUM[month] || parseInt(month, 10) || 0
        const yNum = parseInt(year)
        if ((yNum === curY && mNum === curM) || (yNum === prevY && mNum === prevM)) continue

        hitCount++
        updateProgress({ hits: hitCount, path: `${ward}/${year}/${month}` })
        const datesResult = await listAll(storageRef(storage, monthRef.fullPath))

        if (!wardData.years[year]) wardData.years[year] = { totalFiles: 0, totalSize: 0, months: {} }
        const monthData = { totalFiles: 0, totalSize: 0, dates: {} }

        await Promise.all(datesResult.prefixes.map(async (dateRef) => {
          const date = dateRef.name
          hitCount++
          updateProgress({ hits: hitCount, path: `${ward}/${year}/${month}/${date}` })
          const filesResult = await listAll(storageRef(storage, dateRef.fullPath))

          const filesMeta = await Promise.all(filesResult.items.map(async (item) => {
            hitCount++
            updateProgress({ hits: hitCount, lastFile: item.name, filesFound: scanData.totalFiles })
            try {
              const meta = await getMetadata(item)
              return { fullPath: meta.fullPath, size: meta.size }
            } catch {
              return null
            }
          }))

          const validFiles = filesMeta.filter(Boolean)
          if (validFiles.length > 0) {
            const dateSize = validFiles.reduce((s, f) => s + (f.size || 0), 0)
            monthData.dates[date] = validFiles
            monthData.totalFiles += validFiles.length
            monthData.totalSize += dateSize
            scanData.totalFiles += validFiles.length
            scanData.totalSize += dateSize
            updateProgress({ filesFound: scanData.totalFiles, totalSize: scanData.totalSize })
          }
        }))

        if (monthData.totalFiles > 0) {
          wardData.years[year].months[month] = monthData
          wardData.years[year].totalFiles += monthData.totalFiles
          wardData.years[year].totalSize = (wardData.years[year].totalSize || 0) + monthData.totalSize
        }
      }

      if (!wardData.years[year] || wardData.years[year].totalFiles <= 0) delete wardData.years[year]
      else {
        wardData.totalFiles += wardData.years[year].totalFiles
        wardData.totalSize += wardData.years[year].totalSize || 0
      }
    }

    // Always save ward — even with 0 files (shows as "Cleaned" in drawer)
    scanData.wards[ward] = wardData
  }

  scanData.totalFiles = Object.values(scanData.wards).reduce((s, w) => s + w.totalFiles, 0)
  scanData.totalSize = Object.values(scanData.wards).reduce((s, w) => s + (w.totalSize || 0), 0)
  await saveSkipLineScanResult(cityPath, scanData)
  return scanData
}

export async function saveSkipLineScanResult(cityPath, data) {
  ensureStorage()
  const filePath = `Common/DeveloperTool/SkipLine/${cityPath}.json`
  const fileRef = storageRef(storage, filePath)
  await uploadString(fileRef, JSON.stringify(data), 'raw', { contentType: 'application/json' })
}

export async function loadSkipLineScanResult(cityPath) {
  ensureStorage()
  try {
    const fileRef = storageRef(storage, `Common/DeveloperTool/SkipLine/${cityPath}.json`)
    const url = await getDownloadURL(fileRef)
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now(), { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// ── LogBook Scan ──
// Structure: {city}/LogBookImages/{ward}/{year}/{month}/{date}/{images}

const LOGBOOK_CITY_CONFIG_PATH = 'Common/DeveloperTool/LogBookCityData.json'

export async function loadLogBookCityConfig() {
  ensureStorage()
  try {
    const fileRef = storageRef(storage, LOGBOOK_CITY_CONFIG_PATH)
    const url = await getDownloadURL(fileRef)
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now(), { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    return { cities: data.cities || [], cleanedCities: data.cleanedCities || [] }
  } catch {
    return null
  }
}

export async function saveLogBookCityConfig(cities, cleanedCities = []) {
  ensureStorage()
  const sorted = [...cities].sort((a, b) => a.localeCompare(b))
  const cleanedSorted = [...cleanedCities].sort((a, b) => a.localeCompare(b))
  const fileRef = storageRef(storage, LOGBOOK_CITY_CONFIG_PATH)
  await uploadString(fileRef, JSON.stringify({ cities: sorted, cleanedCities: cleanedSorted }), 'raw', { contentType: 'application/json' })
  return { cities: sorted, cleanedCities: cleanedSorted }
}

/** List ward folders under {city}/LogBookImages */
export async function listLogBookWards(cityPath) {
  ensureStorage()
  const basePath = `${cityPath}/LogBookImages`
  const result = await listAll(storageRef(storage, basePath))
  return result.prefixes.map(p => p.name).filter(n => n !== 'logBookScanResult.json').sort()
}

/** Scan selected wards (max 3) — stores filesMeta + URL, merges with existing */
export async function scanLogBookImages(cityPath, selectedWards, onProgress) {
  ensureStorage()
  const bucket = firebaseConfig.storageBucket
  const basePath = `${cityPath}/LogBookImages`

  const now = new Date()
  const curY = now.getFullYear()
  const curM = now.getMonth() + 1
  const prevM = curM === 1 ? 12 : curM - 1
  const prevY = curM === 1 ? curY - 1 : curY
  const MONTH_NUM = { January:1, February:2, March:3, April:4, May:5, June:6, July:7, August:8, September:9, October:10, November:11, December:12 }

  const existing = await loadLogBookScanResult(cityPath)
  const scanData = {
    city: cityPath,
    scannedAt: now.toISOString(),
    totalFiles: 0,
    wards: existing?.wards || {},
  }
  for (const ward of selectedWards) {
    delete scanData.wards[ward]
  }

  const progress = { ward: '', filesFound: 0 }
  const emit = (updates) => { Object.assign(progress, updates); onProgress?.({ ...progress }) }

  for (const ward of selectedWards) {
    emit({ ward, filesFound: scanData.totalFiles })
    const wardData = { totalFiles: 0, years: {} }

    // REST API: fetch ALL files under this ward in ~few paginated calls
    const prefix = `${basePath}/${ward}/`
    const allFiles = await listAllFilesByPrefix(bucket, prefix, (count) => {
      emit({ filesFound: scanData.totalFiles + count })
    })

    // Parse paths: {city}/LogBookImages/{ward}/{year}/{month}/{date}/{filename}
    const wardParts = prefix.split('/').filter(Boolean).length // parts before {year}
    for (const file of allFiles) {
      const parts = file.fullPath.split('/')
      if (parts.length < wardParts + 3) continue // need year/month/date/file

      const year = parts[wardParts]
      const month = parts[wardParts + 1]
      const date = parts[wardParts + 2]

      // Skip current and previous month
      const yNum = parseInt(year)
      const mNum = MONTH_NUM[month] || parseInt(month, 10) || 0
      if ((yNum === curY && mNum === curM) || (yNum === prevY && mNum === prevM)) continue

      if (!wardData.years[year]) wardData.years[year] = { totalFiles: 0, months: {} }
      if (!wardData.years[year].months[month]) wardData.years[year].months[month] = { totalFiles: 0, dates: {} }
      const monthData = wardData.years[year].months[month]

      if (!monthData.dates[date]) monthData.dates[date] = []
      monthData.dates[date].push({ fullPath: file.fullPath })

      monthData.totalFiles++
      wardData.years[year].totalFiles++
      wardData.totalFiles++
    }

    // Clean up empty years
    for (const [year, yd] of Object.entries(wardData.years)) {
      if (yd.totalFiles <= 0) delete wardData.years[year]
    }

    scanData.wards[ward] = wardData
    scanData.totalFiles += wardData.totalFiles
  }

  await saveLogBookScanResult(cityPath, scanData)
  return scanData
}

export async function saveLogBookScanResult(cityPath, data) {
  ensureStorage()
  const filePath = `Common/DeveloperTool/Logbook/${cityPath}.json`
  const fileRef = storageRef(storage, filePath)
  await uploadString(fileRef, JSON.stringify(data), 'raw', { contentType: 'application/json' })
}

export async function loadLogBookScanResult(cityPath) {
  ensureStorage()
  try {
    const fileRef = storageRef(storage, `Common/DeveloperTool/Logbook/${cityPath}.json`)
    const url = await getDownloadURL(fileRef)
    const res = await fetch(url + '&_t=' + Date.now(), { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// ── WardTrips Scan ──
// Structure: {city}/WardTrips/{year}/{month}/...

/** List ward folders under {city}/WardTrips */
export async function listWardTripsWards(cityPath) {
  ensureStorage()
  const basePath = `${cityPath}/WardTrips`
  const result = await listAll(storageRef(storage, basePath))
  return result.prefixes.map(p => p.name).filter(n => !n.endsWith('.json')).sort()
}

/** List year+month folders under {city}/WardTrips — returns [{year, month}, ...] */
export async function listWardTripsYearMonths(cityPath) {
  ensureStorage()
  const basePath = `${cityPath}/WardTrips`
  const yearsResult = await listAll(storageRef(storage, basePath))
  const yearMonths = []
  for (const yearRef of yearsResult.prefixes) {
    const year = yearRef.name
    const monthsResult = await listAll(storageRef(storage, yearRef.fullPath))
    for (const monthRef of monthsResult.prefixes) {
      yearMonths.push({ year, month: monthRef.name })
    }
  }
  // Filter out current month and previous month
  const now = new Date()
  const curY = now.getFullYear()
  const curM = now.getMonth() + 1
  const prevM = curM === 1 ? 12 : curM - 1
  const prevY = curM === 1 ? curY - 1 : curY
  const MONTH_NUM = { January:1, February:2, March:3, April:4, May:5, June:6, July:7, August:8, September:9, October:10, November:11, December:12 }

  const filtered = yearMonths.filter(({ year, month }) => {
    const yNum = parseInt(year)
    const mNum = MONTH_NUM[month] || parseInt(month, 10) || 0
    if (yNum === curY && mNum === curM) return false
    if (yNum === prevY && mNum === prevM) return false
    return true
  })

  // Sort: latest year first, then by month order
  return filtered.sort((a, b) => b.year.localeCompare(a.year) || (MONTH_NUM[a.month] || 0) - (MONTH_NUM[b.month] || 0))
}

/** List all files under a prefix via Firebase REST API — returns [{fullPath}, ...] with pagination */
async function listAllFilesByPrefix(bucket, prefix, onPage) {
  const allItems = []
  let pageToken = null
  do {
    const params = new URLSearchParams({ prefix, maxResults: '1000' })
    if (pageToken) params.set('pageToken', pageToken)
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?${params}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Storage list failed: ${res.status}`)
    const data = await res.json()
    const items = (data.items || []).map(item => ({ fullPath: item.name }))
    allItems.push(...items)
    pageToken = data.nextPageToken || null
    onPage?.(allItems.length)
  } while (pageToken)
  return allItems
}

/** Scan a single year+month via REST API — collect unique wards
 *  Structure: {city}/WardTrips/{year}/{month}/{date}/{ward}/{trip}/{images} */
export async function scanWardTripsMonth(cityPath, year, month, onProgress) {
  ensureStorage()
  const bucket = firebaseConfig.storageBucket
  const prefix = `${cityPath}/WardTrips/${year}/${month}/`

  const progress = { phase: 'listing', filesFound: 0 }
  const emit = (updates) => { Object.assign(progress, updates); onProgress?.({ ...progress }) }

  // 1. REST API: get ALL files under this month
  emit({ phase: 'listing' })
  const allFiles = await listAllFilesByPrefix(bucket, prefix, (count) => {
    emit({ filesFound: count })
  })

  // 2. Parse paths — build ward → year → month → date → files structure
  // Path: {city}/WardTrips/{year}/{month}/{date}/{ward}/{trip}/{filename}
  const baseParts = prefix.split('/').filter(Boolean).length
  const wardsMap = {}

  for (const file of allFiles) {
    const parts = file.fullPath.split('/')
    if (parts.length < baseParts + 3) continue
    const date = parts[baseParts]       // e.g. "2025-08-01"
    const ward = parts[baseParts + 1]   // e.g. "21-R1"

    if (!wardsMap[ward]) wardsMap[ward] = {}
    if (!wardsMap[ward][year]) wardsMap[ward][year] = {}
    if (!wardsMap[ward][year][month]) wardsMap[ward][year][month] = {}
    if (!wardsMap[ward][year][month][date]) wardsMap[ward][year][month][date] = []
    wardsMap[ward][year][month][date].push(file.fullPath)
  }

  emit({ phase: 'saving' })

  // 3. Merge into existing scan result
  const existing = await loadWardTripsScanResult(cityPath)
  const monthKey = `${year}/${month}`
  const scanData = {
    city: cityPath,
    scannedAt: new Date().toISOString(),
    scannedMonths: existing?.scannedMonths || [],
    wards: (existing?.wards && !Array.isArray(existing.wards)) ? existing.wards : {},
  }

  // Track scanned month
  if (!scanData.scannedMonths.includes(monthKey)) {
    scanData.scannedMonths.push(monthKey)
    scanData.scannedMonths.sort()
  }

  for (const [ward, years] of Object.entries(wardsMap)) {
    if (!scanData.wards[ward]) scanData.wards[ward] = { years: {} }
    for (const [y, months] of Object.entries(years)) {
      if (!scanData.wards[ward].years[y]) scanData.wards[ward].years[y] = {}
      for (const [m, dates] of Object.entries(months)) {
        if (!scanData.wards[ward].years[y][m]) scanData.wards[ward].years[y][m] = {}
        for (const [d, files] of Object.entries(dates)) {
          const existingFiles = scanData.wards[ward].years[y][m][d] || []
          const mergedSet = new Set([...existingFiles, ...files])
          scanData.wards[ward].years[y][m][d] = [...mergedSet]
        }
      }
    }
  }

  // Calculate totalFiles at ward and root level
  let rootTotal = 0
  for (const [, wardData] of Object.entries(scanData.wards)) {
    let wardTotal = 0
    for (const [, months] of Object.entries(wardData.years || {})) {
      for (const [, dates] of Object.entries(months)) {
        for (const [, files] of Object.entries(dates)) {
          wardTotal += files.length
        }
      }
    }
    wardData.totalFiles = wardTotal
    rootTotal += wardTotal
  }
  scanData.totalFiles = rootTotal

  await saveWardTripsScanResult(cityPath, scanData)
  return scanData
}

/** Remove a month's scan data from wards and scannedMonths */
export async function resetWardTripsMonth(cityPath, year, month) {
  const existing = await loadWardTripsScanResult(cityPath)
  if (!existing) return existing
  const monthKey = `${year}/${month}`

  // Remove from scannedMonths
  existing.scannedMonths = (existing.scannedMonths || []).filter(m => m !== monthKey)

  // Remove this month's dates from all wards
  for (const [ward, wardData] of Object.entries(existing.wards || {})) {
    if (wardData.years?.[year]?.[month]) {
      delete wardData.years[year][month]
      // If year empty, remove it
      if (Object.keys(wardData.years[year]).length === 0) delete wardData.years[year]
      // If ward has no years, remove it
      if (Object.keys(wardData.years).length === 0) delete existing.wards[ward]
    }
  }

  existing.scannedAt = new Date().toISOString()
  await saveWardTripsScanResult(cityPath, existing)
  return existing
}

export async function saveWardTripsScanResult(cityPath, data) {
  ensureStorage()
  const filePath = `Common/DeveloperTool/WardTrips/${cityPath}.json`
  const fileRef = storageRef(storage, filePath)
  await uploadString(fileRef, JSON.stringify(data), 'raw', { contentType: 'application/json' })
}

export async function loadWardTripsScanResult(cityPath) {
  ensureStorage()
  try {
    const fileRef = storageRef(storage, `Common/DeveloperTool/WardTrips/${cityPath}.json`)
    const url = await getDownloadURL(fileRef)
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now(), { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

const WARDTRIPS_CITIES_PATH = 'Common/DeveloperTool/WardTripsCities.json'

export async function loadWardTripsCities() {
  ensureStorage()
  try {
    const fileRef = storageRef(storage, WARDTRIPS_CITIES_PATH)
    const url = await getDownloadURL(fileRef)
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now(), { cache: 'no-store' })
    if (!res.ok) return { included: [], mainPage: [] }
    const data = await res.json()
    if (Array.isArray(data)) return { included: data, mainPage: [] }
    return { included: data.included || [], mainPage: data.mainPage || [] }
  } catch {
    return { included: [], mainPage: [] }
  }
}

export async function saveWardTripsCities(included, mainPage) {
  ensureStorage()
  const data = {
    included: [...included].sort(),
    mainPage: [...mainPage].sort(),
  }
  const fileRef = storageRef(storage, WARDTRIPS_CITIES_PATH)
  await uploadString(fileRef, JSON.stringify(data), 'raw', { contentType: 'application/json' })
  return data
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
const ATTENDANCE_CITY_CONFIG_PATH = 'Common/DeveloperTool/AttendanceCityData.json'

export async function loadDutyOnOffCityConfig() {
  ensureStorage()
  try {
    const fileRef = storageRef(storage, CITY_CONFIG_PATH)
    const url = await getDownloadURL(fileRef)
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now(), { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    return { cities: data.cities || [], cleanedCities: data.cleanedCities || [] }
  } catch {
    return null
  }
}

export async function saveDutyOnOffCityConfig(cities, cleanedCities = []) {
  ensureStorage()
  const sorted = [...cities].sort((a, b) => a.localeCompare(b))
  const cleanedSorted = [...cleanedCities].sort((a, b) => a.localeCompare(b))
  const fileRef = storageRef(storage, CITY_CONFIG_PATH)
  await uploadString(fileRef, JSON.stringify({ cities: sorted, cleanedCities: cleanedSorted }), 'raw', { contentType: 'application/json' })
  return { cities: sorted, cleanedCities: cleanedSorted }
}

export async function loadAttendanceCityConfig() {
  ensureStorage()
  try {
    const fileRef = storageRef(storage, ATTENDANCE_CITY_CONFIG_PATH)
    const url = await getDownloadURL(fileRef)
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now(), { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    return { cities: data.cities || [], cleanedCities: data.cleanedCities || [] }
  } catch {
    return null
  }
}

export async function saveAttendanceCityConfig(cities, cleanedCities = []) {
  ensureStorage()
  const sorted = [...cities].sort((a, b) => a.localeCompare(b))
  const cleanedSorted = [...cleanedCities].sort((a, b) => a.localeCompare(b))
  const fileRef = storageRef(storage, ATTENDANCE_CITY_CONFIG_PATH)
  await uploadString(fileRef, JSON.stringify({ cities: sorted, cleanedCities: cleanedSorted }), 'raw', { contentType: 'application/json' })
  return { cities: sorted, cleanedCities: cleanedSorted }
}

const ATTENDANCE_CITIES_PATH = 'Common/DeveloperTool/AttendanceCities.json'

export async function loadAttendanceCities() {
  ensureStorage()
  try {
    const fileRef = storageRef(storage, ATTENDANCE_CITIES_PATH)
    const url = await getDownloadURL(fileRef)
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now(), { cache: 'no-store' })
    if (!res.ok) return { included: [], mainPage: [] }
    const data = await res.json()
    if (Array.isArray(data)) return { included: data, mainPage: [] }
    return { included: data.included || [], mainPage: data.mainPage || [] }
  } catch {
    return { included: [], mainPage: [] }
  }
}

export async function saveAttendanceCities(included, mainPage) {
  ensureStorage()
  const data = {
    included: [...included].sort(),
    mainPage: [...mainPage].sort(),
  }
  const fileRef = storageRef(storage, ATTENDANCE_CITIES_PATH)
  await uploadString(fileRef, JSON.stringify(data), 'raw', { contentType: 'application/json' })
  return data
}

const SKIPLINE_CITY_CONFIG_PATH = 'Common/DeveloperTool/SkipLineCityData.json'

export async function loadSkipLineCityConfig() {
  ensureStorage()
  try {
    const fileRef = storageRef(storage, SKIPLINE_CITY_CONFIG_PATH)
    const url = await getDownloadURL(fileRef)
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now(), { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    return { cities: data.cities || [], cleanedCities: data.cleanedCities || [] }
  } catch {
    return null
  }
}

export async function saveSkipLineCityConfig(cities, cleanedCities = []) {
  ensureStorage()
  const sorted = [...cities].sort((a, b) => a.localeCompare(b))
  const cleanedSorted = [...cleanedCities].sort((a, b) => a.localeCompare(b))
  const fileRef = storageRef(storage, SKIPLINE_CITY_CONFIG_PATH)
  await uploadString(fileRef, JSON.stringify({ cities: sorted, cleanedCities: cleanedSorted }), 'raw', { contentType: 'application/json' })
  return { cities: sorted, cleanedCities: cleanedSorted }
}

const SKIPLINE_CITIES_PATH = 'Common/DeveloperTool/SkipLineCities.json'

/** Load SkipLineCities config — returns { included: [], mainPage: [] } */
export async function loadSkipLineCities() {
  ensureStorage()
  try {
    const fileRef = storageRef(storage, SKIPLINE_CITIES_PATH)
    const url = await getDownloadURL(fileRef)
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now(), { cache: 'no-store' })
    if (!res.ok) return { included: [], mainPage: [] }
    const data = await res.json()
    if (Array.isArray(data)) return { included: data, mainPage: [] }
    return { included: data.included || [], mainPage: data.mainPage || [] }
  } catch {
    return { included: [], mainPage: [] }
  }
}

export async function saveSkipLineCities(included, mainPage) {
  ensureStorage()
  const data = {
    included: [...included].sort(),
    mainPage: [...mainPage].sort(),
  }
  const fileRef = storageRef(storage, SKIPLINE_CITIES_PATH)
  await uploadString(fileRef, JSON.stringify(data), 'raw', { contentType: 'application/json' })
  return data
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

// ── Master City List ──
export async function loadCityCommonData() {
  ensureStorage()
  try {
    const fileRef = storageRef(storage, 'Common/CityCommonData.json')
    const url = await getDownloadURL(fileRef)
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now(), { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/** List all city folders from storage root — returns actual folder names with correct casing */
export async function listStorageCityFolders() {
  ensureStorage()
  const result = await listAll(storageRef(storage, ''))
  return result.prefixes.map(p => p.name).sort()
}

/** Returns valid city folders by matching CityCommonData.json keys with storage root folders (case-insensitive) */
export async function listValidCityFolders() {
  const [cityData, storageFolders] = await Promise.all([
    loadCityCommonData(),
    listStorageCityFolders(),
  ])
  if (!cityData || !storageFolders) return []
  const cityKeys = Object.keys(cityData)
  const folderMap = new Map(storageFolders.map(f => [f.toLowerCase(), f]))
  return cityKeys
    .map(key => folderMap.get(key.toLowerCase()))
    .filter(Boolean)
    .sort()
}

const COMMON_CITIES_PATH = 'Common/DeveloperTool/CommonCities.json'

export async function loadCommonCities() {
  ensureStorage()
  try {
    const fileRef = storageRef(storage, COMMON_CITIES_PATH)
    const url = await getDownloadURL(fileRef)
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now(), { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function saveCommonCities(cities) {
  ensureStorage()
  const sorted = [...cities].sort()
  const fileRef = storageRef(storage, COMMON_CITIES_PATH)
  await uploadString(fileRef, JSON.stringify(sorted), 'raw', { contentType: 'application/json' })
  return sorted
}

/** Try cached CommonCities.json first, fallback to CityCommonData.json + storage match */
export async function resolveCommonCities() {
  const cached = await loadCommonCities()
  if (cached && cached.length > 0) return cached
  const cities = await listValidCityFolders()
  if (cities.length > 0) await saveCommonCities(cities)
  return cities
}

const LOGBOOK_CITIES_PATH = 'Common/DeveloperTool/LogBookCities.json'

/** Load LogBookCities config — returns { included: [], mainPage: [] } */
export async function loadLogBookCities() {
  ensureStorage()
  try {
    const fileRef = storageRef(storage, LOGBOOK_CITIES_PATH)
    const url = await getDownloadURL(fileRef)
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now(), { cache: 'no-store' })
    if (!res.ok) return { included: [], mainPage: [] }
    const data = await res.json()
    // Backward compat: old format was plain array
    if (Array.isArray(data)) return { included: data, mainPage: [] }
    return { included: data.included || [], mainPage: data.mainPage || [] }
  } catch {
    return { included: [], mainPage: [] }
  }
}

export async function saveLogBookCities(included, mainPage) {
  ensureStorage()
  const data = {
    included: [...included].sort(),
    mainPage: [...mainPage].sort(),
  }
  const fileRef = storageRef(storage, LOGBOOK_CITIES_PATH)
  await uploadString(fileRef, JSON.stringify(data), 'raw', { contentType: 'application/json' })
  return data
}
