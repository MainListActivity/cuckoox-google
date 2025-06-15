import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Breadcrumbs,
  Link,
  Button,
  IconButton,
  Paper,
  Grid,
  Chip,
} from '@mui/material';
import { NavigateNext, Save, Share, Print, MoreVert } from '@mui/icons-material';
import RichTextEditor from '@/src/components/RichTextEditor';
import { mdiInformation, mdiFileDocumentOutline, mdiAccount, mdiCalendar, mdiGavel, mdiFileDocument } from '@mdi/js';

// 定义扩展区域内容的类型
interface ExtensionAreaContent {
  type: 'case' | 'claim' | 'law' | 'related_docs';
  data: any;
  renderContent?: () => React.ReactNode;
}

// 使用any类型来避免类型错误
const initialContent: any = {
  ops: [
    { insert: '阿迪沙发上覆盖', attributes: { align: 'center', bold: true, 'header': 1 } },
    { insert: '\n' },
    { insert: '给电视看过发考试大纲看过哦中修改v收到', attributes: { align: 'center' } },
    { insert: '\n\n' },
    { insert: '二级标题', attributes: { 'header': 2 } },
    { insert: '\n' },
    { insert: '这是一些正文内容。', attributes: {} },
    { insert: '\n' }
  ]
};

const mockComments = [
  {
    id: '1',
    author: '杨远鑫',
    content: '颠倒是非v多少',
    time: '06-06 14:41',
  }
];

const mockCaseInfo = {
  caseNumber: '(2024)粤03破001号',
  caseName: '广州市某某科技有限公司破产清算案',
  stage: '破产清算',
  court: '广州市中级人民法院',
  administrator: '李明律师',
  acceptanceDate: '2024-01-15',
};

const mockClaimInfo = {
  creditorName: '广州市某某供应商有限公司',
  claimNumber: 'ZQ2024001',
  claimType: '普通债权',
  amount: '1,200,000.00',
  status: '已审核',
  approvedAmount: '1,000,000.00',
};

const mockLawInfo = [
  {
    title: '《中华人民共和国企业破产法》第二条',
    content: '企业法人不能清偿到期债务，并且资产不足以清偿全部债务或者明显缺乏清偿能力的，依照本法规定清理债务。',
    source: '《中华人民共和国企业破产法》'
  },
  {
    title: '《中华人民共和国企业破产法》第十一条',
    content: '人民法院受理破产申请后，债务人对个别债权人的债务清偿无效。',
    source: '《中华人民共和国企业破产法》'
  }
];

const mockRelatedDocs = [
  { id: 'doc1', title: '债权申报表', type: '表格', createTime: '2024-01-20' },
  { id: 'doc2', title: '债权审核报告', type: '文档', createTime: '2024-02-05' },
  { id: 'doc3', title: '第一次债权人会议通知', type: '通知', createTime: '2024-02-15' },
];

