import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import AdminPage from "./pages/AdminPage"
import LoginPage from "./pages/AdminLoginPage"
import VerifyMagicLinkPage from "./pages/VerifyMagicLinkPage"
import ProtectedRoute from "./components/ProtectedRoute"
import { AuthProvider } from "./context/AuthContext"
import { ThemeProvider } from "./components/theme-provider"

import { Toaster } from "./components/ui/toaster"

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/verify-magic-link" element={<VerifyMagicLinkPage />} />
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
          </Routes>
          <Toaster />
        </Router>
      </AuthProvider>
    </ThemeProvider>

  )
}

export default App
