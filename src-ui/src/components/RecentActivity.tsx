import React from 'react';
import {
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
  Typography,
  Box,
} from '@mui/material';
import { Assignment, CheckCircle, Pending } from '@mui/icons-material';
import { formatAmount } from '../utils/formatters';

interface ActivityProps {
  activity: {
    id: number;
    type: string;
    creditor: string;
    amount: number;
    time: string;
  };
}

const RecentActivity: React.FC<ActivityProps> = ({ activity }) => {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'submit':
        return <Assignment color="primary" />;
      case 'approve':
        return <CheckCircle color="success" />;
      case 'reject':
        return <Pending color="error" />;
      default:
        return <Assignment />;
    }
  };

  const getActivityText = (type: string) => {
    switch (type) {
      case 'submit':
        return '提交了债权申请';
      case 'approve':
        return '的债权申请已通过';
      case 'reject':
        return '的债权申请被驳回';
      default:
        return '进行了操作';
    }
  };

  return (
    <ListItem alignItems="flex-start">
      <ListItemAvatar>
        <Avatar>{getActivityIcon(activity.type)}</Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="body2">
              <strong>{activity.creditor}</strong> {getActivityText(activity.type)}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {activity.time}
            </Typography>
          </Box>
        }
        secondary={
          <Typography variant="body2" color="textSecondary">
            金额：¥{formatAmount(activity.amount)}
          </Typography>
        }
      />
    </ListItem>
  );
};

export default RecentActivity;
