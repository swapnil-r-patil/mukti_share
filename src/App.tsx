import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { toast as sonnerToast } from "sonner";
import { useEffect, useRef } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";

// Lazy-load pages for better initial performance
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const WorkerDashboard = lazy(() => import("@/pages/WorkerDashboard"));
const WorkerProfile = lazy(() => import("@/pages/WorkerProfile"));
const QRScreen = lazy(() => import("@/pages/QRScreen"));
const CustomerVerification = lazy(() => import("@/pages/CustomerVerification"));
const CustomerActivity = lazy(() => import("@/pages/CustomerActivity"));
const CustomerDashboard = lazy(() => import("@/pages/CustomerDashboard"));
const LiveTracking = lazy(() => import("@/pages/LiveTracking"));
const ReportPreview = lazy(() => import("@/pages/ReportPreview"));
const EmployerVerificationPage = lazy(() => import("@/pages/EmployerVerificationPage"));
const AdminOverview = lazy(() => import("@/pages/admin/AdminOverview"));
const AdminWorkers = lazy(() => import("@/pages/admin/AdminWorkers"));
const AdminCustomers = lazy(() => import("@/pages/admin/AdminCustomers"));
const AdminFraud = lazy(() => import("@/pages/admin/AdminFraud"));
const AdminReviews = lazy(() => import("@/pages/admin/AdminReviews"));
const AdminSettings = lazy(() => import("@/pages/admin/AdminSettings"));
const AdminRequests = lazy(() => import("@/pages/admin/AdminRequests"));
const AdminWorkerDetail = lazy(() => import("@/pages/admin/AdminWorkerDetail"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Leaderboard = lazy(() => import("@/pages/Leaderboard"));
const LiveImpact = lazy(() => import("@/pages/LiveImpact"));
const SchemesMatcher = lazy(() => import("@/pages/SchemesMatcher"));
const JobMap = lazy(() => import("@/pages/JobMap"));
const PublicReport = lazy(() => import("@/pages/PublicReport"));

// Loading fallback component
const PageLoader = () => (
  <div className="flex h-[60vh] w-full items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
  </div>
);

const queryClient = new QueryClient();

const MainLayout = () => {
  const { user } = useAuth();
  const showBottomNav = !!user;
  
  return (
    <>
      <div className="flex flex-col min-h-screen">
        {user?.role !== "admin" && <AppHeader />}
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<LoginPage />} />
            
            {/* Worker Routes */}
            <Route path="/dashboard" element={<ProtectedRoute allowedRoles={["worker"]}><WorkerDashboard /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute allowedRoles={["worker"]}><WorkerProfile /></ProtectedRoute>} />
            <Route path="/qr" element={<ProtectedRoute allowedRoles={["worker"]}><QRScreen /></ProtectedRoute>} />
            <Route path="/schemes" element={<ProtectedRoute allowedRoles={["worker"]}><SchemesMatcher /></ProtectedRoute>} />
            <Route path="/jobs/map" element={<ProtectedRoute allowedRoles={["worker"]}><JobMap /></ProtectedRoute>} />
            
            {/* Customer Routes */}
            <Route path="/customer" element={<ProtectedRoute allowedRoles={["customer"]}><CustomerDashboard /></ProtectedRoute>} />
            <Route path="/verify/:workerId?/:jobId?" element={<ProtectedRoute allowedRoles={["customer"]}><CustomerVerification /></ProtectedRoute>} />
            <Route path="/activity" element={<ProtectedRoute allowedRoles={["customer"]}><CustomerActivity /></ProtectedRoute>} />
            <Route path="/tracking/:jobId" element={<ProtectedRoute allowedRoles={["customer"]}><LiveTracking /></ProtectedRoute>} />
            <Route path="/verify/job-complete/:jobId" element={<ProtectedRoute allowedRoles={["customer"]}><LiveTracking /></ProtectedRoute>} />
            <Route path="/report" element={<ProtectedRoute allowedRoles={["worker", "customer"]}><ReportPreview /></ProtectedRoute>} />
            <Route path="/employer-verify/:workerId" element={<ProtectedRoute allowedRoles={["customer"]}><EmployerVerificationPage /></ProtectedRoute>} />

            {/* Public Routes */}
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/impact" element={<LiveImpact />} />
            <Route path="/report/public/:reportId" element={<PublicReport />} />

            {/* Admin Routes */}
            <Route path="/admin/*" element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminLayout>
                  <Routes>
                    <Route path="dashboard" element={<AdminOverview />} />
                    <Route path="workers" element={<AdminWorkers />} />
                    <Route path="customers" element={<AdminCustomers />} />
                    <Route path="fraud" element={<AdminFraud />} />
                    <Route path="reviews" element={<AdminReviews />} />
                    <Route path="requests" element={<AdminRequests />} />
                    <Route path="worker/:workerId" element={<AdminWorkerDetail />} />
                    <Route path="settings" element={<AdminSettings />} />
                    {/* Fallback for /admin/analytics etc to dashboard for now */}
                    <Route path="*" element={<AdminOverview />} />
                  </Routes>
                </AdminLayout>
              </ProtectedRoute>
            } />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        {showBottomNav && user?.role !== "admin" && <BottomNav />}
      </div>
    </>
  );
};

const ConnectivityListener = () => {
  const isOnline = useOnlineStatus();
  const prevStatus = useRef(isOnline);

  useEffect(() => {
    if (prevStatus.current !== isOnline) {
      if (isOnline) {
        sonnerToast.success("Back Online", {
          description: "Your changes are being synced to the server.",
          duration: 3000,
        });
      } else {
        sonnerToast.warning("Offline Mode", {
          description: "You're working offline. Changes will sync when reconnected.",
          duration: 5000,
        });
      }
      prevStatus.current = isOnline;
    }
  }, [isOnline]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ConnectivityListener />
      <LanguageProvider>
        <AuthProvider>
          <BrowserRouter>
            <MainLayout />
          </BrowserRouter>
        </AuthProvider>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
