import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'

// Layouts
import PublicLayout from '@/components/layout/PublicLayout'
import AdminLayout from '@/components/layout/AdminLayout'
import AdminRoute from '@/components/layout/AdminRoute'
import CustomerRoute from '@/components/layout/CustomerRoute'

// Public pages
import EventListPage from '@/pages/public/EventListPage'
import EventDetailPage from '@/pages/public/EventDetailPage'
import ReservationPage from '@/pages/public/ReservationPage'
import ReservationCompletePage from '@/pages/public/ReservationCompletePage'
import WaitlistPage from '@/pages/public/WaitlistPage'
import CustomerLoginPage from '@/pages/public/CustomerLoginPage'
import CustomerRegisterPage from '@/pages/public/CustomerRegisterPage'
import MyPage from '@/pages/public/MyPage'

// Admin pages
import LoginPage from '@/pages/admin/LoginPage'
import DashboardPage from '@/pages/admin/DashboardPage'
import AdminEventListPage from '@/pages/admin/AdminEventListPage'
import EventFormPage from '@/pages/admin/EventFormPage'
import ReservationListPage from '@/pages/admin/ReservationListPage'
import CautionEditPage from '@/pages/admin/CautionEditPage'
import SurveyEditPage from '@/pages/admin/SurveyEditPage'
import StatsPage from '@/pages/admin/StatsPage'
import BulkEmailPage from '@/pages/admin/BulkEmailPage'
import EmailHistoryPage from '@/pages/admin/EmailHistoryPage'
import WaitlistManagePage from '@/pages/admin/WaitlistManagePage'
import ReminderSettingsPage from '@/pages/admin/ReminderSettingsPage'
import TimeSlotSettingsPage from '@/pages/admin/TimeSlotSettingsPage'
import EventDatesPage from '@/pages/admin/EventDatesPage'
import TemplatesPage from '@/pages/admin/TemplatesPage'
import CustomerListPage from '@/pages/admin/CustomerListPage'
import CustomerDetailPage from '@/pages/admin/CustomerDetailPage'

// 404
import NotFoundPage from '@/pages/NotFoundPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<EventListPage />} />
          <Route path="/events/:id" element={<EventDetailPage />} />
          <Route path="/events/:id/reserve" element={<ReservationPage />} />
          <Route path="/events/:id/reserve/complete" element={<ReservationCompletePage />} />
          <Route path="/events/:id/waitlist" element={<WaitlistPage />} />
        </Route>

        {/* Customer auth (standalone layout) */}
        <Route path="/login" element={<CustomerLoginPage />} />
        <Route path="/register" element={<CustomerRegisterPage />} />

        {/* Customer protected routes */}
        <Route element={<CustomerRoute />}>
          <Route element={<PublicLayout />}>
            <Route path="/mypage" element={<MyPage />} />
          </Route>
        </Route>

        {/* Admin login */}
        <Route path="/admin/login" element={<LoginPage />} />

        {/* Protected admin routes */}
        <Route element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<DashboardPage />} />
            <Route path="/admin/events" element={<AdminEventListPage />} />
            <Route path="/admin/events/new" element={<EventFormPage />} />
            <Route path="/admin/events/:id/edit" element={<EventFormPage />} />
            <Route path="/admin/events/:id/reservations" element={<ReservationListPage />} />
            <Route path="/admin/events/:id/caution" element={<CautionEditPage />} />
            <Route path="/admin/events/:id/survey" element={<SurveyEditPage />} />
            <Route path="/admin/events/:id/stats" element={<StatsPage />} />
            <Route path="/admin/events/:id/email" element={<BulkEmailPage />} />
            <Route path="/admin/events/:id/email/history" element={<EmailHistoryPage />} />
            <Route path="/admin/events/:id/waitlist" element={<WaitlistManagePage />} />
            <Route path="/admin/events/:id/reminders" element={<ReminderSettingsPage />} />
            <Route path="/admin/events/:id/time-slots" element={<TimeSlotSettingsPage />} />
            <Route path="/admin/events/:id/dates" element={<EventDatesPage />} />
            <Route path="/admin/templates" element={<TemplatesPage />} />
            <Route path="/admin/customers" element={<CustomerListPage />} />
            <Route path="/admin/customers/:id" element={<CustomerDetailPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  )
}
