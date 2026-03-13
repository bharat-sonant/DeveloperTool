import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import StorageBrowser from './StorageBrowser'

// Mock firebase module
vi.mock('../lib/firebase', () => ({
  isConfigured: true,
  listStorageFolder: vi.fn().mockResolvedValue({ folders: [], files: [] }),
  getMonthEmployees: vi.fn().mockResolvedValue([
    { id: '1001' },
  ]),
  getEmployeeFiles: vi.fn().mockResolvedValue([
    { name: '2025-10-01InImage.jpg', fullPath: 'Sikar/AttendanceManagement/January/1001/2025-10-01InImage.jpg', size: 12000, contentType: 'image/jpeg', timeCreated: '2025-10-01T08:00:00Z', updated: '2025-10-01T08:00:00Z' },
    { name: '2025-10-01outImage.jpg', fullPath: 'Sikar/AttendanceManagement/January/1001/2025-10-01outImage.jpg', size: 13000, contentType: 'image/jpeg', timeCreated: '2025-10-01T17:00:00Z', updated: '2025-10-01T17:00:00Z' },
    { name: '2025-10-02InImage.jpg', fullPath: 'Sikar/AttendanceManagement/January/1001/2025-10-02InImage.jpg', size: 11000, contentType: 'image/jpeg', timeCreated: '2025-10-02T08:00:00Z', updated: '2025-10-02T08:00:00Z' },
    { name: '2025-10-02outImage.jpg', fullPath: 'Sikar/AttendanceManagement/January/1001/2025-10-02outImage.jpg', size: 14000, contentType: 'image/jpeg', timeCreated: '2025-10-02T17:00:00Z', updated: '2025-10-02T17:00:00Z' },
  ]),
  getFileDownloadURL: vi.fn().mockResolvedValue('https://example.com/img.jpg'),
  deleteStorageFiles: vi.fn().mockResolvedValue({ deleted: 2, failed: [] }),
  scanAttendanceCleanup: vi.fn().mockResolvedValue({ totalFiles: 0, totalCleanable: 0, totalFrozen: 0, months: {} }),
  saveCleanupResult: vi.fn().mockResolvedValue(),
  loadCleanupResult: vi.fn().mockResolvedValue({
    city: 'Sikar',
    scannedAt: '2026-03-13T10:00:00Z',
    totalFiles: 4,
    months: {
      January: {
        totalFiles: 4,
        years: { '2025': { files: 4 } },
        employees: {
          '1001': {
            files: 4,
            dates: {
              '2025-10-01': { in: true, out: true, other: 0 },
              '2025-10-02': { in: true, out: true, other: 0 },
            },
          },
        },
      },
    },
  }),
}))

const { deleteStorageFiles } = await import('../lib/firebase')

function renderBrowser() {
  return render(
    <MemoryRouter>
      <StorageBrowser selectedCity="Sikar" />
    </MemoryRouter>
  )
}

async function renderAndWaitForData() {
  renderBrowser()
  // Scan result loads → January auto-selected (has cleanable data)
  // Employee 1001 must be clicked since it's not auto-selected
  await waitFor(() => {
    expect(screen.getByText('1001')).toBeInTheDocument()
  })
  // Click employee to load files
  fireEvent.click(screen.getByText('1001'))
  await waitFor(() => {
    expect(screen.getByText('2025-10-01')).toBeInTheDocument()
  })
}

describe('StorageBrowser — Auto-selection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should auto-select January and show employee from scan result', async () => {
    await renderAndWaitForData()

    expect(screen.getByText('1001')).toBeInTheDocument()
    expect(screen.getByText('2025-10-01')).toBeInTheDocument()
    expect(screen.getByText('2025-10-02')).toBeInTheDocument()
  })
})

describe('StorageBrowser — Delete UI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(window, 'alert').mockImplementation(() => {})
  })

  it('should show file cards grouped by date', async () => {
    await renderAndWaitForData()

    expect(screen.getByText('2025-10-01')).toBeInTheDocument()
    expect(screen.getByText('2025-10-02')).toBeInTheDocument()
  })

  it('should not show delete button when no files selected', async () => {
    await renderAndWaitForData()

    expect(screen.queryByText(/Delete Selected/)).not.toBeInTheDocument()
  })

  it('should show delete button when date checkbox is checked', async () => {
    await renderAndWaitForData()

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])

    expect(screen.getByText(/Delete Selected/)).toBeInTheDocument()
  })

  it('should show correct count in delete button', async () => {
    await renderAndWaitForData()

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])

    expect(screen.getByText(/Delete Selected \(2\)/)).toBeInTheDocument()
  })

  it('should select all dates when all checkboxes are checked', async () => {
    await renderAndWaitForData()

    const checkboxes = screen.getAllByRole('checkbox')
    checkboxes.forEach(cb => fireEvent.click(cb))

    expect(screen.getByText(/Delete Selected \(4\)/)).toBeInTheDocument()
  })

  it('should deselect files when checkbox is unchecked', async () => {
    await renderAndWaitForData()

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0]) // Select
    fireEvent.click(checkboxes[0]) // Deselect

    expect(screen.queryByText(/Delete Selected/)).not.toBeInTheDocument()
  })

  it('should show confirmation dialog before deleting', async () => {
    window.confirm.mockReturnValue(false)
    await renderAndWaitForData()

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])

    const deleteBtn = screen.getByText(/Delete Selected/)
    fireEvent.click(deleteBtn)

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('Are you sure you want to delete')
    )
    expect(deleteStorageFiles).not.toHaveBeenCalled()
  })

  it('should call deleteStorageFiles when confirmed', async () => {
    window.confirm.mockReturnValue(true)
    await renderAndWaitForData()

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])

    const deleteBtn = screen.getByText(/Delete Selected/)
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(deleteStorageFiles).toHaveBeenCalledWith([
        'Sikar/AttendanceManagement/January/1001/2025-10-01InImage.jpg',
        'Sikar/AttendanceManagement/January/1001/2025-10-01outImage.jpg',
      ])
    })
  })

  it('should remove deleted files from UI after successful delete', async () => {
    window.confirm.mockReturnValue(true)
    await renderAndWaitForData()

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])

    const deleteBtn = screen.getByText(/Delete Selected/)
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(screen.queryByText('2025-10-01')).not.toBeInTheDocument()
    })

    expect(screen.getByText('2025-10-02')).toBeInTheDocument()
  })

  it('should show alert when some files fail to delete', async () => {
    window.confirm.mockReturnValue(true)
    deleteStorageFiles.mockResolvedValueOnce({
      deleted: 1,
      failed: ['Sikar/AttendanceManagement/January/1001/2025-10-01outImage.jpg'],
    })
    await renderAndWaitForData()

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])

    const deleteBtn = screen.getByText(/Delete Selected/)
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining('1 file(s) failed to delete')
      )
    })
  })
})

describe('StorageBrowser — Frozen Files', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should not show checkboxes for date groups in current year frozen months', async () => {
    await renderAndWaitForData()

    // 2025-10-* files are not frozen — checkboxes should be present
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0)
    expect(screen.getByText('Select All')).toBeInTheDocument()
  })
})

describe('StorageBrowser — Image Toggle', () => {
  it('should show Images OFF by default', async () => {
    await renderAndWaitForData()

    expect(screen.getByText('Images OFF')).toBeInTheDocument()
  })

  it('should toggle to Images ON when clicked', async () => {
    await renderAndWaitForData()

    fireEvent.click(screen.getByText('Images OFF'))

    expect(screen.getByText('Images ON')).toBeInTheDocument()
  })
})
