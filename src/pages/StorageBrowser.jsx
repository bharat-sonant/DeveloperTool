import { useState } from 'react'
import {
  ClipboardList,
  SkipForward,
  Megaphone,
  MapPin,
  BookOpen,
  ArrowLeftRight,
} from 'lucide-react'
import { motion } from 'framer-motion'
import AttendanceSection from '../components/storage/AttendanceSection'
import SkipLineSection from '../components/storage/SkipLineSection'
import LogBookSection from '../components/storage/LogBookSection'
import DutyOnOffSection from '../components/storage/DutyOnOffSection'
import GenericSection from '../components/storage/GenericSection'

const MENU_ITEMS = [
  { key: 'attendance', label: 'Attendance', icon: ClipboardList, path: 'AttendanceManagement', disabled: true },
  { key: 'dutyOnOff', label: 'Duty On/Off', icon: ArrowLeftRight, path: '' },
  { key: 'skipLine',  label: 'Skip Line',  icon: SkipForward,   path: 'SkipData', disabled: true },
  { key: 'iec',       label: 'IEC',        icon: Megaphone,     path: 'IECData', disabled: true },
  { key: 'field',     label: 'Field',      icon: MapPin,        path: 'FieldExecutiveData', disabled: true },
  { key: 'logBook',   label: 'LogBook',    icon: BookOpen,      path: 'LogBookImages', disabled: true },
]

export default function StorageBrowser() {
  const [activeMenu, setActiveMenu] = useState('dutyOnOff')
  const activeItem = MENU_ITEMS.find(m => m.key === activeMenu)

  return (
    <div className="flex h-full">
      {/* Left Side Menu */}
      <div className="w-[76px] shrink-0 bg-white border-r border-surface-lighter/70 flex flex-col">
        <nav className="flex flex-col items-center gap-1 py-3 px-1.5">
          {MENU_ITEMS.map(item => {
            const isActive = activeMenu === item.key
            const isDisabled = item.disabled
            return (
              <button
                key={item.key}
                onClick={() => !isDisabled && setActiveMenu(item.key)}
                disabled={isDisabled}
                className={`relative flex flex-col items-center gap-1 py-2.5 w-full rounded-xl transition-all duration-200 ${
                  isDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeMenuBg"
                    className="absolute inset-0 bg-sky-50 border border-sky-200/60 rounded-xl"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <div className={`relative z-10 p-2 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-primary text-white shadow-md shadow-primary/25'
                    : isDisabled
                      ? 'text-text-muted'
                      : 'text-text-muted group-hover:text-primary'
                }`}>
                  <item.icon size={17} strokeWidth={isActive ? 2.2 : 1.5} />
                </div>
                <span className={`relative z-10 text-[9px] leading-tight text-center transition-colors duration-200 ${
                  isActive ? 'text-primary font-bold' : 'text-text-muted font-medium'
                }`}>
                  {item.label}
                </span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-w-0 bg-surface-light p-2 overflow-y-auto">
        <div className="h-full">
          {activeMenu === 'attendance' && <AttendanceSection />}
          {activeMenu === 'skipLine' && <SkipLineSection />}
          {activeMenu === 'dutyOnOff' && <DutyOnOffSection />}
          {activeMenu === 'logBook' && <LogBookSection />}
          {activeMenu !== 'attendance' && activeMenu !== 'dutyOn' && activeMenu !== 'dutyOff' && activeMenu !== 'dutyOnOff' && activeMenu !== 'skipLine' && activeMenu !== 'logBook' && activeItem && (
            <GenericSection storagePath={activeItem.path} />
          )}
        </div>
      </div>
    </div>
  )
}
