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

/** List all month folders under {city}/AttendanceManagement */
const MONTH_SORT_ORDER = { January:1, February:2, March:3, April:4, May:5, June:6, July:7, August:8, September:9, October:10, November:11, December:12 }

export async function listAttendanceMonths(cityPath) {
  ensureStorage()
  const basePath = `${cityPath}/AttendanceManagement`
  const result = await listAll(storageRef(storage, basePath))
  return result.prefixes
    .map(p => p.name)
    .filter(n => n !== 'cleanupScanResult.json')
    .sort((a, b) => (MONTH_SORT_ORDER[a] || 99) - (MONTH_SORT_ORDER[b] || 99))
}

/** Scan selected months (max 3) — stores filesMeta, merges with existing result */
export async function scanAttendanceCleanup(cityPath, selectedMonths, onProgress) {
  ensureStorage()
  const basePath = `${cityPath}/AttendanceManagement`

  // Frozen: current + previous month
  const now = new Date()
  const curY = now.getFullYear()
  const curM = now.getMonth() + 1
  const prevM = curM === 1 ? 12 : curM - 1
  const prevY = curM === 1 ? curY - 1 : curY
  const frozenPrefixes = new Set([
    `${curY}-${String(curM).padStart(2, '0')}`,
    `${prevY}-${String(prevM).padStart(2, '0')}`,
  ])

  // Load existing scan result to merge
  const existing = await loadAttendanceScanResult(cityPath)
  const scanData = {
    city: cityPath,
    scannedAt: now.toISOString(),
    totalFiles: 0,
    months: existing?.months || {},
  }
  // Remove months being re-scanned (fresh data will replace them)
  for (const month of selectedMonths) {
    delete scanData.months[month]
  }

  let hitCount = 0
  const progress = { month: '', employee: '', hits: 0, filesFound: 0, lastFile: '' }
  const updateProgress = (updates) => {
    Object.assign(progress, updates)
    if (onProgress) onProgress({ ...progress })
  }

  for (const month of selectedMonths) {
    updateProgress({ month, employee: '', lastFile: '' })
    const monthData = { totalFiles: 0, employees: {} }

    hitCount++
    updateProgress({ hits: hitCount })
    const empResult = await listAll(storageRef(storage, `${basePath}/${month}`))
    const empFolders = empResult.prefixes

    for (const empRef of empFolders) {
      const empId = empRef.name
      hitCount++
      updateProgress({ employee: empId, hits: hitCount })

      const filesResult = await listAll(storageRef(storage, empRef.fullPath))
      const empData = { totalFiles: 0, dates: {} }

      // Fetch metadata for all files in parallel
      const filesMeta = await Promise.all(filesResult.items.map(async (item) => {
        const fullMatch = item.name.match(/^(\d{4})-(\d{2})-(\d{2})/)
        if (!fullMatch) return null
        const yearMonth = `${fullMatch[1]}-${fullMatch[2]}`
        if (frozenPrefixes.has(yearMonth)) return null

        hitCount++
        updateProgress({ hits: hitCount, lastFile: item.name, filesFound: scanData.totalFiles })
        try {
          const [meta, downloadUrl] = await Promise.all([
            getMetadata(item),
            getDownloadURL(item),
          ])
          const source = item.name.includes('InImage') ? 'in' : item.name.includes('outImage') ? 'out' : 'other'
          return {
            name: meta.name,
            fullPath: meta.fullPath,
            size: meta.size,
            contentType: meta.contentType,
            timeCreated: meta.timeCreated,
            url: downloadUrl,
            source,
            date: `${fullMatch[1]}-${fullMatch[2]}-${fullMatch[3]}`,
          }
        } catch {
          return null
        }
      }))

      const validFiles = filesMeta.filter(Boolean)

      // Group files by date
      for (const file of validFiles) {
        if (!empData.dates[file.date]) empData.dates[file.date] = { files: 0, filesMeta: [] }
        empData.dates[file.date].files++
        empData.dates[file.date].filesMeta.push(file)
        empData.totalFiles++
      }

      if (empData.totalFiles > 0) {
        monthData.employees[empId] = empData
        monthData.totalFiles += empData.totalFiles
        scanData.totalFiles += empData.totalFiles
        updateProgress({ filesFound: scanData.totalFiles })
      }
    }

    if (monthData.totalFiles > 0) {
      scanData.months[month] = monthData
    }
  }

  // Recalculate totalFiles across all months (existing + newly scanned)
  scanData.totalFiles = Object.values(scanData.months).reduce((s, m) => s + m.totalFiles, 0)

  // Save merged result
  await saveAttendanceScanResult(cityPath, scanData)
  return scanData
}

