import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Topbar from './components/Sidebar'
import CitySelector from './components/CitySelector'
import Dashboard from './pages/Dashboard'
import RealtimeDB from './pages/RealtimeDB'
import StorageBrowser from './pages/StorageBrowser'
import CostCalculator from './pages/CostCalculator'
import SettingsPage from './pages/SettingsPage'

const CITIES = ['Ajmer', 'Dehradun', 'Jaipur', 'Sikar']

function AppLayout() {
  const [selectedCity, setSelectedCity] = useState(CITIES[0])

  return (
    <div className="min-h-screen bg-bg">
      <Topbar
        rightSlot={
          <CitySelector cities={CITIES} selectedCity={selectedCity} onSelect={setSelectedCity} loading={false} />
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
                <Route path="/" element={<Dashboard selectedCity={selectedCity} />} />
                <Route path="/realtime" element={<RealtimeDB selectedCity={selectedCity} />} />
                <Route path="/costing" element={<CostCalculator selectedCity={selectedCity} />} />
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
