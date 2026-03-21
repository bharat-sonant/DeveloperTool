// Persistent section config — Firebase Storage is the source of truth,
// localStorage is used as a fast cache / offline fallback.

const CACHE_KEY = 'sectionConfig'

const DEFAULTS = {
  dutyOnOff: {
    cities: ['Ajmer', 'Bharatpur', 'Bundi', 'Chennai', 'Chirawa', 'Dausa', 'Dei-Bundi', 'Etmadpur', 'Sikar'],
    cleanedCities: [],
  },
  attendance: {
    cities: [],
    cleanedCities: [],
  },
  skipLine: {
    cities: [],
    cleanedCities: [],
  },
  logBook: {
    cities: [],
    cleanedCities: [],
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

/** Sync read — returns cached config or defaults */
export function getCachedSectionConfig(section) {
  const all = loadCache()
  const def = DEFAULTS[section] || { cities: [], cleanedCities: [] }
  return {
    cities: all[section]?.cities || def.cities,
    cleanedCities: all[section]?.cleanedCities || def.cleanedCities,
  }
}

/** Write config to localStorage cache */
export function cacheSectionConfig(section, cities, cleanedCities) {
  const all = loadCache()
  if (!all[section]) all[section] = {}
  all[section].cities = [...cities].sort((a, b) => a.localeCompare(b))
  all[section].cleanedCities = [...cleanedCities].sort((a, b) => a.localeCompare(b))
  saveCache(all)
}
