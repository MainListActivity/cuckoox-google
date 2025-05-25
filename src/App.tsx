import React, {Suspense, ReactNode} from 'react';
import {Routes, Route, Navigate, useLocation} from 'react-router-dom';
import {useAuth} from './contexts/AuthContext';
import {useSurreal} from './contexts/SurrealProvider'; // ADDED
import {useTranslation} from 'react-i18next'; // ADDED
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import GlobalLoader from './components/GlobalLoader'; // ADDED
import GlobalError from './components/GlobalError'; // ADDED

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
const OidcCallbackPage = React.lazy(() => import('./pages/OidcCallbackPage')); // <-- IMPORT
const CreateCasePage = React.lazy(() => import('./pages/CreateCasePage')); // <-- IMPORT


function App() {
    const {isSuccess, isConnecting, isError, error: surrealError} = useSurreal(); // ADDED
    const {t} = useTranslation(); // ADDED
    const {isLoggedIn} = useAuth();
    const location = useLocation();

    // Handle SurrealDB connection status
    if (isConnecting) {
        return <GlobalLoader message={t('loader.connectingMessage', 'Connecting to database...')}/>;
    }

    if (isError) {
        return (
            <GlobalError
                title={t('error.globalTitle', 'Application Error')}
                message={surrealError ? surrealError.message : t('error.unknownDbError', 'An unknown database error occurred.')}
            />
        );
    }

    // Potentially handle disconnected state differently, e.g., show a specific message or loader
    if (!isSuccess && !surrealError) { // No initial connection error, but now disconnected
        return <GlobalLoader
            message={t('error.disconnectedMessage', 'Database connection lost. Attempting to reconnect...')}/>;
        // Or use GlobalError:
        // return (
        //   <GlobalError
        //     title={t('error.disconnectedTitle', 'Disconnected')}
        //     message={t('error.disconnectedMessage', 'Database connection lost. Attempting to reconnect...')}
        //   />
        // );
    }

    // If connected, proceed with the rest of the application logic

    // Define routes that don't need the main layout (e.g., Login, OidcCallback)
    if (location.pathname === '/login' || location.pathname === '/oidc-callback') {
        return (
            <Suspense fallback={<GlobalLoader message={t('loader.pageLoading', 'Loading page...')}/>}>
                <Routes>
                    <Route path="/login" element={isLoggedIn ? <Navigate to="/dashboard" replace/> : <LoginPage/>}/>
                    <Route path="/oidc-callback" element={<OidcCallbackPage/>}/>
                </Routes>
            </Suspense>
        );
    }

    return (
        <Layout>
            <Suspense fallback={<GlobalLoader message={t('loader.pageLoading', 'Loading page...')}/>}>
                <Routes>
                    <Route path="/" element={<HomePage/> as ReactNode}/>
                    <Route path="/select-case"
                           element={<ProtectedRoute><CaseSelectionPage/></ProtectedRoute> as ReactNode}/>
                    <Route path="/dashboard" element={<ProtectedRoute><DashboardPage/></ProtectedRoute> as ReactNode}/>
                    <Route path="/cases" element={<ProtectedRoute><CaseListPage/></ProtectedRoute> as ReactNode}/>
                    <Route path="/cases/create"
                           element={<ProtectedRoute><CreateCasePage/></ProtectedRoute> as ReactNode}/>
                    <Route path="/cases/:id" element={<ProtectedRoute><CaseDetailPage/></ProtectedRoute> as ReactNode}/>
                    <Route path="/creditors"
                           element={<ProtectedRoute><CreditorListPage/></ProtectedRoute> as ReactNode}/>
                    <Route path="/claims" element={<ProtectedRoute><ClaimListPage/></ProtectedRoute> as ReactNode}/>
                    <Route path="/claims/submit"
                           element={<ProtectedRoute><ClaimSubmissionPage/></ProtectedRoute> as ReactNode}/>
                    <Route path="/claims/:id/review"
                           element={<ProtectedRoute><ClaimReviewDetailPage/></ProtectedRoute> as ReactNode}/>
                    <Route path="/claim-dashboard"
                           element={<ProtectedRoute><ClaimDataDashboardPage/></ProtectedRoute> as ReactNode}/>
                    <Route path="/online-meetings"
                           element={<ProtectedRoute><OnlineMeetingPage/></ProtectedRoute> as ReactNode}/>
                    <Route path="/messages"
                           element={<ProtectedRoute><MessageCenterPage/></ProtectedRoute> as ReactNode}/>
                    <Route path="/admin"
                           element={<ProtectedRoute requiredRole="admin"><AdminPage/></ProtectedRoute> as ReactNode}/>
                    <Route path="*" element={<NotFoundPage/>}/>
                </Routes>
            </Suspense>
        </Layout>
    );
}

export default App;