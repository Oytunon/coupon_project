import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import UserDashboard from "./pages/UserDashboard"


import { Toaster } from "./components/ui/toaster"

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<UserDashboard />} />
        <Route path="/stats/:eventId/:username" element={<UserDashboard />} />
      </Routes>
      <Toaster />
    </Router>
  )
}

export default App
