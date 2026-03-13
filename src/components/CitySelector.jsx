import { ChevronDown, MapPin, X, Check } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

export default function CitySelector({ cities, selectedCity, onSelect, loading }) {
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
        className={`flex items-center gap-2 px-3 py-2 bg-surface border rounded-lg text-sm text-text transition-all min-w-[180px] ${
          open ? 'border-primary shadow-sm' : 'border-surface-lighter hover:border-primary/40'
        }`}
      >
        <div className={`p-1 rounded-md ${selectedCity ? 'bg-primary/10' : 'bg-surface-light'}`}>
          <MapPin size={14} className={selectedCity ? 'text-primary' : 'text-text-muted'} />
        </div>
        <span className="flex-1 text-left text-sm font-medium">
          {loading ? 'Loading...' : selectedCity || 'Select City'}
        </span>
        {selectedCity && (
          <X
            size={14}
            className="text-text-muted hover:text-danger transition-colors"
            onClick={e => { e.stopPropagation(); onSelect(null) }}
          />
        )}
        <ChevronDown size={14} className={`text-text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1.5 w-full bg-surface border border-surface-lighter rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="py-1">
            {cities.map(city => {
              const isSelected = selectedCity === city
              return (
                <button
                  key={city}
                  onClick={() => { onSelect(city); setOpen(false) }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                    isSelected
                      ? 'bg-primary/8 text-primary font-medium'
                      : 'text-text hover:bg-surface-light'
                  }`}
                >
                  <MapPin size={14} className={isSelected ? 'text-primary' : 'text-text-muted'} />
                  <span className="flex-1 text-left">{city}</span>
                  {isSelected && <Check size={14} className="text-primary" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
