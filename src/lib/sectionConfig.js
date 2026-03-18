// Persistent section config stored in localStorage
// Each section (e.g. 'dutyOnOff') can have its own city list

const STORAGE_KEY = 'sectionConfig'

const DEFAULTS = {
  dutyOnOff: {
    cities: ['Ajmer', 'Bharatpur', 'Bundi', 'Chennai', 'Chirawa', 'Dausa', 'Dei-Bundi', 'Etmadpur', 'Sikar'],
  },
}

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveAll(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function getSectionCities(section) {
  const all = loadAll()
  return all[section]?.cities || DEFAULTS[section]?.cities || []
}

export function setSectionCities(section, cities) {
  const all = loadAll()
  if (!all[section]) all[section] = {}
  all[section].cities = [...cities].sort((a, b) => a.localeCompare(b))
  saveAll(all)
}

export function getDefaultCities(section) {
  return DEFAULTS[section]?.cities || []
}
