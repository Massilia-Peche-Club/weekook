import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';

const HomePage = lazy(() => import('@/pages/HomePage').then(m => ({ default: m.default })));
const SearchPage = lazy(() => import('@/pages/SearchPage').then(m => ({ default: m.default })));
const KookerProfilePage = lazy(() => import('@/pages/KookerProfilePage').then(m => ({ default: m.default })));
const LoginPage = lazy(() => import('@/pages/LoginPage').then(m => ({ default: m.default })));
const PricingPage = lazy(() => import('@/pages/PricingPage').then(m => ({ default: m.default })));
const AboutPage = lazy(() => import('@/pages/AboutPage').then(m => ({ default: m.default })));
const BenefitsPage = lazy(() => import('@/pages/BenefitsPage').then(m => ({ default: m.default })));
const TrustPage = lazy(() => import('@/pages/TrustPage').then(m => ({ default: m.default })));
const UserDashboardPage = lazy(() => import('@/pages/UserDashboardPage').then(m => ({ default: m.default })));
const KookerDashboardPage = lazy(() => import('@/pages/KookerDashboardPage').then(m => ({ default: m.default })));
const BecomeKookerPage = lazy(() => import('@/pages/BecomeKookerPage').then(m => ({ default: m.default })));
const CreateMenuPage = lazy(() => import('@/pages/CreateMenuPage').then(m => ({ default: m.default })));
const EditMenuPage = lazy(() => import('@/pages/EditMenuPage').then(m => ({ default: m.default })));
const BookingPage = lazy(() => import('@/pages/BookingPage').then(m => ({ default: m.default })));
const FaqPage = lazy(() => import('@/pages/FaqPage').then(m => ({ default: m.default })));
const MessagesPage = lazy(() => import('@/pages/MessagesPage').then(m => ({ default: m.default })));
const BookingDetailPage = lazy(() => import('@/pages/BookingDetailPage').then(m => ({ default: m.default })));
const ServiceDetailPage = lazy(() => import('@/pages/ServiceDetailPage').then(m => ({ default: m.default })));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then(m => ({ default: m.default })));
const UserProfilePage = lazy(() => import('@/pages/UserProfilePage').then(m => ({ default: m.default })));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage').then(m => ({ default: m.default })));
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout').then(m => ({ default: m.default })));
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage').then(m => ({ default: m.default })));
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage').then(m => ({ default: m.default })));
const AdminKookersPage = lazy(() => import('@/pages/admin/AdminKookersPage').then(m => ({ default: m.default })));
const AdminBookingsPage = lazy(() => import('@/pages/admin/AdminBookingsPage').then(m => ({ default: m.default })));
const AdminTestimonialsPage = lazy(() => import('@/pages/admin/AdminTestimonialsPage').then(m => ({ default: m.default })));
const AdminConfigPage = lazy(() => import('@/pages/admin/AdminConfigPage').then(m => ({ default: m.default })));
const AdminServicesPage = lazy(() => import('@/pages/admin/AdminServicesPage').then(m => ({ default: m.default })));

function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/connexion" replace />;
  if (!user.isAdmin) return <Navigate to="/tableau-de-bord" replace />;
  return <>{children}</>;
}

export function AppRouter() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route element={<PageLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/recherche" element={<SearchPage />} />
          <Route path="/kooker/:id" element={<KookerProfilePage />} />
          <Route path="/prestation/:id" element={<ServiceDetailPage />} />
          <Route path="/tarification" element={<PricingPage />} />
          <Route path="/a-propos" element={<AboutPage />} />
          <Route path="/avantages" element={<BenefitsPage />} />
          <Route path="/confiance" element={<TrustPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/tableau-de-bord" element={
            <ProtectedRoute><UserDashboardPage /></ProtectedRoute>
          } />
          <Route path="/devenir-kooker" element={
            <ProtectedRoute><BecomeKookerPage /></ProtectedRoute>
          } />
          <Route path="/kooker-dashboard" element={
            <ProtectedRoute><KookerDashboardPage /></ProtectedRoute>
          } />
          <Route path="/kooker-dashboard/menu/nouveau" element={
            <ProtectedRoute><CreateMenuPage /></ProtectedRoute>
          } />
          <Route path="/kooker-dashboard/menu/:id/editer" element={
            <ProtectedRoute><EditMenuPage /></ProtectedRoute>
          } />
          <Route path="/reservation" element={
            <ProtectedRoute><BookingPage /></ProtectedRoute>
          } />
          <Route path="/messagerie" element={
            <ProtectedRoute><MessagesPage /></ProtectedRoute>
          } />
          <Route path="/messages" element={<Navigate to="/messagerie" replace />} />
          <Route path="/reservation/:id" element={
            <ProtectedRoute><BookingDetailPage /></ProtectedRoute>
          } />
          <Route path="/mon-profil" element={
            <ProtectedRoute><UserProfilePage /></ProtectedRoute>
          } />
            <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="/connexion" element={<LoginPage />} />
        <Route path="/reinitialiser-mot-de-passe" element={<ResetPasswordPage />} />
        <Route path="/admin" element={<AdminProtectedRoute><AdminLayout /></AdminProtectedRoute>}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="utilisateurs" element={<AdminUsersPage />} />
          <Route path="kookers" element={<AdminKookersPage />} />
          <Route path="reservations" element={<AdminBookingsPage />} />
          <Route path="services" element={<AdminServicesPage />} />
          <Route path="temoignages" element={<AdminTestimonialsPage />} />
          <Route path="configuration" element={<AdminConfigPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
