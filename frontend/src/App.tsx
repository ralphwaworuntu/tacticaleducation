import { Routes, Route, Navigate } from 'react-router-dom';
import { PublicLayout } from '@/layouts/PublicLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { ProtectedRoute } from '@/layouts/ProtectedRoute';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { AdminLayout } from '@/layouts/AdminLayout';
import { HomePage } from '@/pages/public/HomePage';
import { ProfilePage } from '@/pages/public/ProfilePage';
import { PackagesPage } from '@/pages/public/PackagesPage';
import { GalleryPage } from '@/pages/public/GalleryPage';
import { TestimonialsPage } from '@/pages/public/TestimonialsPage';
import { ContactPage } from '@/pages/public/ContactPage';
import { ParentPage } from '@/pages/public/ParentPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { VerifyEmailPage } from '@/pages/auth/VerifyEmailPage';
import { DashboardHomePage } from '@/pages/dashboard/DashboardHomePage';
import { AnnouncementsPage } from '@/pages/dashboard/AnnouncementsPage';
import { FAQPage } from '@/pages/dashboard/FAQPage';
import { NewsPage } from '@/pages/dashboard/NewsPage';
import { CalculatorPage } from '@/pages/dashboard/CalculatorPage';
import { TryoutPage } from '@/pages/dashboard/TryoutPage';
import { TryoutCategoriesPage } from '@/pages/dashboard/TryoutCategoriesPage';
import { TryoutSubCategoriesPage } from '@/pages/dashboard/TryoutSubCategoriesPage';
import { TryoutListPage } from '@/pages/dashboard/TryoutListPage';
import { TryoutDetailPage } from '@/pages/dashboard/TryoutDetailPage';
import { TryoutHistoryPage } from '@/pages/dashboard/TryoutHistoryPage';
import { TryoutReviewPage } from '@/pages/dashboard/TryoutReviewPage';
import { PracticePage } from '@/pages/dashboard/PracticePage';
import { PracticeCategoriesPage } from '@/pages/dashboard/PracticeCategoriesPage';
import { PracticeSubCategoriesPage } from '@/pages/dashboard/PracticeSubCategoriesPage';
import { PracticeSubSubCategoriesPage } from '@/pages/dashboard/PracticeSubSubCategoriesPage';
import { PracticeSetsPage } from '@/pages/dashboard/PracticeSetsPage';
import { PracticeDetailPage } from '@/pages/dashboard/PracticeDetailPage';
import { PracticeHistoryPage } from '@/pages/dashboard/PracticeHistoryPage';
import { PracticeReviewPage } from '@/pages/dashboard/PracticeReviewPage';
import { ExamTryoutPage } from '@/pages/dashboard/ExamTryoutPage';
import { ExamTryoutCategoriesPage } from '@/pages/dashboard/ExamTryoutCategoriesPage';
import { ExamTryoutSubCategoriesPage } from '@/pages/dashboard/ExamTryoutSubCategoriesPage';
import { ExamTryoutListPage } from '@/pages/dashboard/ExamTryoutListPage';
import { ExamTryoutDetailPage } from '@/pages/dashboard/ExamTryoutDetailPage';
import { ExamTryoutHistoryPage } from '@/pages/dashboard/ExamTryoutHistoryPage';
import { ExamTryoutReviewPage } from '@/pages/dashboard/ExamTryoutReviewPage';
import { ExamPracticePage } from '@/pages/dashboard/ExamPracticePage';
import { ExamPracticeCategoriesPage } from '@/pages/dashboard/ExamPracticeCategoriesPage';
import { ExamPracticeSubCategoriesPage } from '@/pages/dashboard/ExamPracticeSubCategoriesPage';
import { ExamPracticeSubSubCategoriesPage } from '@/pages/dashboard/ExamPracticeSubSubCategoriesPage';
import { ExamPracticeSetsPage } from '@/pages/dashboard/ExamPracticeSetsPage';
import { ExamPracticeDetailPage } from '@/pages/dashboard/ExamPracticeDetailPage';
import { ExamPracticeHistoryPage } from '@/pages/dashboard/ExamPracticeHistoryPage';
import { ExamPracticeReviewPage } from '@/pages/dashboard/ExamPracticeReviewPage';
import { CermatPage } from '@/pages/dashboard/CermatPage';
import { CermatHistoryPage } from '@/pages/dashboard/CermatHistoryPage';
import { MaterialsPage } from '@/pages/dashboard/MaterialsPage';
import { MembershipPage } from '@/pages/dashboard/MembershipPage';
import { TransactionsPage } from '@/pages/dashboard/TransactionsPage';
import { ReferralPage } from '@/pages/dashboard/ReferralPage';
import { PaymentConfirmationPage } from '@/pages/dashboard/PaymentConfirmationPage';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { AdminLandingPage } from '@/pages/admin/AdminLandingPage';
import { AdminAnnouncementsPage } from '@/pages/admin/AdminAnnouncementsPage';
import { AdminTryoutsPage } from '@/pages/admin/AdminTryoutsPage';
import { AdminPracticePage } from '@/pages/admin/AdminPracticePage';
import { AdminMaterialsPage } from '@/pages/admin/AdminMaterialsPage';
import { AdminCommercePage } from '@/pages/admin/AdminCommercePage';
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage';
import { AdminMemberActivationPage } from '@/pages/admin/AdminMemberActivationPage';
import { AdminMemberProgressPage } from '@/pages/admin/AdminMemberProgressPage';
import { AdminMonitoringPage } from '@/pages/admin/AdminMonitoringPage';
import { AdminContactsPage } from '@/pages/admin/AdminContactsPage';
import { AdminCalculatorsPage } from '@/pages/admin/AdminCalculatorsPage';
import { AdminReportingPage } from '@/pages/admin/AdminReportingPage';
import { AdminExamControlPage } from '@/pages/admin/AdminExamControlPage';
import { AdminRankingPage } from '@/pages/admin/AdminRankingPage';

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/profil" element={<ProfilePage />} />
        <Route path="/paket-bimbel" element={<PackagesPage />} />
        <Route path="/galeri" element={<GalleryPage />} />
        <Route path="/testimoni" element={<TestimonialsPage />} />
        <Route path="/hubungi-kami" element={<ContactPage />} />
        <Route path="/orang-tua" element={<ParentPage />} />
      </Route>

      <Route element={<AuthLayout />}>
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth/verify" element={<VerifyEmailPage />} />
      </Route>

      <Route path="/app" element={<ProtectedRoute roles={['MEMBER']} />}>
        <Route element={<DashboardLayout />}>
          <Route index element={<DashboardHomePage />} />
          <Route path="pengumuman" element={<AnnouncementsPage />} />
          <Route path="faq" element={<FAQPage />} />
          <Route path="berita" element={<NewsPage />} />
          <Route path="kalkulator" element={<CalculatorPage />} />
          <Route path="latihan/tryout" element={<TryoutCategoriesPage />} />
          <Route path="latihan/tryout/kategori/:categoryId" element={<TryoutSubCategoriesPage />} />
          <Route path="latihan/tryout/kategori/:categoryId/sub/:subCategoryId" element={<TryoutListPage />} />
          <Route path="latihan/tryout/mulai" element={<TryoutPage />} />
          <Route path="latihan/tryout/detail/:slug" element={<TryoutDetailPage />} />
          <Route path="latihan/tryout/riwayat" element={<TryoutHistoryPage />} />
          <Route path="latihan/tryout/review/:resultId" element={<TryoutReviewPage />} />
          <Route path="latihan-soal" element={<PracticeCategoriesPage />} />
          <Route path="latihan-soal/kategori/:categorySlug" element={<PracticeSubCategoriesPage />} />
          <Route path="latihan-soal/kategori/:categorySlug/sub/:subCategoryId" element={<PracticeSubSubCategoriesPage />} />
          <Route path="latihan-soal/kategori/:categorySlug/sub/:subCategoryId/subsub/:subSubId" element={<PracticeSetsPage />} />
          <Route path="latihan-soal/mulai" element={<PracticePage />} />
          <Route path="latihan-soal/detail/:slug" element={<PracticeDetailPage />} />
          <Route path="latihan-soal/riwayat" element={<PracticeHistoryPage />} />
          <Route path="latihan-soal/review/:resultId" element={<PracticeReviewPage />} />
          <Route path="ujian/tryout" element={<ExamTryoutCategoriesPage />} />
          <Route path="ujian/tryout/kategori/:categoryId" element={<ExamTryoutSubCategoriesPage />} />
          <Route path="ujian/tryout/kategori/:categoryId/sub/:subCategoryId" element={<ExamTryoutListPage />} />
          <Route path="ujian/tryout/mulai" element={<ExamTryoutPage />} />
          <Route path="ujian/tryout/detail/:slug" element={<ExamTryoutDetailPage />} />
          <Route path="ujian/tryout/riwayat" element={<ExamTryoutHistoryPage />} />
          <Route path="ujian/tryout/review/:resultId" element={<ExamTryoutReviewPage />} />
          <Route path="ujian/soal" element={<ExamPracticeCategoriesPage />} />
          <Route path="ujian/soal/kategori/:categorySlug" element={<ExamPracticeSubCategoriesPage />} />
          <Route path="ujian/soal/kategori/:categorySlug/sub/:subCategoryId" element={<ExamPracticeSubSubCategoriesPage />} />
          <Route path="ujian/soal/kategori/:categorySlug/sub/:subCategoryId/subsub/:subSubId" element={<ExamPracticeSetsPage />} />
          <Route path="ujian/soal/mulai" element={<ExamPracticePage />} />
          <Route path="ujian/soal/detail/:slug" element={<ExamPracticeDetailPage />} />
          <Route path="ujian/soal/riwayat" element={<ExamPracticeHistoryPage />} />
          <Route path="ujian/soal/review/:resultId" element={<ExamPracticeReviewPage />} />
          <Route path="tes-kecermatan" element={<CermatPage />} />
          <Route path="tes-kecermatan/riwayat" element={<CermatHistoryPage />} />
          <Route path="materi" element={<MaterialsPage />} />
          <Route path="paket-membership" element={<MembershipPage />} />
          <Route path="konfirmasi-pembayaran" element={<PaymentConfirmationPage />} />
          <Route path="riwayat-transaksi" element={<TransactionsPage />} />
          <Route path="afiliasi" element={<ReferralPage />} />
        </Route>
      </Route>

      <Route path="/admin" element={<ProtectedRoute roles={['ADMIN']} />}>
        <Route element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="landing" element={<AdminLandingPage />} />
          <Route path="announcements" element={<AdminAnnouncementsPage />} />
          <Route path="exam-control" element={<AdminExamControlPage />} />
          <Route path="tryouts" element={<AdminTryoutsPage />} />
          <Route path="practice" element={<AdminPracticePage />} />
          <Route path="materials" element={<AdminMaterialsPage />} />
          <Route path="commerce" element={<AdminCommercePage />} />
          <Route path="activation" element={<AdminMemberActivationPage />} />
          <Route path="monitoring" element={<AdminMemberProgressPage />} />
          <Route path="system-monitoring" element={<AdminMonitoringPage />} />
          <Route path="reporting" element={<AdminReportingPage />} />
          <Route path="ranking" element={<AdminRankingPage />} />
          <Route path="contacts" element={<AdminContactsPage />} />
          <Route path="calculators" element={<AdminCalculatorsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
