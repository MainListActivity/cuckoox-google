import React, {Suspense, ReactNode, useEffect} from 'react';
import {Routes, Route, Navigate, useLocation, useNavigate} from 'react-router-dom';
import {useAuth} from '@/src/contexts/AuthContext';
import {useSurreal} from '@/src/contexts/SurrealProvider';
import {useTranslation} from 'react-i18next';
// Remove MUI ThemeProvider, use our own from ThemeContext
// import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'; 
// import theme from './theme'; // This is likely MUI theme, not our custom one
import { CustomThemeProvider } from '@/src/contexts/ThemeContext'; // Import our ThemeProvider
import { SnackbarProvider } from '@/src/contexts/SnackbarContext'; // Import SnackbarProvider
import { CaseStatusProvider } from '@/src/contexts/CaseStatusContext'; // <-- ADDED
import { LayoutProvider } from '@/src/contexts/LayoutContext'; // Import LayoutProvider
import Layout from '@/src/components/Layout';
import ProtectedRoute from '@/src/components/ProtectedRoute';
import GlobalLoader from '@/src/components/GlobalLoader'; // ADDED
import GlobalError from '@/src/components/GlobalError'; // ADDED

// Lazy load pages for better performance
const HomePage = React.lazy(() => import('@/src/pages/index'));
const DocumentCenterDemo = React.lazy(() => import('@/src/pages/documents/demo'));
const LoginPage = React.lazy(() => import('@/src/pages/login'));
const DashboardPage = React.lazy(() => import('@/src/pages/dashboard/index'));
const CaseListPage = React.lazy(() => import('@/src/pages/cases/index'));
const CaseDetailPage = React.lazy(() => import('@/src/pages/cases/[caseId]'));
const CreditorListPage = React.lazy(() => import('@/src/pages/creditors/index')); // MODIFIED PATH
const ClaimListPage = React.lazy(() => import('@/src/pages/claims/index'));
const ClaimSubmissionPage = React.lazy(() => import('@/src/pages/claims/submit'));
const ClaimAttachmentPage = React.lazy(() => import('@/src/pages/claims/attachment'));
const SubmittedClaimDetailPage = React.lazy(() => import('@/src/pages/my-claims/[claimId]'));
const MyClaimsPage = React.lazy(() => import('@/src/pages/my-claims/index'));
const AccessDeniedPage = React.lazy(() => import('@/src/pages/access-denied'));
const AccessDeniedRolePage = React.lazy(() => import('@/src/pages/access-denied-role'));
const CaseStatusToggler = React.lazy(() => import('@/src/components/admin/CaseStatusToggler')); // This is a component, path is likely correct
const ClaimReviewDetailPage = React.lazy(() => import('@/src/pages/claims/[claimId]/review'));
const ClaimDataDashboardPage = React.lazy(() => import('@/src/pages/dashboard/claims'));
const OnlineMeetingPage = React.lazy(() => import('@/src/pages/meetings'));
const MessageCenterPage = React.lazy(() => import('@/src/pages/messages'));
const AdminPage = React.lazy(() => import('@/src/pages/admin/index'));
const AdminThemePage = React.lazy(() => import('@/src/pages/admin/theme'));
const NotFoundPage = React.lazy(() => import('@/src/pages/404'));
const CaseSelectionPage = React.lazy(() => import('@/src/pages/select-case'));
const OidcCallbackPage = React.lazy(() => import('@/src/pages/oidc-callback'));
const CreateCasePage = React.lazy(() => import('@/src/pages/cases/create'));
const AdminCreateClaimAttachmentsPage = React.lazy(() => import('@/src/pages/admin/create-claim-attachments'));
const NotificationRuleManagementPage = React.lazy(() => import('@/src/pages/admin/manage/notification-rules'));
// Note: ReviewStatusManagementPage and RoleManagementPage were not previously imported in App.tsx, so no path update needed here for them.


