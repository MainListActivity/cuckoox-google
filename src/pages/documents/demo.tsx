import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
} from '@mui/material';
import DocumentCenterLayout from '@/src/components/DocumentCenterLayout';
import RichTextEditor from '@/src/components/RichTextEditor';

// 模拟数据
const mockCaseInfo = {
  caseNumber: '(2024)粤03破001号',
  responsiblePerson: '李明律师',
  stage: '债权申报',
  acceptanceDate: '2024-01-15'
};

const mockComments = [
  {
    id: '1',
    author: '张律师',
    content: '建议在第三段增加债权人权利的详细说明，以确保债权人充分了解自己的权益。',
    time: '2024-01-20 14:30'
  },
  {
    id: '2',
    author: '王助理',
    content: '附件中的债权申报表格式需要按照最新的法院要求进行调整。',
    time: '2024-01-20 15:15'
  },
  {
    id: '3',
    author: '法官助理',
    content: '请确认债权申报期限的计算方式是否符合破产法相关规定。',
    time: '2024-01-20 16:45'
  }
];

export default function DocumentCenterDemo() {
  const [comments, setComments] = useState(mockComments);
  const [editorContent, setEditorContent] = useState(`
    <h1>债权申报须知</h1>
    
    <h2>一、申报时间</h2>
    <p>债权人应当在人民法院确定的债权申报期限内向管理人申报债权。债权申报期限自人民法院发布受理破产申请公告之日起计算，最短不得少于三十日，最长不得超过三个月。</p>
    
    <h2>二、申报材料</h2>
    <p>债权人申报债权时，应当书面说明债权的数额和有无财产担保，并提交有关证据。申报的债权是连带债权的，应当说明。</p>
    
    <ul>
      <li>债权申报书</li>
      <li>债权人身份证明文件</li>
      <li>债权产生的事实依据</li>
      <li>担保权益证明（如有）</li>
    </ul>
    
    <h2>三、注意事项</h2>
    <p><strong>重要提醒：</strong>未在法定期限内申报债权的，视为放弃债权。债权人对管理人编制的债权表记载的本人债权无异议的，由人民法院裁定确认。</p>
    
    <blockquote>
      <p>管理人收到债权申报材料后，应当登记造册，对申报的债权进行审查，并编制债权表。</p>
    </blockquote>
  `);

  const handleAddComment = (content: string) => {
    const newComment = {
      id: String(comments.length + 1),
      author: '当前用户',
      content,
      time: new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    };
    setComments([...comments, newComment]);
  };

  return (
    <DocumentCenterLayout
      documentTitle="债权申报须知文档"
      caseInfo={mockCaseInfo}
      comments={comments}
      onAddComment={handleAddComment}
    >
      {/* 文档编辑区域 */}
      <Box sx={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper'
      }}>
        {/* 文档工具栏 */}
        <Paper 
          elevation={0} 
          sx={{ 
            p: 1.5,
            borderBottom: 1,
            borderColor: 'divider',
            borderRadius: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}
        >
          <Button size="small" variant="outlined">
            保存
          </Button>
          <Button size="small" variant="outlined">
            导出PDF
          </Button>
          <Button size="small" variant="outlined">
            打印
          </Button>
          <Box sx={{ ml: 'auto' }}>
            <Typography variant="caption" color="text.secondary">
              已自动保存
            </Typography>
          </Box>
        </Paper>

        {/* 提醒信息 */}
        <Alert 
          severity="info" 
          sx={{ 
            m: 2, 
            borderRadius: 1,
            fontSize: '0.75rem'
          }}
        >
          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
            这是一个文档中心布局演示。左侧显示文档树和案件信息，中间是富文本编辑器，右侧是评论面板。
          </Typography>
        </Alert>

        {/* 富文本编辑器 */}
        <Box sx={{ 
          flex: 1, 
          p: 2,
          overflow: 'auto'
        }}>
                     <RichTextEditor
             value={editorContent}
             onChange={(delta) => {
               // 这里需要将Delta转换为HTML字符串
               // 简化处理，实际项目中需要proper的Delta到HTML转换
               setEditorContent(typeof delta === 'string' ? delta : JSON.stringify(delta));
             }}
             placeholder="开始编辑文档内容..."
           />
        </Box>
      </Box>
    </DocumentCenterLayout>
  );
} 