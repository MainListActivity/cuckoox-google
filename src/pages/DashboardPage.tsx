import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  // Placeholder data for stat cards
  const statCards = [
    { title: 'Active Cases', value: '5', color: 'primary.main' },
    { title: 'Claims Pending Review', value: '12', color: 'secondary.main' },
    { title: 'Upcoming Meetings', value: '2', color: 'warning.main' }, // Assuming you have a warning color in your theme
  ];

  // Placeholder data for recent activity
  const recentActivity = [
    'Case #1023: New claim submitted. (Placeholder)',
    'Meeting: Creditor Meeting for Case #998 scheduled. (Placeholder)',
    "User 'john.doe' logged in. (Placeholder)",
  ];

  return (
    <Box sx={{ p: 0 }}> {/* Layout already provides padding, so set to 0 or adjust as needed */}
      <Typography variant="h4" component="h1" gutterBottom>
        Dashboard
      </Typography>
      {user && (
        <Typography variant="subtitle1" gutterBottom sx={{ mb: 3 }}>
          Welcome back, {user.name}!
        </Typography>
      )}

      <Grid container spacing={3}>
        {statCards.map((card, index) => (
          <Grid item xs={12} md={6} lg={4} key={index}>
            <Card sx={{ '&:hover': { boxShadow: 6 } }}>
              <CardContent>
                <Typography variant="h6" component="h2" sx={{ color: card.color }} gutterBottom>
                  {card.title}
                </Typography>
                <Typography variant="h3" component="p">
                  {card.value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Placeholder Data
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card sx={{ mt: 4 }}>
        <CardContent>
          <Typography variant="h5" component="h3" sx={{ mb: 2 }}>
            Recent Activity
          </Typography>
          <List dense>
            {recentActivity.map((activity, index) => (
              <ListItem key={index}>
                <ListItemText primary={activity} />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 4, display: 'block' }}>
        This is a placeholder dashboard. Actual data and visualizations related to cases, claims, and user activity will be displayed here based on the selected case and user permissions.
      </Typography>
    </Box>
  );
};

export default DashboardPage;