export function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function estimateCost(storageBytes, dbBytes) {
  // Firebase pricing (approximate)
  const storageGB = storageBytes / (1024 ** 3)
  const dbGB = dbBytes / (1024 ** 3)

  const storageCost = storageGB * 0.026  // $0.026/GB/month
  const dbCost = dbGB * 5.00             // $5/GB/month for Realtime DB

  return {
    storageCost: storageCost.toFixed(4),
    dbCost: dbCost.toFixed(4),
    totalCost: (storageCost + dbCost).toFixed(4),
    storageGB: storageGB.toFixed(4),
    dbGB: dbGB.toFixed(4),
  }
}

export function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}
