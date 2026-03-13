import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import StorageBrowser from './StorageBrowser'

// Mock firebase module
vi.mock('../lib/firebase', () => ({
  isConfigured: true,
  listStorageFolder: vi.fn().mockResolvedValue({ folders: [], files: [] }),
  getAttendanceYears: vi.fn().mockResolvedValue([2025, 2026]),
  getAttendanceMonths: vi.fn().mockResolvedValue([
    { name: 'January', fullPath: 'Sikar/AttendanceManagement/January' },
  ]),
  getMonthEmployees: vi.fn().mockResolvedValue([
    { id: '1001', fileCount: 4, totalSize: 50000 },
  ]),
  getEmployeeFiles: vi.fn().mockResolvedValue([
    { name: '2026-01-01InImage.jpg', fullPath: 'Sikar/AttendanceManagement/January/1001/2026-01-01InImage.jpg', size: 12000, contentType: 'image/jpeg', timeCreated: '2026-01-01T08:00:00Z', updated: '2026-01-01T08:00:00Z' },
    { name: '2026-01-01outImage.jpg', fullPath: 'Sikar/AttendanceManagement/January/1001/2026-01-01outImage.jpg', size: 13000, contentType: 'image/jpeg', timeCreated: '2026-01-01T17:00:00Z', updated: '2026-01-01T17:00:00Z' },
    { name: '2026-01-02InImage.jpg', fullPath: 'Sikar/AttendanceManagement/January/1001/2026-01-02InImage.jpg', size: 11000, contentType: 'image/jpeg', timeCreated: '2026-01-02T08:00:00Z', updated: '2026-01-02T08:00:00Z' },
    { name: '2026-01-02outImage.jpg', fullPath: 'Sikar/AttendanceManagement/January/1001/2026-01-02outImage.jpg', size: 14000, contentType: 'image/jpeg', timeCreated: '2026-01-02T17:00:00Z', updated: '2026-01-02T17:00:00Z' },
  ]),
  getFileDownloadURL: vi.fn().mockResolvedValue('https://example.com/img.jpg'),
  deleteStorageFiles: vi.fn().mockResolvedValue({ deleted: 2, failed: [] }),
}))

const { deleteStorageFiles } = await import('../lib/firebase')

function renderBrowser() {
  return render(
    <MemoryRouter>
      <StorageBrowser selectedCity="Sikar" />
    </MemoryRouter>
  )
}

describe('StorageBrowser — Delete UI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset confirm mock
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(window, 'alert').mockImplementation(() => {})
  })

  it('should render attendance section with months and employees', async () => {
    renderBrowser()

    await waitFor(() => {
      expect(screen.getByText('January')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByText('1001')).toBeInTheDocument()
    })
  })

  it('should show file cards grouped by date', async () => {
    renderBrowser()

    await waitFor(() => {
      expect(screen.getByText('2026-01-01')).toBeInTheDocument()
      expect(screen.getByText('2026-01-02')).toBeInTheDocument()
    })
  })

  it('should not show delete button when no files selected', async () => {
    renderBrowser()

    await waitFor(() => {
      expect(screen.getByText('2026-01-01')).toBeInTheDocument()
    })

    expect(screen.queryByText(/Delete Selected/)).not.toBeInTheDocument()
  })

  it('should show delete button when date checkbox is checked', async () => {
    renderBrowser()

    await waitFor(() => {
      expect(screen.getByText('2026-01-01')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0]) // Select first date group

    expect(screen.getByText(/Delete Selected/)).toBeInTheDocument()
  })

  it('should show correct count in delete button', async () => {
    renderBrowser()

    await waitFor(() => {
      expect(screen.getByText('2026-01-01')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0]) // First date has 2 files

    expect(screen.getByText(/Delete Selected \(2\)/)).toBeInTheDocument()
  })

  it('should select all dates when all checkboxes are checked', async () => {
    renderBrowser()

    await waitFor(() => {
      expect(screen.getByText('2026-01-01')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    checkboxes.forEach(cb => fireEvent.click(cb))

    expect(screen.getByText(/Delete Selected \(4\)/)).toBeInTheDocument()
  })

  it('should deselect files when checkbox is unchecked', async () => {
    renderBrowser()

    await waitFor(() => {
      expect(screen.getByText('2026-01-01')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0]) // Select
    fireEvent.click(checkboxes[0]) // Deselect

    expect(screen.queryByText(/Delete Selected/)).not.toBeInTheDocument()
  })

  it('should show confirmation dialog before deleting', async () => {
    window.confirm.mockReturnValue(false)
    renderBrowser()

    await waitFor(() => {
      expect(screen.getByText('2026-01-01')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])

    const deleteBtn = screen.getByText(/Delete Selected/)
    fireEvent.click(deleteBtn)

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('Are you sure you want to delete')
    )
    // Should NOT call deleteStorageFiles since user cancelled
    expect(deleteStorageFiles).not.toHaveBeenCalled()
  })

  it('should call deleteStorageFiles when confirmed', async () => {
    window.confirm.mockReturnValue(true)
    renderBrowser()

    await waitFor(() => {
      expect(screen.getByText('2026-01-01')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])

    const deleteBtn = screen.getByText(/Delete Selected/)
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(deleteStorageFiles).toHaveBeenCalledWith([
        'Sikar/AttendanceManagement/January/1001/2026-01-01InImage.jpg',
        'Sikar/AttendanceManagement/January/1001/2026-01-01outImage.jpg',
      ])
    })
  })

  it('should remove deleted files from UI after successful delete', async () => {
    window.confirm.mockReturnValue(true)
    renderBrowser()

    await waitFor(() => {
      expect(screen.getByText('2026-01-01')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])

    const deleteBtn = screen.getByText(/Delete Selected/)
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(screen.queryByText('2026-01-01')).not.toBeInTheDocument()
    })

    // Other date should still be there
    expect(screen.getByText('2026-01-02')).toBeInTheDocument()
  })

  it('should show alert when some files fail to delete', async () => {
    window.confirm.mockReturnValue(true)
    deleteStorageFiles.mockResolvedValueOnce({
      deleted: 1,
      failed: ['Sikar/AttendanceManagement/January/1001/2026-01-01outImage.jpg'],
    })
    renderBrowser()

    await waitFor(() => {
      expect(screen.getByText('2026-01-01')).toBeInTheDocument()
    })

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

describe('StorageBrowser — Image Toggle', () => {
  it('should show Images OFF by default', async () => {
    renderBrowser()

    await waitFor(() => {
      expect(screen.getByText('2026-01-01')).toBeInTheDocument()
    })

    expect(screen.getByText('Images OFF')).toBeInTheDocument()
  })

  it('should toggle to Images ON when clicked', async () => {
    renderBrowser()

    await waitFor(() => {
      expect(screen.getByText('Images OFF')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Images OFF'))

    expect(screen.getByText('Images ON')).toBeInTheDocument()
  })
})

describe('StorageBrowser — formatStorageCost', () => {
  it('should show storage cost badge for loaded employees', async () => {
    renderBrowser()

    await waitFor(() => {
      expect(screen.getByText('1001')).toBeInTheDocument()
    })

    // 50000 bytes = ~0.0000465 GB = ~$0.0000012/mo = < $0.01/mo
    await waitFor(() => {
      expect(screen.getByText(/< \$0.01\/mo/)).toBeInTheDocument()
    })
  })
})
