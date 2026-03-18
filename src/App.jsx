import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Topbar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import RealtimeDB from './pages/RealtimeDB'
import StorageBrowser from './pages/StorageBrowser'
import SettingsPage from './pages/SettingsPage'

function AppLayout() {
  return (
    <div className="min-h-screen bg-bg">
      <Topbar />
      <main className="pt-14">
        <Routes>
          <Route path="/storage" element={
            <div className="h-[calc(100vh-56px)] flex flex-col">
              <StorageBrowser />
            </div>
          } />
          <Route path="*" element={
            <div className="max-w-6xl mx-auto p-6 lg:p-8">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/realtime" element={<RealtimeDB />} />
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
