import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  useTheme,
  useMediaQuery
} from '@mui/material';
import ClaimOperationHistory from './ClaimOperationHistory';
import ClaimVersionComparison from './ClaimVersionComparison';
import ClaimStatusFlowChart from './ClaimStatusFlowChart';
import ClaimAuditLog from './ClaimAuditLog';

interface ClaimData {
  id: string;
  claimNature: string;
  principal: string | number;
  interest: string | number;
  otherFees: string | number;
  totalAmount: string | number;
  currency: string;
  briefDescription?: string;
  attachmentsContent: string; // HTML string or plain text from RichTextEditor
  reviewStatus: string;
  submissionDate: string; // Example: '2023-10-26'
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`claim-tabpanel-${index}`}
      aria-labelledby={`claim-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `claim-tab-${index}`,
    'aria-controls': `claim-tabpanel-${index}`,
  };
}

interface ClaimDetailViewProps {
  claim: ClaimData;
}

const ClaimDetailView: React.FC<ClaimDetailViewProps> = ({ claim }) => {
  const [tabValue, setTabValue] = useState(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const commonLabelClassName = "block text-sm font-medium text-gray-500 dark:text-gray-400";
  const commonValueClassName = "mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2";
  const sectionTitleClassName = "text-lg font-semibold text-gray-800 dark:text-white mb-3";
  const gridDlClassName = "sm:grid sm:grid-cols-3 sm:gap-x-4 sm:gap-y-2 sm:px-0";

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const BasicInfoContent = () => (
    <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg p-4 sm:p-6">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
        <h1 className="text-2xl font-bold leading-tight text-gray-900 dark:text-white">
          债权申报详情 - {claim.id}
        </h1>
        <p className={`${commonLabelClassName} mt-1`}>提交日期: {claim.submissionDate}</p>
      </div>

      {/* Basic Information Section */}
      <section aria-labelledby="basic-claim-info" className="mb-6">
        <h2 id="basic-claim-info" className={sectionTitleClassName}>基本债权信息</h2>
        <dl className={`divide-y divide-gray-200 dark:divide-gray-700 ${gridDlClassName}`}>
          <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className={commonLabelClassName}>审核状态</dt>
            <dd className={`${commonValueClassName} font-semibold ${
              claim.reviewStatus === '待审核' ? 'text-yellow-600 dark:text-yellow-400' : 
              claim.reviewStatus === '审核通过' ? 'text-green-600 dark:text-green-400' :
              claim.reviewStatus === '需要补充' ? 'text-blue-600 dark:text-blue-400' :
              'text-red-600 dark:text-red-400'
            }`}>
              {claim.reviewStatus}
            </dd>
          </div>
          <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className={commonLabelClassName}>债权性质</dt>
            <dd className={commonValueClassName}>{claim.claimNature}</dd>
          </div>
          <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className={commonLabelClassName}>币种</dt>
            <dd className={commonValueClassName}>{claim.currency}</dd>
          </div>
          <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className={commonLabelClassName}>本金</dt>
            <dd className={commonValueClassName}>{formatCurrency(claim.principal)}</dd>
          </div>
          <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className={commonLabelClassName}>利息</dt>
            <dd className={commonValueClassName}>{formatCurrency(claim.interest)}</dd>
          </div>
          <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className={commonLabelClassName}>其他费用</dt>
            <dd className={commonValueClassName}>{formatCurrency(claim.otherFees)}</dd>
          </div>
          <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className={`${commonLabelClassName} font-semibold`}>债权总额</dt>
            <dd className={`${commonValueClassName} font-semibold text-blue-600 dark:text-blue-400`}>
              {formatCurrency(claim.totalAmount)} ({claim.currency})
            </dd>
          </div>
          {claim.briefDescription && (
            <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className={commonLabelClassName}>简要说明</dt>
              <dd className={`${commonValueClassName} whitespace-pre-wrap`}>{claim.briefDescription}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Attachments and Detailed Description Section */}
      <section aria-labelledby="attachments-info">
        <h2 id="attachments-info" className={sectionTitleClassName}>详细说明及附件</h2>
        <div className="mt-1 prose prose-sm sm:prose dark:prose-invert max-w-none p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700/30">
          <div dangerouslySetInnerHTML={{ __html: claim.attachmentsContent }} />
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          以上为申报人提供的详细说明和上传的附件列表（如有）。附件通常显示为链接或嵌入内容。
        </p>
      </section>
    </div>
  );
  
  return (
    <Box sx={{ width: '100%' }}>
      <Paper elevation={0} sx={{ mb: 2 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="债权详情标签页"
          variant={isMobile ? "scrollable" : "fullWidth"}
          scrollButtons={isMobile ? "auto" : false}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontSize: '0.875rem',
              fontWeight: 500
            }
          }}
        >
          <Tab label="债权信息" {...a11yProps(0)} />
          <Tab label="操作历史" {...a11yProps(1)} />
          <Tab label="状态流转" {...a11yProps(2)} />
          <Tab label="版本历史" {...a11yProps(3)} />
          <Tab label="访问日志" {...a11yProps(4)} />
        </Tabs>
      </Paper>

      <TabPanel value={tabValue} index={0}>
        <BasicInfoContent />
      </TabPanel>
      
      <TabPanel value={tabValue} index={1}>
        <Paper elevation={1} sx={{ p: 0, minHeight: 400 }}>
          <ClaimOperationHistory 
            claimId={claim.id}
            showFilters={true}
            maxHeight={600}
          />
        </Paper>
      </TabPanel>
      
      <TabPanel value={tabValue} index={2}>
        <Paper elevation={1} sx={{ p: 2, minHeight: 400 }}>
          <ClaimStatusFlowChart 
            claimId={claim.id}
            interactive={true}
            showTimeline={true}
          />
        </Paper>
      </TabPanel>
      
      <TabPanel value={tabValue} index={3}>
        <Paper elevation={1} sx={{ p: 2, minHeight: 400 }}>
          <ClaimVersionComparison 
            claimId={claim.id}
            onClose={() => {}}
          />
        </Paper>
      </TabPanel>
      
      <TabPanel value={tabValue} index={4}>
        <Paper elevation={1} sx={{ p: 0, minHeight: 400 }}>
          <ClaimAuditLog 
            claimId={claim.id}
          />
        </Paper>
      </TabPanel>
    </Box>
  );
};

export default ClaimDetailView;
