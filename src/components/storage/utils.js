export const MONTH_ORDER = ['January','February','March','April','May','June','July','August','September','October','November','December']

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

// Firebase Storage cost: $0.026/GB/month
export function formatStorageCost(bytes) {
  const gb = bytes / (1024 * 1024 * 1024)
  const cost = gb * 0.026
  return cost < 0.01 ? `< $0.01/mo` : `$${cost.toFixed(2)}/mo`
}
