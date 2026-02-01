import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import UserDashboard from "./pages/UserDashboard"
import Lobby from "./pages/Lobby"


import { Toaster } from "./components/ui/toaster"

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<UserDashboard />} />
        <Route path="/event/:eventId" element={<UserDashboard />} />
        {/* Deprecated but kept for backward compatibility if needed, or redirect */}
        <Route path="/stats/:eventId/:username" element={<UserDashboard />} />
      </Routes>
      <Toaster />
    </Router>
  )
}

export default App