export async function saveAttendanceScanResult(cityPath, data) {
  ensureStorage()
  const filePath = `${cityPath}/AttendanceManagement/cleanupScanResult.json`
  const fileRef = storageRef(storage, filePath)
  await uploadString(fileRef, JSON.stringify(data), 'raw', { contentType: 'application/json' })
}

export async function loadAttendanceScanResult(cityPath) {
  ensureStorage()
  const path = `${cityPath}/AttendanceManagement/cleanupScanResult.json`
  try {
    const fileRef = storageRef(storage, path)
    const url = await getDownloadURL(fileRef)
    const res = await fetch(url)
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
  return result.prefixes.map(p => p.name).filter(n => n !== 'skipLineScanResult.json').sort()
}

/** Scan selected wards (max 3) — stores filesMeta + URL, merges with existing */
export async function scanSkipLineImages(cityPath, selectedWards, onProgress) {
  ensureStorage()
  const basePath = `${cityPath}/SkipData`

  // Frozen: current + previous month
  const now = new Date()
  const curY = now.getFullYear()
  const curM = now.getMonth() + 1
  const prevM = curM === 1 ? 12 : curM - 1
  const prevY = curM === 1 ? curY - 1 : curY
  const MONTH_NUM = { January:1, February:2, March:3, April:4, May:5, June:6, July:7, August:8, September:9, October:10, November:11, December:12 }

  // Load existing to merge
  const existing = await loadSkipLineScanResult(cityPath)
  const scanData = {
    city: cityPath,
    scannedAt: now.toISOString(),
    totalFiles: 0,
    wards: existing?.wards || {},
  }
  for (const ward of selectedWards) {
    delete scanData.wards[ward]
  }

  let hitCount = 0
  const progress = { ward: '', path: '', hits: 0, filesFound: 0, lastFile: '' }
  const updateProgress = (updates) => {
    Object.assign(progress, updates)
    if (onProgress) onProgress({ ...progress })
  }

  for (const ward of selectedWards) {
    updateProgress({ ward, path: `${ward}/...`, lastFile: '' })
    const wardData = { totalFiles: 0, years: {} }

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

        if (!wardData.years[year]) wardData.years[year] = { totalFiles: 0, months: {} }
        const monthData = { totalFiles: 0, dates: {} }

        await Promise.all(datesResult.prefixes.map(async (dateRef) => {
          const date = dateRef.name
          hitCount++
          updateProgress({ hits: hitCount, path: `${ward}/${year}/${month}/${date}` })
          const filesResult = await listAll(storageRef(storage, dateRef.fullPath))

          const filesMeta = await Promise.all(filesResult.items.map(async (item) => {
            hitCount++
            updateProgress({ hits: hitCount, lastFile: item.name, filesFound: scanData.totalFiles })
            try {
              const [meta, downloadUrl] = await Promise.all([
                getMetadata(item),
                getDownloadURL(item),
              ])
              return {
                name: meta.name,
                fullPath: meta.fullPath,
                size: meta.size,
                contentType: meta.contentType,
                timeCreated: meta.timeCreated,
                url: downloadUrl,
              }
            } catch {
              return null
            }
          }))

          const validFiles = filesMeta.filter(Boolean)
          if (validFiles.length > 0) {
            monthData.dates[date] = { files: validFiles.length, filesMeta: validFiles }
            monthData.totalFiles += validFiles.length
            scanData.totalFiles += validFiles.length
            updateProgress({ filesFound: scanData.totalFiles })
          }
        }))

        if (monthData.totalFiles > 0) {
          wardData.years[year].months[month] = monthData
          wardData.years[year].totalFiles += monthData.totalFiles
        }
      }

      if (!wardData.years[year] || wardData.years[year].totalFiles <= 0) delete wardData.years[year]
      else wardData.totalFiles += wardData.years[year].totalFiles
    }

    if (wardData.totalFiles > 0) {
      scanData.wards[ward] = wardData
    }
  }

  scanData.totalFiles = Object.values(scanData.wards).reduce((s, w) => s + w.totalFiles, 0)
  await saveSkipLineScanResult(cityPath, scanData)
  return scanData
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
    const url = await getDownloadURL(fileRef)
    const res = await fetch(url)
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
    const res = await fetch(url)
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

  let hitCount = 0
  const progress = { ward: '', path: '', hits: 0, filesFound: 0, lastFile: '' }
  const updateProgress = (updates) => {
    Object.assign(progress, updates)
    if (onProgress) onProgress({ ...progress })
  }

  for (const ward of selectedWards) {
    updateProgress({ ward, path: `${ward}/...`, lastFile: '' })
    const wardData = { totalFiles: 0, years: {} }

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

        if (!wardData.years[year]) wardData.years[year] = { totalFiles: 0, months: {} }
        const monthData = { totalFiles: 0, dates: {} }

        await Promise.all(datesResult.prefixes.map(async (dateRef) => {
          const date = dateRef.name
          hitCount++
          updateProgress({ hits: hitCount, path: `${ward}/${year}/${month}/${date}` })
          const filesResult = await listAll(storageRef(storage, dateRef.fullPath))

          const filesMeta = await Promise.all(filesResult.items.map(async (item) => {
            hitCount++
            updateProgress({ hits: hitCount, lastFile: item.name, filesFound: scanData.totalFiles })
            try {
              const [meta, downloadUrl] = await Promise.all([
                getMetadata(item),
                getDownloadURL(item),
              ])
              return {
                name: meta.name,
                fullPath: meta.fullPath,
                size: meta.size,
                contentType: meta.contentType,
                timeCreated: meta.timeCreated,
                url: downloadUrl,
              }
            } catch {
              return null
            }
          }))

          const validFiles = filesMeta.filter(Boolean)
          if (validFiles.length > 0) {
            monthData.dates[date] = { files: validFiles.length, filesMeta: validFiles }
            monthData.totalFiles += validFiles.length
            scanData.totalFiles += validFiles.length
            updateProgress({ filesFound: scanData.totalFiles })
          }
        }))

        if (monthData.totalFiles > 0) {
          wardData.years[year].months[month] = monthData
          wardData.years[year].totalFiles += monthData.totalFiles
        }
      }

      if (!wardData.years[year] || wardData.years[year].totalFiles <= 0) delete wardData.years[year]
      else wardData.totalFiles += wardData.years[year].totalFiles
    }

    if (wardData.totalFiles > 0) {
      scanData.wards[ward] = wardData
    }
  }

  scanData.totalFiles = Object.values(scanData.wards).reduce((s, w) => s + w.totalFiles, 0)
  await saveLogBookScanResult(cityPath, scanData)
  return scanData
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
    const url = await getDownloadURL(fileRef)
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
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
    const res = await fetch(url)
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
    const res = await fetch(url)
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

const SKIPLINE_CITY_CONFIG_PATH = 'Common/DeveloperTool/SkipLineCityData.json'

export async function loadSkipLineCityConfig() {
  ensureStorage()
  try {
    const fileRef = storageRef(storage, SKIPLINE_CITY_CONFIG_PATH)
    const url = await getDownloadURL(fileRef)
    const res = await fetch(url)
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
