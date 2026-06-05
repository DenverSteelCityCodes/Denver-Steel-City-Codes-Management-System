import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import AdminDashboard from './pages/AdminDashboard'
import VolunteerDashboard from './pages/VolunteerDashboard'
import ParentDashboard from './pages/ParentDashboard'
import UnauthorizedPage from './pages/UnauthorizedPage'

function RoleRedirect() {
  const { role, loading } = useAuth()

  if (loading) return null

  if (role === 'admin') return <Navigate to="/admin" replace />
  if (role === 'volunteer') return <Navigate to="/volunteer" replace />
  if (role === 'parent') return <Navigate to="/parent" replace />
  return <Navigate to="/login" replace />
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Role-gated */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['volunteer']} />}>
            <Route path="/volunteer" element={<VolunteerDashboard />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['parent']} />}>
            <Route path="/parent" element={<ParentDashboard />} />
          </Route>

          {/* Root → redirect based on role */}
          <Route path="/" element={<ProtectedRoute />}>
            <Route index element={<RoleRedirect />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
