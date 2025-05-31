// TODO: Access Control - This page should only be accessible to users with a 'creditor' role.
// TODO: Access Control - Module access (new submission) should typically be conditional on Case Status being '债权申报'. This check might be done in higher-level routing.
// TODO: Access Control - If loaded with a claimId (for editing): Verify this claimId belongs to the logged-in creditor and is in an editable status ('草稿', '已驳回', '需要补充').
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from '@/src/contexts/SnackbarContext';
import PageContainer from '@/src/components/PageContainer';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Alert,
  FormHelperText,
  InputAdornment,
} from '@mui/material';
// TODO: import { useAuth } from '@/src/contexts/AuthContext'; // To get logged-in creditor info

const ClaimSubmissionPage: React.FC = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useSnackbar();
  // const { user } = useAuth(); // TODO: Use this to get creditor details

  // Form state
  const [claimNature, setClaimNature] = useState('普通债权');
  const [principal, setPrincipal] = useState('');
  const [interest, setInterest] = useState('');
  const [otherFees, setOtherFees] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);
  const [currency, setCurrency] = useState('CNY');
  const [briefDescription, setBriefDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calculate total amount
  useEffect(() => {
    const p = parseFloat(principal) || 0;
    const i = parseFloat(interest) || 0;
    const o = parseFloat(otherFees) || 0;
    setTotalAmount(p + i + o);
  }, [principal, interest, otherFees]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    // Claim Info Validation
    if (!claimNature) newErrors.claimNature = '债权性质不能为空';
    if (!principal) {
      newErrors.principal = '本金不能为空';
    } else if (parseFloat(principal) <= 0) {
      newErrors.principal = '本金必须为正数';
    }
    if (!currency) newErrors.currency = '币种不能为空';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateForm()) {
      showError('请修正表单中的错误。');
      return;
    }
    
    const mockClaimId = `CLAIM-${Date.now()}`;
    // TODO: submit data to API
    console.log({
      claimId: mockClaimId, // Added mock claim ID
      claimNature, 
      principal, 
      interest, 
      otherFees, 
      totalAmount, 
      currency, 
      briefDescription
      // TODO: Add logged-in creditor's ID from AuthContext when submitting
      // creditorId: user?.id 
    });
    showSuccess('债权基本信息已保存。');
    navigate(`/claim-attachment/${mockClaimId}`); 
  };

  return (
    <PageContainer>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          填写债权基本信息
        </Typography>
        
        {/* TODO: Display logged-in creditor's information here from AuthContext */}
        {/* <Paper sx={{ mb: 3, p: 2 }}>
          <Typography variant="h6" gutterBottom>申报人信息 (自动带入)</Typography>
          <Typography>名称: [Logged In Creditor Name]</Typography>
          <Typography>ID: [Logged In Creditor ID]</Typography>
        </Paper> */}

        <Paper sx={{ p: 3, mt: 2 }}>
          <form onSubmit={handleSubmit}>
            <Typography variant="h6" gutterBottom>
              债权基本信息
            </Typography>
            
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              <Box sx={{ flex: '1 1 100%', '@media (min-width: 900px)': { flex: '1 1 45%' } }}>
                <FormControl fullWidth required error={!!errors.claimNature}>
                  <InputLabel id="claimNature-label">债权性质</InputLabel>
                  <Select
                    labelId="claimNature-label"
                    id="claimNature-select" // Ensure Select has an id if InputLabel uses htmlFor
                    value={claimNature}
                    onChange={(e) => {
                      setClaimNature(e.target.value);
                      setErrors(prev => ({ ...prev, claimNature: '' }));
                    }}
                    label="债权性质"
                  >
                    <MenuItem value="普通债权">普通债权</MenuItem>
                    <MenuItem value="有财产担保债权">有财产担保债权</MenuItem>
                    <MenuItem value="劳动报酬">劳动报酬</MenuItem>
                  </Select>
                  {errors.claimNature && <FormHelperText>{errors.claimNature}</FormHelperText>}
                </FormControl>
              </Box>
              
              <Box sx={{ flex: '1 1 100%', '@media (min-width: 900px)': { flex: '1 1 45%' } }}>
                <FormControl fullWidth required error={!!errors.currency}>
                  <InputLabel id="currency-label">币种</InputLabel>
                  <Select
                    labelId="currency-label"
                    id="currency-select" // Ensure Select has an id if InputLabel uses htmlFor
                    value={currency}
                    onChange={(e) => {
                      setCurrency(e.target.value);
                      setErrors(prev => ({ ...prev, currency: '' }));
                    }}
                    label="币种"
                  >
                    <MenuItem value="CNY">CNY</MenuItem>
                    <MenuItem value="USD">USD</MenuItem>
                  </Select>
                  {errors.currency && <FormHelperText>{errors.currency}</FormHelperText>}
                </FormControl>
              </Box>
              
              <Box sx={{ flex: '1 1 100%', '@media (min-width: 900px)': { flex: '1 1 45%' } }}>
                <TextField
                  fullWidth
                  required
                  label="本金"
                  type="number"
                  value={principal}
                  onChange={(e) => {
                    setPrincipal(e.target.value);
                    setErrors(prev => ({ ...prev, principal: '' }));
                  }}
                  error={!!errors.principal}
                  helperText={errors.principal}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                  }}
                  placeholder="0.00"
                />
              </Box>
              
              <Box sx={{ flex: '1 1 100%', '@media (min-width: 900px)': { flex: '1 1 45%' } }}>
                <TextField
                  fullWidth
                  label="利息"
                  type="number"
                  value={interest}
                  onChange={(e) => setInterest(e.target.value)}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                  }}
                  placeholder="0.00"
                />
              </Box>
              
              <Box sx={{ flex: '1 1 100%', '@media (min-width: 900px)': { flex: '1 1 45%' } }}>
                <TextField
                  fullWidth
                  label="其他费用"
                  type="number"
                  value={otherFees}
                  onChange={(e) => setOtherFees(e.target.value)}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                  }}
                  placeholder="如违约金、赔偿金等"
                />
              </Box>
              
              <Box sx={{ flex: '1 1 100%', '@media (min-width: 900px)': { flex: '1 1 45%' } }}>
                <TextField
                  fullWidth
                  label="债权总额"
                  value={totalAmount.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                  InputProps={{
                    readOnly: true,
                    startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                  }}
                  disabled
                />
              </Box>
              
              <Box sx={{ flex: '1 1 100%' }}>
                <TextField
                  fullWidth
                  label="简要说明"
                  multiline
                  rows={4}
                  value={briefDescription}
                  onChange={(e) => setBriefDescription(e.target.value)}
                  placeholder="（选填）可简要说明债权的形成、担保、诉讼仲裁等情况..."
                />
              </Box>
            </Box>

            {Object.keys(errors).length > 0 && (
              <Alert severity="error" sx={{ mt: 2 }}>
                请修正表单中的错误后重试。
              </Alert>
            )}

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={() => navigate(-1)}
              >
                取消
              </Button>
              <Button
                type="submit"
                variant="contained"
                color="primary"
              >
                保存并下一步（编辑附件）
              </Button>
            </Box>
          </form>
        </Paper>
        
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          请确保所有必填项都已正确填写。保存后，将进入附件材料编辑页面。
        </Typography>
      </Box>
    </PageContainer>
  );
};

export default ClaimSubmissionPage;
