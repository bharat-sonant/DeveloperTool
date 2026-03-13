import { useState } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import Topbar from './components/Sidebar'
import CitySelector from './components/CitySelector'
import Dashboard from './pages/Dashboard'
import RealtimeDB from './pages/RealtimeDB'
import StorageBrowser from './pages/StorageBrowser'
import CostCalculator from './pages/CostCalculator'
import SettingsPage from './pages/SettingsPage'

const CITIES = ['Ajmer', 'Sikar']

function AppLayout() {
  const [selectedCity, setSelectedCity] = useState(CITIES[0])
  const location = useLocation()
  const isStorage = location.pathname === '/storage'

  return (
    <div className="min-h-screen bg-bg">
      <Topbar
        rightSlot={
          isStorage ? (
            <CitySelector cities={CITIES} selectedCity={selectedCity} onSelect={setSelectedCity} loading={false} />
          ) : null
        }
      />
      <main className="pt-14">
        <Routes>
          <Route path="/storage" element={
            <div className="h-[calc(100vh-56px)] flex flex-col">
              <StorageBrowser selectedCity={selectedCity} />
            </div>
          } />
          <Route path="*" element={
            <div className="max-w-6xl mx-auto p-6 lg:p-8">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/realtime" element={<RealtimeDB />} />
                <Route path="/costing" element={<CostCalculator />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </div>
          } />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}
