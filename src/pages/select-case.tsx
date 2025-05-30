import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/src/contexts/AuthContext';
import { Case } from '@/src/contexts/AuthContext'; // Import Case interface
import { useTranslation } from 'react-i18next'; // <-- IMPORT I18N
import GlobalLoader from '@/src/components/GlobalLoader'; // ADDED
import PageContainer from '@/src/components/PageContainer';
import { 
  Box, 
  Paper, 
  Typography, 
  Button, 
  Alert,
  Stack,
  SvgIcon
} from '@mui/material';
import { mdiCheckCircle } from '@mdi/js';

const CaseSelectionPage: React.FC = () => {
  const { t } = useTranslation(); // <-- INITIALIZE T
  const { 
    user, 
    userCases, 
    selectCase, 
    selectedCaseId, 
    isLoading: isAuthLoading, 
    isCaseLoading,
    isLoggedIn 
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleCaseSelect = async (caseToSelect: Case) => {
    if (!caseToSelect || !caseToSelect.id) return;
    try {
      await selectCase(caseToSelect.id.toString()); // Ensure ID is passed as string
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (error) {
      console.error("Error selecting case:", error);
      // Optionally display an error message to the user on this page
    }
  };

  if (isAuthLoading || isCaseLoading) {
    return <GlobalLoader message={t('loading_info')} />;
  }

  if (!isLoggedIn || !user) {
    // Should be handled by ProtectedRoute, but as a fallback:
    navigate('/login', { replace: true });
    return null; // Or a message prompting login
  }
  
  return (
    <PageContainer>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100%',
          p: 2,
          flex: 1,
        }}
      >
        <Paper 
          elevation={6} 
          sx={{ 
            p: { xs: 4, sm: 6, md: 8 }, 
            width: '100%', 
            maxWidth: 600,
            textAlign: 'center'
          }}
        >
          <Typography variant="h3" component="h1" color="primary" gutterBottom>
            {t('case_selection_title')}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            {t('case_selection_welcome', { name: user.name })}
          </Typography>

          {userCases.length === 0 ? (
            <Alert severity="warning" sx={{ textAlign: 'left' }}>
              <Typography variant="body1" fontWeight="medium">
                {t('case_selection_no_cases')}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                {t('case_selection_no_cases_contact_support')}
              </Typography>
            </Alert>
          ) : (
            <Stack spacing={2}>
              {userCases.map((caseItem) => (
                <Button
                  key={caseItem.id.toString()}
                  onClick={() => handleCaseSelect(caseItem)}
                  disabled={isCaseLoading}
                  variant={selectedCaseId === caseItem.id.toString() ? "contained" : "outlined"}
                  color="primary"
                  size="large"
                  fullWidth
                  sx={{
                    p: 2.5,
                    justifyContent: 'space-between',
                    textAlign: 'left',
                    textTransform: 'none',
                    position: 'relative',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: 4,
                    },
                    transition: 'all 0.3s ease',
                  }}
                  endIcon={
                    selectedCaseId === caseItem.id.toString() && (
                      <SvgIcon>
                        <path d={mdiCheckCircle} />
                      </SvgIcon>
                    )
                  }
                >
                  <Box>
                    <Typography variant="h6" component="div">
                      {caseItem.name}
                    </Typography>
                    {caseItem.case_number && (
                      <Typography 
                        variant="body2" 
                        color={selectedCaseId === caseItem.id.toString() ? "inherit" : "text.secondary"}
                      >
                        {t('case_selection_case_number_label', { caseNumber: caseItem.case_number })}
                      </Typography>
                    )}
                  </Box>
                </Button>
              ))}
            </Stack>
          )}
        </Paper>
        
        <Typography 
          variant="caption" 
          color="text.secondary" 
          sx={{ mt: 4, textAlign: 'center' }}
        >
          {t('copyright_platform', { year: new Date().getFullYear() })}
        </Typography>
      </Box>
    </PageContainer>
  );
};

export default CaseSelectionPage;
