import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './components/AdminLayout'
import ParentLayout from './components/ParentLayout'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import AdminDashboard from './pages/AdminDashboard'
import AdminClasses from './pages/AdminClasses'
import AdminVolunteers from './pages/AdminVolunteers'
import AdminStudents from './pages/AdminStudents'
import AdminUsers from './pages/AdminUsers'
import AdminSessions from './pages/AdminSessions'
import AdminDuties from './pages/AdminDuties'
import AdminInterviews from './pages/AdminInterviews'
import AdminFormEditor from './pages/AdminFormEditor'
import AdminAttendance from './pages/AdminAttendance'
import VolunteerDashboard from './pages/VolunteerDashboard'
import ParentDashboard from './pages/ParentDashboard'
import ParentRegistrationPage from './pages/ParentRegistrationPage'
import ClassBrowser from './pages/ClassBrowser'
import UnauthorizedPage from './pages/UnauthorizedPage'
import VolunteerApplyPage from './pages/VolunteerApplyPage'

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
          <Route path="/apply" element={<VolunteerApplyPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Role-gated */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/classes" element={<AdminClasses />} />
              <Route path="/admin/volunteers" element={<AdminVolunteers />} />
              <Route path="/admin/students" element={<AdminStudents />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/sessions" element={<AdminSessions />} />
              <Route path="/admin/duties" element={<AdminDuties />} />
              <Route path="/admin/interviews" element={<AdminInterviews />} />
              <Route path="/admin/forms" element={<AdminFormEditor />} />
              <Route path="/admin/attendance" element={<AdminAttendance />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['volunteer']} />}>
            <Route path="/volunteer" element={<VolunteerDashboard />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['parent']} />}>
            <Route element={<ParentLayout />}>
              <Route path="/parent" element={<ParentDashboard />} />
              <Route path="/parent/classes" element={<ClassBrowser />} />
              <Route path="/parent/register" element={<ParentRegistrationPage />} />
            </Route>
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
