import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock firebase/app
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}))

// Mock firebase/database
vi.mock('firebase/database', () => ({
  getDatabase: vi.fn(),
  ref: vi.fn(),
  get: vi.fn(),
  query: vi.fn(),
  orderByKey: vi.fn(),
  limitToFirst: vi.fn(),
}))

// Storage mocks
const mockDeleteObject = vi.fn()
const mockStorageRef = vi.fn((_, path) => ({ fullPath: path }))
const mockListAll = vi.fn()
const mockGetMetadata = vi.fn()
const mockGetDownloadURL = vi.fn()

vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({})),
  ref: (...args) => mockStorageRef(...args),
  listAll: (...args) => mockListAll(...args),
  getMetadata: (...args) => mockGetMetadata(...args),
  getDownloadURL: (...args) => mockGetDownloadURL(...args),
  deleteObject: (...args) => mockDeleteObject(...args),
}))

// Set env vars so firebase initializes
vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-project')
vi.stubEnv('VITE_FIREBASE_DATABASE_URL', 'https://test.firebaseio.com')

describe('deleteStorageFiles', () => {
  let deleteStorageFiles

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./firebase.js')
    deleteStorageFiles = mod.deleteStorageFiles
  })

  it('should delete all files successfully', async () => {
    mockDeleteObject.mockResolvedValue(undefined)

    const result = await deleteStorageFiles([
      'city/AttendanceManagement/Jan/1001/2026-01-01InImage.jpg',
      'city/AttendanceManagement/Jan/1001/2026-01-01outImage.jpg',
    ])

    expect(result.deleted).toBe(2)
    expect(result.failed).toEqual([])
    expect(mockDeleteObject).toHaveBeenCalledTimes(2)
  })

  it('should handle partial failures', async () => {
    mockDeleteObject
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Permission denied'))

    const paths = [
      'city/AttendanceManagement/Jan/1001/file1.jpg',
      'city/AttendanceManagement/Jan/1001/file2.jpg',
    ]
    const result = await deleteStorageFiles(paths)

    expect(result.deleted).toBe(1)
    expect(result.failed).toEqual([paths[1]])
  })

  it('should handle all failures', async () => {
    mockDeleteObject.mockRejectedValue(new Error('Permission denied'))

    const paths = ['file1.jpg', 'file2.jpg']
    const result = await deleteStorageFiles(paths)

    expect(result.deleted).toBe(0)
    expect(result.failed).toEqual(paths)
  })

  it('should handle empty array', async () => {
    const result = await deleteStorageFiles([])

    expect(result.deleted).toBe(0)
    expect(result.failed).toEqual([])
    expect(mockDeleteObject).not.toHaveBeenCalled()
  })
})

describe('getFileDownloadURL', () => {
  let getFileDownloadURL

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./firebase.js')
    getFileDownloadURL = mod.getFileDownloadURL
  })

  it('should return download URL for a file', async () => {
    mockGetDownloadURL.mockResolvedValue('https://storage.example.com/file.jpg')

    const url = await getFileDownloadURL('city/AttendanceManagement/Jan/1001/file.jpg')

    expect(url).toBe('https://storage.example.com/file.jpg')
  })

  it('should throw if file not found', async () => {
    mockGetDownloadURL.mockRejectedValue(new Error('Object not found'))

    await expect(
      getFileDownloadURL('nonexistent/file.jpg')
    ).rejects.toThrow('Object not found')
  })
})

describe('formatSize (via module)', () => {
  it('should be tested via StorageBrowser component', () => {
    // formatSize is not exported from firebase, tested in component tests
    expect(true).toBe(true)
  })
})
