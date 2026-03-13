import { useState } from 'react'
import {
  ClipboardList,
  LogIn,
  LogOut,
  SkipForward,
  Megaphone,
  MapPin,
  BookOpen,
} from 'lucide-react'
import AttendanceSection from '../components/storage/AttendanceSection'
import GenericSection from '../components/storage/GenericSection'

const MENU_ITEMS = [
  { key: 'attendance', label: 'Attendance', icon: ClipboardList, path: 'AttendanceManagement' },
  { key: 'dutyOn',    label: 'Duty On',    icon: LogIn,         path: 'DutyOnImages' },
  { key: 'dutyOff',   label: 'Duty Off',   icon: LogOut,        path: 'DutyOutImages' },
  { key: 'skipLine',  label: 'Skip Line',  icon: SkipForward,   path: 'SkipData' },
  { key: 'iec',       label: 'IEC',        icon: Megaphone,     path: 'IECData' },
  { key: 'field',     label: 'Field',      icon: MapPin,        path: 'FieldExecutiveData' },
  { key: 'logBook',   label: 'LogBook',    icon: BookOpen,      path: 'LogBookImages' },
]

export default function StorageBrowser({ selectedCity }) {
  const [activeMenu, setActiveMenu] = useState('attendance')
  const activeItem = MENU_ITEMS.find(m => m.key === activeMenu)

  return (
    <div className="flex h-full">
      {/* Left Side Menu */}
      <div className="w-20 shrink-0 bg-surface border-r border-surface-lighter flex flex-col overflow-y-auto">
        <nav className="flex flex-col items-center gap-0.5 py-3 px-2">
          {MENU_ITEMS.map(item => {
            const isActive = activeMenu === item.key
            return (
              <button
                key={item.key}
                onClick={() => setActiveMenu(item.key)}
                className="flex flex-col items-center gap-1.5 py-2.5 w-full rounded-xl cursor-pointer group"
              >
                <div className={`p-2 rounded-[3px] transition-all duration-300 ease-in-out ${
                  isActive
                    ? 'bg-primary text-white shadow-md shadow-primary/25 scale-105'
                    : 'bg-surface-light border border-surface-lighter text-text-muted group-hover:bg-primary/10 group-hover:border-primary/40 group-hover:text-primary group-hover:scale-110 group-active:scale-95'
                }`}>
                  <item.icon size={18} strokeWidth={isActive ? 2 : 1.5} />
                </div>
                <span className={`text-[10px] leading-tight text-center transition-colors duration-200 ${
                  isActive ? 'text-primary font-semibold' : 'text-text-muted font-medium'
                }`}>
                  {item.label}
                </span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-w-0 bg-surface-light p-5 overflow-y-auto">
        {!selectedCity ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted text-sm gap-2">
            <MapPin size={32} strokeWidth={1} className="text-surface-lighter" />
            Select a city to view data
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="flex items-center gap-2.5 pb-4 border-b border-surface-lighter">
              {activeItem && <activeItem.icon size={20} className="text-primary" />}
              <h2 className="text-base font-semibold text-text">{activeItem?.label}</h2>
              <span className="text-xs text-text-muted bg-surface px-2 py-0.5 rounded-full border border-surface-lighter">{selectedCity}</span>
            </div>

            {/* Section content */}
            <div className="pt-4">
              {activeMenu === 'attendance' && (
                <AttendanceSection selectedCity={selectedCity} />
              )}
              {activeMenu !== 'attendance' && activeItem && (
                <GenericSection selectedCity={selectedCity} storagePath={activeItem.path} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
