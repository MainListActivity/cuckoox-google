
import React, { Suspense, ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Lazy load pages for better performance
const HomePage = React.lazy(() => import('./pages/HomePage'));
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const CaseListPage = React.lazy(() => import('./pages/CaseListPage'));
const CaseDetailPage = React.lazy(() => import('./pages/CaseDetailPage'));
const CreditorListPage = React.lazy(() => import('./pages/CreditorListPage'));
const ClaimListPage = React.lazy(() => import('./pages/ClaimListPage'));
const ClaimSubmissionPage = React.lazy(() => import('./pages/ClaimSubmissionPage'));
const ClaimReviewDetailPage = React.lazy(() => import('./pages/ClaimReviewDetailPage'));
const ClaimDataDashboardPage = React.lazy(() => import('./pages/ClaimDataDashboardPage'));
const OnlineMeetingPage = React.lazy(() => import('./pages/OnlineMeetingPage'));
const MessageCenterPage = React.lazy(() => import('./pages/MessageCenterPage'));
const AdminPage = React.lazy(() => import('./pages/AdminPage'));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage'));
const CaseSelectionPage = React.lazy(() => import('./pages/CaseSelectionPage'));


function App() {
  const { isLoggedIn } = useAuth();
  const location = useLocation();

  // Define routes that don't need the main layout (e.g., Login)
  if (location.pathname === '/login') {
    return (
      <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading...</div>}>
        <Routes>
          <Route path="/login" element={isLoggedIn ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <Layout>
      <Suspense fallback={<div className="p-4">Loading page...</div>}>
        <Routes>
          {/* FIX: Cast element to ReactNode to resolve type ambiguity */}
          <Route path="/" element={<HomePage /> as ReactNode} />
          {/* Guest only route, handled above for full page layout */}
          {/* <Route path="/login" element={isLoggedIn ? <Navigate to="/dashboard" replace /> : <LoginPage />} /> */}
          
          {/* FIX: Cast element to ReactNode to resolve type ambiguity */}
          <Route path="/select-case" element={<ProtectedRoute><CaseSelectionPage /></ProtectedRoute> as ReactNode} />
          {/* FIX: Cast element to ReactNode to resolve type ambiguity */}
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute> as ReactNode} />
          
          {/* FIX: Cast element to ReactNode to resolve type ambiguity */}
          <Route path="/cases" element={<ProtectedRoute><CaseListPage /></ProtectedRoute> as ReactNode} />
          {/* FIX: Cast element to ReactNode to resolve type ambiguity */}
          <Route path="/cases/:id" element={<ProtectedRoute><CaseDetailPage /></ProtectedRoute> as ReactNode} />
          
          {/* FIX: Cast element to ReactNode to resolve type ambiguity */}
          <Route path="/creditors" element={<ProtectedRoute><CreditorListPage /></ProtectedRoute> as ReactNode} />
          
          {/* FIX: Cast element to ReactNode to resolve type ambiguity */}
          <Route path="/claims" element={<ProtectedRoute><ClaimListPage /></ProtectedRoute> as ReactNode} />
          {/* FIX: Cast element to ReactNode to resolve type ambiguity */}
          <Route path="/claims/submit" element={<ProtectedRoute><ClaimSubmissionPage /></ProtectedRoute> as ReactNode} />
          {/* FIX: Cast element to ReactNode to resolve type ambiguity */}
          <Route path="/claims/:id/review" element={<ProtectedRoute><ClaimReviewDetailPage /></ProtectedRoute> as ReactNode} />
          
          {/* FIX: Cast element to ReactNode to resolve type ambiguity */}
          <Route path="/claim-dashboard" element={<ProtectedRoute><ClaimDataDashboardPage /></ProtectedRoute> as ReactNode} />
          {/* FIX: Cast element to ReactNode to resolve type ambiguity */}
          <Route path="/online-meetings" element={<ProtectedRoute><OnlineMeetingPage /></ProtectedRoute> as ReactNode} />
          {/* FIX: Cast element to ReactNode to resolve type ambiguity */}
          <Route path="/messages" element={<ProtectedRoute><MessageCenterPage /></ProtectedRoute> as ReactNode} />
          
          {/* FIX: Cast element to ReactNode to resolve type ambiguity */}
          <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminPage /></ProtectedRoute> as ReactNode} />
          
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

export default App;