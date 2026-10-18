import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './components/AdminLayout'
import ParentLayout from './components/ParentLayout'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
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
import AdminUpdates from './pages/AdminUpdates'
import PrintRoster from './pages/PrintRoster'
import VolunteerLayout from './components/VolunteerLayout'
import VolunteerToday from './pages/volunteer/VolunteerToday'
import VolunteerClasses from './pages/volunteer/VolunteerClasses'
import VolunteerDuties from './pages/volunteer/VolunteerDuties'
import VolunteerUpdates from './pages/volunteer/VolunteerUpdates'
import VolunteerProfile from './pages/volunteer/VolunteerProfile'
import ParentDashboard from './pages/ParentDashboard'
import ParentRegistrationPage from './pages/ParentRegistrationPage'
import ClassBrowser from './pages/ClassBrowser'
import ParentUpdates from './pages/parent/ParentUpdates'
import ParentFamily from './pages/parent/ParentFamily'
import UnauthorizedPage from './pages/UnauthorizedPage'
import VolunteerApplyPage from './pages/VolunteerApplyPage'
import CampPage from './pages/CampPage'
import CampListLinkPage from './pages/CampListLinkPage'
import MfaGate from './components/MfaGate'
import MfaPage from './pages/MfaPage'
import AdminHelp from './pages/help/AdminHelp'
import ParentHelp from './pages/help/ParentHelp'
import VolunteerHelp from './pages/help/VolunteerHelp'

function RoleRedirect() {
  const { role, loading } = useAuth()

  if (loading) return null

  if (role === 'admin') return <Navigate to="/admin" replace />
  if (role === 'volunteer') return <Navigate to="/volunteer" replace />
  if (role === 'parent') return <Navigate to="/parent" replace />
  return <Navigate to="/login" replace />
}

// Signed-out visitors at / see the public camp page (spec 30); signed-in users go to their area.
function Root() {
  const { session, loading } = useAuth()
  if (!loading && !session) return <Navigate to="/camp" replace />
  return <ProtectedRoute />
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot" element={<ForgotPasswordPage />} />
          <Route path="/reset" element={<ResetPasswordPage />} />
          <Route path="/apply" element={<VolunteerApplyPage />} />
          <Route path="/camp" element={<CampPage />} />
          <Route path="/camp/confirm" element={<CampListLinkPage kind="confirm" />} />
          <Route path="/camp/unsubscribe" element={<CampListLinkPage kind="unsubscribe" />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Role-gated */}
          {/* Two-step sign-in for admins (spec 27): any signed-in user can reach it. */}
          <Route element={<ProtectedRoute />}>
            <Route path="/mfa" element={<MfaPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route element={<MfaGate />}>
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
              <Route path="/admin/updates" element={<AdminUpdates />} />
              <Route path="/admin/help" element={<AdminHelp />} />
            </Route>
            </Route>
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['volunteer']} />}>
            <Route element={<VolunteerLayout />}>
              <Route path="/volunteer" element={<VolunteerToday />} />
              <Route path="/volunteer/classes" element={<VolunteerClasses />} />
              <Route path="/volunteer/duties" element={<VolunteerDuties />} />
              <Route path="/volunteer/updates" element={<VolunteerUpdates />} />
              <Route path="/volunteer/profile" element={<VolunteerProfile />} />
              <Route path="/volunteer/help" element={<VolunteerHelp />} />
            </Route>
          </Route>

          {/* Paper fallback: printable section roster for admins and the section's crew */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'volunteer']} />}>
            <Route element={<MfaGate />}>
              <Route path="/print/roster/:sectionId" element={<PrintRoster />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['parent']} />}>
            <Route element={<ParentLayout />}>
              <Route path="/parent" element={<ParentDashboard />} />
              <Route path="/parent/classes" element={<ClassBrowser />} />
              <Route path="/parent/register" element={<ParentRegistrationPage />} />
              <Route path="/parent/updates" element={<ParentUpdates />} />
              <Route path="/parent/family" element={<ParentFamily />} />
              <Route path="/parent/help" element={<ParentHelp />} />
            </Route>
          </Route>

          {/* Root → the camp page when signed out, else redirect based on role */}
          <Route path="/" element={<Root />}>
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