export default function DocumentCenterDemo() {
  const [currentExtensionTab, setCurrentExtensionTab] = useState('case');
  const [extensionAreaContent, setExtensionAreaContent] = useState<ExtensionAreaContent>({
    type: 'case',
    data: mockCaseInfo
  });
  const [showExtensionArea, setShowExtensionArea] = useState(false);

  // 处理扩展区域标签页切换
  const handleExtensionTabChange = useCallback((tabId: string) => {
    setCurrentExtensionTab(tabId);
    
    // 根据所选标签页更新内容
    switch (tabId) {
      case 'case':
        setExtensionAreaContent({ type: 'case', data: mockCaseInfo });
        break;
      case 'claim':
        setExtensionAreaContent({ type: 'claim', data: mockClaimInfo });
        break;
      case 'law':
        setExtensionAreaContent({ type: 'law', data: mockLawInfo });
        break;
      case 'related_docs':
        setExtensionAreaContent({ type: 'related_docs', data: mockRelatedDocs });
        break;
      default:
        setExtensionAreaContent({ type: 'case', data: mockCaseInfo });
    }
  }, []);

  // 扩展区域标签页定义
  const extensionAreaTabs = [
    { id: 'case', label: '案件信息', icon: mdiInformation },
    { id: 'claim', label: '债权信息', icon: mdiFileDocumentOutline },
    { id: 'law', label: '法律条文', icon: mdiGavel },
    { id: 'related_docs', label: '相关文档', icon: mdiFileDocument },
  ];

  // 自定义渲染案件信息的内容
  const renderCaseInfo = useCallback(() => {
    const data = mockCaseInfo;
    return (
      <Box sx={{ p: 2, boxSizing: 'border-box' }}>
        <Grid container spacing={3}>
          <Grid size={4}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>案件编号</Typography>
              <Typography variant="body2" color="text.secondary">{data.caseNumber || '暂无数据'}</Typography>
            </Paper>
          </Grid>
          <Grid size={4}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>案件名称</Typography>
              <Typography variant="body2" color="text.secondary">{data.caseName || '暂无数据'}</Typography>
            </Paper>
          </Grid>
          <Grid size={4}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>案件阶段</Typography>
              <Typography variant="body2" color="text.secondary">{data.stage || '暂无数据'}</Typography>
            </Paper>
          </Grid>
          <Grid size={4}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>审理法院</Typography>
              <Typography variant="body2" color="text.secondary">{data.court || '暂无数据'}</Typography>
            </Paper>
          </Grid>
          <Grid size={4}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>管理人</Typography>
              <Typography variant="body2" color="text.secondary">{data.administrator || '暂无数据'}</Typography>
            </Paper>
          </Grid>
          <Grid size={4}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>受理日期</Typography>
              <Typography variant="body2" color="text.secondary">{data.acceptanceDate || '暂无数据'}</Typography>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    );
  }, []);

  // 自定义渲染债权信息的内容
  const renderClaimInfo = useCallback(() => {
    const data = mockClaimInfo;
    return (
      <Box sx={{ p: 2, boxSizing: 'border-box' }}>
        <Grid container spacing={3}>
          <Grid size={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>债权人名称</Typography>
              <Typography variant="body2" color="text.secondary">{data.creditorName || '暂无数据'}</Typography>
            </Paper>
          </Grid>
          <Grid size={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>债权编号</Typography>
              <Typography variant="body2" color="text.secondary">{data.claimNumber || '暂无数据'}</Typography>
            </Paper>
          </Grid>
          <Grid size={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>债权类型</Typography>
              <Typography variant="body2" color="text.secondary">{data.claimType || '暂无数据'}</Typography>
            </Paper>
          </Grid>
          <Grid size={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>申报金额</Typography>
              <Typography variant="body2" color="text.secondary">¥{data.amount || '0.00'}</Typography>
            </Paper>
          </Grid>
          <Grid size={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>审核状态</Typography>
              <Typography variant="body2" color="text.secondary">
                <Chip 
                  label={data.status} 
                  size="small" 
                  color={data.status === '已审核' ? 'success' : 'default'}
                  sx={{ fontSize: '0.75rem' }}
                />
              </Typography>
            </Paper>
          </Grid>
          <Grid size={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>确认金额</Typography>
              <Typography variant="body2" color="text.secondary">¥{data.approvedAmount || '0.00'}</Typography>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    );
  }, []);

  // 自定义渲染法律条文的内容
  const renderLawInfo = useCallback(() => {
    const data = mockLawInfo;
    return (
      <Box sx={{ p: 2, boxSizing: 'border-box' }}>
        {data.map((law, index) => (
          <Paper key={index} variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>{law.title}</Typography>
            <Typography variant="body2" paragraph>{law.content}</Typography>
            <Typography variant="caption" color="text.secondary">来源: {law.source}</Typography>
          </Paper>
        ))}
      </Box>
    );
  }, []);

  // 自定义渲染相关文档的内容
  const renderRelatedDocs = useCallback(() => {
    const data = mockRelatedDocs;
    return (
      <Box sx={{ p: 2, boxSizing: 'border-box' }}>
        <Grid container spacing={2}>
          {data.map((doc) => (
            <Grid key={doc.id} size={6}>
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 2, 
                  cursor: 'pointer',
                  '&:hover': { 
                    bgcolor: 'action.hover',
                    borderColor: 'primary.main'
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <IconButton size="small" color="primary" sx={{ mr: 1 }}>
                    <Print fontSize="small" />
                  </IconButton>
                  <Typography variant="subtitle2" noWrap>{doc.title}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Chip label={doc.type} size="small" />
                  <Typography variant="caption" color="text.secondary">{doc.createTime}</Typography>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }, []);

  // 根据当前选中的标签页渲染相应的内容
  const getExtensionContent = useCallback(() => {
    switch (currentExtensionTab) {
      case 'case':
        return renderCaseInfo();
      case 'claim':
        return renderClaimInfo();
      case 'law':
        return renderLawInfo();
      case 'related_docs':
        return renderRelatedDocs();
      default:
        return null;
    }
  }, [currentExtensionTab, renderCaseInfo, renderClaimInfo, renderLawInfo, renderRelatedDocs]);
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      {/* 文档编辑器主体 */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <RichTextEditor 
          defaultValue={initialContent}
          comments={mockComments}
          contextInfo={{
            title: '立案审查报告',
            subtitle: '破-2024-001 / 广州市某某科技有限公司',
            details: [
              { label: '案件编号', value: '(2024)粤03破001号', icon: mdiFileDocumentOutline },
              { label: '管理人', value: '李明律师', icon: mdiAccount },
              { label: '受理日期', value: '2024-01-15', icon: mdiCalendar },
            ],
            avatar: {
              text: '案',
              color: '#26A69A' // Teal 300
            }
          }}
          breadcrumbs={
            <Breadcrumbs separator={<NavigateNext fontSize="small" />} aria-label="breadcrumb">
              <Link color="inherit" href="#" underline="hover">案件</Link>
              <Link color="inherit" href="#" underline="hover">破-2024-001</Link>
              <Typography color="text.primary">立案材料</Typography>
            </Breadcrumbs>
          }
          // 使用内置保存功能，移除原来的保存按钮
          onSave={async (content) => {
            console.log('保存文档内容:', content);
            // 模拟保存到服务器
            return new Promise((resolve) => {
              setTimeout(() => {
                console.log('文档保存完成');
                resolve();
              }, 1000);
            });
          }}
          enableAutoSave={true}
          autoSaveInterval={10000} // 10秒自动保存
          showSaveButton={true}
          saveButtonText="保存文档"
          actions={
            <>
              <Button startIcon={<Share />} variant="outlined" size="small">分享</Button>
              <IconButton 
                size="small" 
                onClick={() => setShowExtensionArea(!showExtensionArea)}
              >
                <Print />
              </IconButton>
              <IconButton size="small"><MoreVert /></IconButton>
            </>
          }
          extensionAreaTabs={extensionAreaTabs}
          extensionAreaContent={{
            type: extensionAreaContent.type,
            data: extensionAreaContent.data,
            renderContent: getExtensionContent
          }}
          onExtensionAreaTabChange={handleExtensionTabChange}
          showExtensionArea={showExtensionArea}
        />
      </Box>
    </Box>
  );
}
