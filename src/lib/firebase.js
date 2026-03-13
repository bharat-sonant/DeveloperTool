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
  const result = await listAll(storageRef(storage, basePath))

  // Get metadata for all files in parallel
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

export async function getFileDownloadURL(fullPath) {
  ensureStorage()
  return getDownloadURL(storageRef(storage, fullPath))
}

export async function deleteStorageFiles(fullPaths) {
  ensureStorage()
  const results = await Promise.allSettled(
    fullPaths.map(p => deleteObject(storageRef(storage, p)))
  )
  const failed = results
    .map((r, i) => r.status === 'rejected' ? fullPaths[i] : null)
    .filter(Boolean)
  return { deleted: fullPaths.length - failed.length, failed }
}

// ── Scan Cleanup ──

export async function scanAttendanceCleanup(cityPath, onProgress) {
  ensureStorage()
  const basePath = `${cityPath}/AttendanceManagement`
  const monthsResult = await listAll(storageRef(storage, basePath))
  const monthFolders = monthsResult.prefixes.map(p => p.name).sort()

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
    const empResult = await listAll(storageRef(storage, `${basePath}/${month}`))
    const empFolders = empResult.prefixes

    const monthData = { totalFiles: 0, years: {}, employees: {} }

    for (const empRef of empFolders) {
      const filesResult = await listAll(storageRef(storage, empRef.fullPath))
      const empId = empRef.name
      const empData = { files: 0, dates: {} }

      for (const fileItem of filesResult.items) {
        const fullMatch = fileItem.name.match(/^(\d{4})-(\d{2})-(\d{2})/)
        if (!fullMatch) continue
        const yearMonth = `${fullMatch[1]}-${fullMatch[2]}`
        // Skip frozen files entirely
        if (frozenPrefixes.has(yearMonth)) continue

        const dateStr = `${fullMatch[1]}-${fullMatch[2]}-${fullMatch[3]}`
        const yearStr = fullMatch[1]
        const type = fileItem.name.includes('InImage') ? 'in' : fileItem.name.includes('outImage') ? 'out' : 'other'

        empData.files++

        // Per-date breakdown
        if (!empData.dates[dateStr]) empData.dates[dateStr] = { in: false, out: false, other: 0 }
        if (type === 'in') empData.dates[dateStr].in = true
        else if (type === 'out') empData.dates[dateStr].out = true
        else empData.dates[dateStr].other++

        // Per-year aggregation
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
  const fileRef = storageRef(storage, filePath)
  await uploadString(fileRef, JSON.stringify(data), 'raw', { contentType: 'application/json' })
}

export async function loadCleanupResult(cityPath) {
  ensureStorage()
  try {
    const fileRef = storageRef(storage, `${cityPath}/AttendanceManagement/cleanupScanResult.json`)
    const bytes = await getBytes(fileRef)
    const text = new TextDecoder().decode(bytes)
    return JSON.parse(text)
  } catch {
    return null
  }
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
