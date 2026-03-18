import { ChevronDown, MapPin, Check } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

export default function CitySelector({ cities, selectedCity, onSelect, loading, compact }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 bg-surface border rounded-lg text-text transition-all ${
          compact
            ? 'px-2 py-1 text-[11px] min-w-[120px]'
            : 'px-3 py-2 gap-2 text-sm min-w-[180px]'
        } ${open ? 'border-primary shadow-sm' : 'border-surface-lighter hover:border-primary/40'}`}
      >
        <MapPin size={compact ? 12 : 14} className={selectedCity ? 'text-primary shrink-0' : 'text-text-muted shrink-0'} />
        <span className={`flex-1 text-left font-medium ${compact ? 'text-[11px]' : 'text-sm'}`}>
          {loading ? 'Loading...' : selectedCity || 'Select City'}
        </span>
        <ChevronDown size={compact ? 10 : 14} className={`text-text-muted transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={`absolute top-full left-0 mt-1 bg-surface border border-surface-lighter rounded-lg shadow-lg z-50 overflow-hidden ${
          compact ? 'w-[160px]' : 'w-full'
        }`}>
          <div className="py-0.5 max-h-64 overflow-y-auto">
            {cities.map(city => {
              const isSelected = selectedCity === city
              return (
                <button
                  key={city}
                  onClick={() => { onSelect(city); setOpen(false) }}
                  className={`w-full flex items-center gap-2 text-left transition-colors ${
                    compact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-2 text-sm'
                  } ${isSelected
                    ? 'bg-primary/8 text-primary font-medium'
                    : 'text-text hover:bg-surface-light'
                  }`}
                >
                  <MapPin size={compact ? 11 : 14} className={isSelected ? 'text-primary shrink-0' : 'text-text-muted shrink-0'} />
                  <span className="flex-1">{city}</span>
                  {isSelected && <Check size={compact ? 11 : 14} className="text-primary shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
