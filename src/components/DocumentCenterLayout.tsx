import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  List,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Chip,
  Avatar,
  TextField,
  Button,
  Stack,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Description,
  Folder,
  Schedule,
  Person,
  Gavel,
  Comment,
  Send,
  Close,
} from '@mui/icons-material';

interface DocumentCenterLayoutProps {
  children: React.ReactNode;
  documentTitle?: string;
  caseInfo?: {
    caseNumber: string;
    responsiblePerson: string;
    stage: string;
    acceptanceDate: string;
  };
  comments?: Array<{
    id: string;
    author: string;
    content: string;
    time: string;
    avatar?: string;
  }>;
  onAddComment?: (content: string) => void;
}

export default function DocumentCenterLayout({
  children,
  documentTitle = "未命名文档",
  caseInfo,
  comments = [],
  onAddComment,
}: DocumentCenterLayoutProps) {
  const [isMenuCollapsed, setIsMenuCollapsed] = useState(false);
  const [showComments, setShowComments] = useState(comments.length > 0);
  const [newComment, setNewComment] = useState('');

  // 模拟文档树数据
  const documentTree = [
    { id: '1', name: '案件资料', type: 'folder' as const, children: [
      { id: '1-1', name: '立案申请书', type: 'doc' as const },
      { id: '1-2', name: '债权人名册', type: 'doc' as const },
    ]},
    { id: '2', name: '债权审核', type: 'folder' as const, children: [
      { id: '2-1', name: '债权申报表', type: 'doc' as const },
      { id: '2-2', name: '审核结果', type: 'doc' as const },
    ]},
    { id: '3', name: '会议纪要', type: 'folder' as const, children: [
      { id: '3-1', name: '第一次债权人会议', type: 'doc' as const },
    ]},
  ];

  const handleAddComment = () => {
    if (newComment.trim() && onAddComment) {
      onAddComment(newComment.trim());
      setNewComment('');
    }
  };

  const renderDocumentTree = (items: Array<{
    id: string;
    name: string;
    type: 'folder' | 'doc';
    children?: Array<{ id: string; name: string; type: 'folder' | 'doc' }>;
  }>, level = 0) => (
    <List dense sx={{ pl: level * 2 }}>
      {items.map((item) => (
        <React.Fragment key={item.id}>
          <ListItemButton sx={{ 
            borderRadius: 1, 
            mx: 1,
            my: 0.5,
            minHeight: 32,
            '&:hover': { bgcolor: 'action.hover' }
          }}>
                         <ListItemIcon sx={{ minWidth: 32 }}>
               {item.type === 'folder' ? <Folder fontSize="small" /> : <Description fontSize="small" />}
             </ListItemIcon>
            {!isMenuCollapsed && (
              <ListItemText 
                primary={item.name} 
                primaryTypographyProps={{ 
                  fontSize: '0.75rem',
                  fontWeight: item.type === 'folder' ? 500 : 400
                }}
              />
            )}
          </ListItemButton>
          {!isMenuCollapsed && item.children && renderDocumentTree(item.children, level + 1)}
        </React.Fragment>
      ))}
    </List>
  );

  return (
    <Box sx={{ 
      display: 'flex', 
      height: 'calc(100vh - 64px)',
      bgcolor: 'background.default',
      overflow: 'hidden'
    }}>
      {/* 左侧一：可收起的文档菜单 */}
      <Paper 
        elevation={0} 
        sx={{ 
          width: isMenuCollapsed ? 56 : 200,
          flexShrink: 0,
          borderRight: 1,
          borderColor: 'divider',
          borderRadius: 0,
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.2s ease',
          zIndex: 1200,
        }}
      >
        {/* 菜单头部 */}
        <Box sx={{ 
          p: 1, 
          display: 'flex', 
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 48,
          borderBottom: 1,
          borderColor: 'divider'
        }}>
          {!isMenuCollapsed && (
            <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.75rem' }}>
              文档资料
            </Typography>
          )}
          <IconButton 
            size="small" 
            onClick={() => setIsMenuCollapsed(!isMenuCollapsed)}
            sx={{ ml: isMenuCollapsed ? 0 : 'auto' }}
          >
            {isMenuCollapsed ? <ChevronRight /> : <ChevronLeft />}
          </IconButton>
        </Box>

        {/* 文档树 */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {renderDocumentTree(documentTree)}
        </Box>
      </Paper>

      {/* 左侧二：标题和案件详情 */}
      <Paper 
        elevation={0} 
        sx={{ 
          width: 280,
          flexShrink: 0,
          borderRight: 1,
          borderColor: 'divider',
          borderRadius: 0,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1200,
        }}
      >
        {/* 文档标题区 */}
        <Box sx={{ 
          p: 2, 
          borderBottom: 1, 
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}>
          <Typography variant="h6" sx={{ 
            fontSize: '1rem',
            fontWeight: 600,
            lineHeight: 1.3,
            mb: 1
          }}>
            {documentTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
            最后编辑：{new Date().toLocaleString()}
          </Typography>
        </Box>

        {/* 案件详情区 */}
        {caseInfo && (
          <Box sx={{ p: 2, flex: 1 }}>
            <Typography variant="overline" sx={{ 
              fontSize: '0.7rem',
              fontWeight: 600,
              color: 'primary.main',
              letterSpacing: 0.5
            }}>
              案件信息
            </Typography>
            
            <Stack spacing={2} sx={{ mt: 1.5 }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                  <Gavel sx={{ fontSize: 14, mr: 1, color: 'text.secondary' }} />
                  <Typography variant="body2" sx={{ fontSize: '0.7rem', fontWeight: 500 }}>
                    案件编号
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ fontSize: '0.75rem', pl: 3 }}>
                  {caseInfo.caseNumber}
                </Typography>
              </Box>

              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                  <Person sx={{ fontSize: 14, mr: 1, color: 'text.secondary' }} />
                  <Typography variant="body2" sx={{ fontSize: '0.7rem', fontWeight: 500 }}>
                    负责人
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ fontSize: '0.75rem', pl: 3 }}>
                  {caseInfo.responsiblePerson}
                </Typography>
              </Box>

              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                  <Schedule sx={{ fontSize: 14, mr: 1, color: 'text.secondary' }} />
                  <Typography variant="body2" sx={{ fontSize: '0.7rem', fontWeight: 500 }}>
                    受理日期
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ fontSize: '0.75rem', pl: 3 }}>
                  {caseInfo.acceptanceDate}
                </Typography>
              </Box>

              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontSize: '0.7rem', fontWeight: 500 }}>
                    当前阶段
                  </Typography>
                </Box>
                <Chip 
                  label={caseInfo.stage} 
                  size="small" 
                  color="primary" 
                  variant="outlined"
                  sx={{ fontSize: '0.7rem', height: 24 }}
                />
              </Box>
            </Stack>
          </Box>
        )}
      </Paper>

      {/* 中间：富文本编辑器区域 */}
      <Box sx={{ 
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        bgcolor: 'background.paper'
      }}>
        {children}
      </Box>

      {/* 右侧：评论面板 */}
      {showComments && (
        <Paper 
          elevation={0} 
          sx={{ 
            width: 300,
            flexShrink: 0,
            borderLeft: 1,
            borderColor: 'divider',
            borderRadius: 0,
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1200,
          }}
        >
          {/* 评论头部 */}
          <Box sx={{ 
            p: 2, 
            borderBottom: 1, 
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Comment sx={{ fontSize: 16, mr: 1, color: 'primary.main' }} />
              <Typography variant="overline" sx={{ 
                fontSize: '0.7rem',
                fontWeight: 600,
                color: 'primary.main'
              }}>
                评论 ({comments.length})
              </Typography>
            </Box>
                         <IconButton 
               size="small" 
               onClick={() => setShowComments(false)}
               aria-label="close"
             >
               <Close />
             </IconButton>
          </Box>

          {/* 评论列表 */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
            {comments.map((comment) => (
              <Box key={comment.id} sx={{ mb: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Avatar sx={{ width: 24, height: 24, mr: 1, fontSize: '0.7rem' }}>
                    {comment.author[0]}
                  </Avatar>
                  <Typography variant="body2" sx={{ fontSize: '0.7rem', fontWeight: 500 }}>
                    {comment.author}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.65rem', ml: 'auto', color: 'text.secondary' }}>
                    {comment.time}
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ fontSize: '0.75rem', lineHeight: 1.4 }}>
                  {comment.content}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* 添加评论 */}
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
            <TextField
              fullWidth
              multiline
              rows={3}
              placeholder="添加评论..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              size="small"
              sx={{ mb: 1 }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                size="small"
                variant="contained"
                startIcon={<Send />}
                onClick={handleAddComment}
                disabled={!newComment.trim()}
                sx={{ fontSize: '0.7rem' }}
              >
                发送
              </Button>
            </Box>
          </Box>
        </Paper>
      )}

      {/* 评论切换按钮（当评论面板隐藏时） */}
      {!showComments && comments.length > 0 && (
        <Box sx={{ 
          position: 'fixed',
          right: 16,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 1300
        }}>
          <IconButton
            color="primary"
            onClick={() => setShowComments(true)}
            sx={{ 
              bgcolor: 'background.paper',
              boxShadow: 2,
              '&:hover': { bgcolor: 'background.paper' }
            }}
          >
            <Comment />
          </IconButton>
        </Box>
      )}
    </Box>
  );
} 