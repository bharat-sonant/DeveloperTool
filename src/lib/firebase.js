import { initializeApp } from 'firebase/app'
import { getDatabase, ref, get, query, orderByKey, limitToFirst } from 'firebase/database'
import { getStorage, ref as storageRef, listAll, getMetadata, getDownloadURL, deleteObject } from 'firebase/storage'

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

export async function getAttendanceYears(cityPath) {
  ensureStorage()
  const basePath = `${cityPath}/AttendanceManagement`
  const result = await listAll(storageRef(storage, basePath))
  const years = new Set()

  // Check ALL months, ALL employees — extract years from filenames
  const checks = result.prefixes.map(async (monthPrefix) => {
    try {
      const monthResult = await listAll(storageRef(storage, monthPrefix.fullPath))
      const empChecks = monthResult.prefixes.map(async (empPrefix) => {
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

      // Check ALL employees in parallel — filenames start with YYYY-MM-DD
      const sample = monthResult.prefixes
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

export async function getMonthEmployees(cityPath, month, year) {
  ensureStorage()
  const basePath = `${cityPath}/AttendanceManagement/${month}`
  const result = await listAll(storageRef(storage, basePath))
  const yearStr = String(year)

  // Check each employee in parallel — count files + total size matching the year
  const checks = result.prefixes.map(async (empPrefix) => {
    try {
      const files = await listAll(storageRef(storage, empPrefix.fullPath))
      const yearFiles = files.items.filter(f => f.name.startsWith(yearStr))
      if (yearFiles.length === 0) return null

      // Get file sizes in parallel
      const metas = await Promise.all(yearFiles.map(f => getMetadata(f)))
      const totalSize = metas.reduce((sum, m) => sum + m.size, 0)

      return { id: empPrefix.name, fileCount: yearFiles.length, totalSize }
    } catch {
      return null
    }
  })

  return (await Promise.all(checks)).filter(Boolean)
}

export async function getEmployeeFiles(cityPath, month, employeeId, year) {
  ensureStorage()
  const basePath = `${cityPath}/AttendanceManagement/${month}/${employeeId}`
  const result = await listAll(storageRef(storage, basePath))
  const yearStr = String(year)
  const yearFiles = result.items.filter(f => f.name.startsWith(yearStr))

  // Get metadata for all files in parallel
  const metas = await Promise.all(yearFiles.map(f => getMetadata(f)))
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
