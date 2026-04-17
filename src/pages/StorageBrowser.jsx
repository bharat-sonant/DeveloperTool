import { useState } from 'react'
import {
  ClipboardList,
  SkipForward,
  Megaphone,
  MapPin,
  BookOpen,
  ArrowLeftRight,
  Lock,
  Route,
} from 'lucide-react'
import { motion } from 'framer-motion'
import AttendanceSection from '../components/storage/AttendanceSection'
import SkipLineSection from '../components/storage/SkipLineSection'
import LogBookSection from '../components/storage/LogBookSection'
import WardTripsSection from '../components/storage/WardTripsSection'
import DutyOnOffSection from '../components/storage/DutyOnOffSection'
import GenericSection from '../components/storage/GenericSection'

const MENU_ITEMS = [
  { key: 'attendance', label: 'Attendance', icon: ClipboardList, path: 'AttendanceManagement', disabled: true },
  { key: 'dutyOnOff', label: 'Duty On/Off', icon: ArrowLeftRight, path: '', disabled: true },
  { key: 'skipLine',  label: 'Skip Line',  icon: SkipForward,   path: 'SkipData', disabled: true },
  { key: 'logBook',   label: 'LogBook',    icon: BookOpen,      path: 'LogBookImages', disabled: true },
  { key: 'wardTrips', label: 'Ward Trips', icon: Route,         path: 'WardTrips', disabled: true },
  { key: 'iec',       label: 'IEC',        icon: Megaphone,     path: 'IECData', disabled: true },
  { key: 'field',     label: 'Field',      icon: MapPin,        path: 'FieldExecutiveData', disabled: true },
]

export default function StorageBrowser() {
  const [activeMenu, setActiveMenu] = useState(null)
  const activeItem = MENU_ITEMS.find(m => m.key === activeMenu)

  return (
    <div className="flex h-full">
      {/* Left Sidebar - ClickUp style */}
      <div className="w-[180px] shrink-0 bg-white border-r border-slate-200/70 flex flex-col">
        {/* Section header */}
        <div className="px-4 pt-4 pb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Sections
          </span>
        </div>

        {/* Menu items */}
        <nav className="flex flex-col gap-0.5 px-2 pb-3">
          {MENU_ITEMS.map(item => {
            const isActive = activeMenu === item.key
            const isDisabled = item.disabled
            return (
              <button
                key={item.key}
                onClick={() => !isDisabled && setActiveMenu(item.key)}
                disabled={isDisabled}
                className={`group relative flex items-center gap-2.5 px-2.5 py-[9px] rounded-md transition-all duration-150
                  ${isDisabled
                    ? 'cursor-not-allowed'
                    : 'cursor-pointer hover:bg-slate-50'
                  }
                `}
              >
                {/* Active background */}
                {isActive && (
                  <motion.div
                    layoutId="activeMenuBg"
                    className="absolute inset-0 bg-primary/[0.07] rounded-md"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}

                {/* Active left bar */}
                {isActive && (
                  <motion.div
                    layoutId="activeBar"
                    className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-primary rounded-r-full"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}

                {/* Icon */}
                <div className={`relative z-10 transition-colors duration-150 ${
                  isActive
                    ? 'text-primary'
                    : isDisabled
                      ? 'text-slate-300'
                      : 'text-slate-400 group-hover:text-slate-600'
                }`}>
                  <item.icon size={16} strokeWidth={isActive ? 2 : 1.6} />
                </div>

                {/* Label */}
                <span className={`relative z-10 text-[12px] transition-colors duration-150 flex-1 text-left ${
                  isActive
                    ? 'text-primary font-semibold'
                    : isDisabled
                      ? 'text-slate-300 font-medium'
                      : 'text-slate-500 font-medium group-hover:text-slate-700'
                }`}>
                  {item.label}
                </span>

                {/* Lock icon for disabled */}
                {isDisabled && (
                  <Lock size={11} className="relative z-10 text-slate-300" strokeWidth={2} />
                )}
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
          {activeMenu === 'wardTrips' && <WardTripsSection />}
          {activeMenu !== 'attendance' && activeMenu !== 'dutyOn' && activeMenu !== 'dutyOff' && activeMenu !== 'dutyOnOff' && activeMenu !== 'skipLine' && activeMenu !== 'logBook' && activeMenu !== 'wardTrips' && activeItem && (
            <GenericSection storagePath={activeItem.path} />
          )}
        </div>
      </div>
    </div>
  )
}
