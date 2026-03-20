// Persistent section config — Firebase Storage is the source of truth,
// localStorage is used as a fast cache / offline fallback.

const CACHE_KEY = 'sectionConfig'

const DEFAULTS = {
  dutyOnOff: {
    cities: ['Ajmer', 'Bharatpur', 'Bundi', 'Chennai', 'Chirawa', 'Dausa', 'Dei-Bundi', 'Etmadpur', 'Sikar'],
  },
}

// ── Cache helpers (localStorage) ──

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveCache(data) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(data))
}

/** Sync read — returns cached cities or defaults (used for instant UI render) */
export function getCachedSectionCities(section) {
  const all = loadCache()
  return all[section]?.cities || DEFAULTS[section]?.cities || []
}

/** Write cities to localStorage cache */
export function cacheSectionCities(section, cities) {
  const all = loadCache()
  if (!all[section]) all[section] = {}
  all[section].cities = [...cities].sort((a, b) => a.localeCompare(b))
  saveCache(all)
}