function App() {
    const {isSuccess, isConnecting, isError, error: surrealError} = useSurreal();
    const {t} = useTranslation();
    const auth = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const processUrlCaseSelection = async () => {
            if (auth.isLoggedIn && auth.userCases && auth.userCases.length > 0) {
                const searchParams = new URLSearchParams(location.search);
                const caseIdFromUrl = searchParams.get('case');

                if (caseIdFromUrl) {
                    if (auth.selectedCaseId !== caseIdFromUrl) {
                        console.log(`Attempting to select case from URL parameter: ${caseIdFromUrl}`);
                        // Ensure the caseIdFromUrl is valid for the user before attempting to select
                        // This check is technically redundant if auth.selectCase itself validates against userCases,
                        // but can be a good safeguard or optimization.
                        const isValidCase = auth.userCases.some(c => c.id.toString() === caseIdFromUrl);
                        if (isValidCase) {
                            await auth.selectCase(caseIdFromUrl);
                        } else {
                            console.warn(`Case ID ${caseIdFromUrl} from URL is not valid for the current user or userCases not loaded yet.`);
                        }
                    }
                    // Clean the 'case' parameter from the URL, regardless of whether selection happened or was needed
                    searchParams.delete('case');
                    navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true, state: location.state });
                }
            }
        };

        processUrlCaseSelection();
    }, [auth.isLoggedIn, auth.userCases, auth.selectCase, auth.selectedCaseId, location.search, location.pathname, navigate]);

    // Handle SurrealDB connection status
    if (isConnecting) {
        return <GlobalLoader message={t('loader.connectingMessage', 'Connecting to database...')}/>;
    }

    // Use auth.isLoggedIn in the condition for rendering LoginPage
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
            <CustomThemeProvider>
                <SnackbarProvider>
                    <CaseStatusProvider>
                        <Suspense fallback={<GlobalLoader message={t('loader.pageLoading', 'Loading page...')}/>}>
                            <Routes>
                                <Route path="/login" element={auth.isLoggedIn ? <Navigate to="/dashboard" replace/> : <LoginPage/>}/>
                                <Route path="/oidc-callback" element={<OidcCallbackPage/>}/>
                            </Routes>
                        </Suspense>
                    </CaseStatusProvider>
                </SnackbarProvider>
            </CustomThemeProvider>
        );
    }

    // 首页路由单独处理，不在Layout中显示
    if (location.pathname === '/') {
        return (
            <CustomThemeProvider>
                <SnackbarProvider>
                    <CaseStatusProvider>
                        <Suspense fallback={<GlobalLoader message={t('loader.pageLoading', 'Loading page...')}/>}>
                            <Routes>
                                <Route path="/" element={<HomePage />} />
                            </Routes>
                        </Suspense>
                    </CaseStatusProvider>
                </SnackbarProvider>
            </CustomThemeProvider>
        );
    }

    return (
        <CustomThemeProvider>
            <SnackbarProvider>
                <CaseStatusProvider> {/* <-- ADDED WRAPPER */}
                    <LayoutProvider> {/* <-- ADDED LAYOUT PROVIDER */}
                        <Layout>
                        <Suspense fallback={<GlobalLoader message={t('loader.pageLoading', 'Loading page...')} />}>
                            <Routes>
                                <Route path="/select-case" element={<ProtectedRoute><CaseSelectionPage /></ProtectedRoute> as ReactNode} />
                                <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute> as ReactNode} />
                                <Route path="/documents/demo" element={<ProtectedRoute><DocumentCenterDemo /></ProtectedRoute> as ReactNode} />
                                <Route path="/cases" element={<ProtectedRoute><CaseListPage /></ProtectedRoute> as ReactNode} />
                                <Route path="/cases/create" element={<ProtectedRoute><CreateCasePage /></ProtectedRoute> as ReactNode} />
                                <Route path="/cases/:id" element={<ProtectedRoute><CaseDetailPage /></ProtectedRoute> as ReactNode} />
                                <Route path="/creditors" element={<ProtectedRoute><CreditorListPage /></ProtectedRoute> as ReactNode} />
                                <Route path="/claims" element={<ProtectedRoute><ClaimListPage /></ProtectedRoute> as ReactNode} />
                                {/* Claim Submission Module with Case Status Guard */}
                                <Route path="/claims/submit" element={<ProtectedRoute requiredCaseStatus="债权申报"><ClaimSubmissionPage /></ProtectedRoute> as ReactNode} />
                                <Route path="/claim-attachment" element={<ProtectedRoute requiredCaseStatus="债权申报"><ClaimAttachmentPage /></ProtectedRoute> as ReactNode} />
                                <Route path="/submitted-claim-detail" element={<ProtectedRoute requiredCaseStatus="债权申报"><SubmittedClaimDetailPage /></ProtectedRoute> as ReactNode} />
                                <Route path="/my-claims" element={<ProtectedRoute requiredCaseStatus="债权申报"><MyClaimsPage /></ProtectedRoute> as ReactNode} />
                                <Route path="/my-claims/:claimId/submitted" element={<ProtectedRoute requiredCaseStatus="债权申报"><SubmittedClaimDetailPage /></ProtectedRoute>} /> {/* Route for creditor viewing their submitted claim */}
                                {/* End Claim Submission Module */}
                                <Route path="/claims/:id/review" element={<ProtectedRoute><ClaimReviewDetailPage /></ProtectedRoute> as ReactNode} />
                                <Route path="/claim-dashboard" element={<ProtectedRoute><ClaimDataDashboardPage /></ProtectedRoute> as ReactNode} />
                                <Route path="/online-meetings" element={<ProtectedRoute><OnlineMeetingPage /></ProtectedRoute> as ReactNode} />
                                <Route path="/messages" element={<ProtectedRoute><MessageCenterPage /></ProtectedRoute> as ReactNode} />
                                <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminPage /></ProtectedRoute> as ReactNode} />
                                {/* Admin specific claim creation routes */}
                                <Route path="/admin/create-claim/:tempClaimId/attachments" element={<ProtectedRoute requiredRole="admin"><AdminCreateClaimAttachmentsPage /></ProtectedRoute>} />
                                {/* End Admin specific claim creation routes */}
                                <Route path="/admin/theme" element={<ProtectedRoute requiredRole="admin"><AdminThemePage /></ProtectedRoute> as ReactNode} />
                                <Route path="/admin/case-status-toggler" element={<ProtectedRoute requiredRole="admin"><CaseStatusToggler /></ProtectedRoute> as ReactNode} /> {/* <-- ADDED */}
                                <Route path="/access-denied-status" element={<AccessDeniedPage />} /> {/* <-- ADDED */}
                                <Route path="/access-denied-role" element={<AccessDeniedRolePage />} /> {/* <-- ADDED */}
                                <Route path="*" element={<NotFoundPage />} />
                            </Routes>
                        </Suspense>
                    </Layout>
                </LayoutProvider> {/* <-- ADDED LAYOUT PROVIDER */}
                </CaseStatusProvider> {/* <-- ADDED WRAPPER */}
            </SnackbarProvider>
        </CustomThemeProvider>
    );
}

export default App;
