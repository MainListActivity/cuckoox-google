import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../lib/surreal'; // Corrected path
import { RecordId } from 'surrealdb'; // For typing record IDs
import RichTextEditor from '../components/RichTextEditor'; // IMPORT RichTextEditor
import { useTranslation } from 'react-i18next'; // <-- IMPORT I18N
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  SvgIcon,
} from '@mui/material';
import { mdiArrowLeft, mdiCircleSmall, mdiBookOpenOutline, mdiSync } from '@mdi/js';

// Define interfaces based on your SurrealDB schema
interface Case {
  id: RecordId;
  name: string;
  case_number?: string;
  details?: string; // Added from schema
  status?: string; // Added from schema
  admin_id?: RecordId; // Added from schema
  created_at?: string; // Added from schema
  updated_at?: string; // Added from schema
  // Mock fields that might be added to schema later or sourced differently
  case_lead_name?: string;
  acceptance_date?: string;
  current_stage?: string;
  filing_material_doc_id?: RecordId | null;
}

interface Document {
  id: RecordId;
  content: string;
  // ... other document fields ...
}

const CaseDetailPage: React.FC = () => {
  const { t } = useTranslation(); // <-- INITIALIZE T
  const { id } = useParams<{ id: string }>();
  const [caseDetail, setCaseDetail] = useState<Case | null>(null);
  const [filingMaterialContent, setFilingMaterialContent] = useState<string>(''); // Default to empty string
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError(t('case_detail_unspecified_case')); // Use a generic "unspecified" key if no ID
      setIsLoading(false);
      return;
    }

    const fetchCaseDetails = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const caseRecordId = id.startsWith('case:') ? id : `case:${id}`;
        const result: Case[] = await db.select(caseRecordId);

        if (result.length === 0 || !result[0]) {
          setError(t('case_detail_error_not_found'));
          setCaseDetail(null);
          setIsLoading(false);
          return;
        }
        const fetchedCase = result[0];
        setCaseDetail(fetchedCase);

        if (fetchedCase.filing_material_doc_id) {
          const docId = fetchedCase.filing_material_doc_id.toString();
          const docResult: Document[] = await db.select(docId);
          if (docResult.length > 0 && docResult[0]) {
            setFilingMaterialContent(docResult[0].content);
          } else {
            console.warn(`Filing material document not found for ID: ${docId}`);
            setFilingMaterialContent(t('case_detail_filing_material_not_found'));
          }
        } else {
          setFilingMaterialContent(t('case_detail_no_associated_filing_material'));
        }
      } catch (err) {
        console.error("Error fetching case details:", err);
        setError(t('case_detail_error_fetch_failed'));
        setCaseDetail(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCaseDetails();
  }, [id, t]); // Added t to dependency array

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px', p: 3 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>{t('case_detail_loading')}</Typography>
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error" sx={{ m: 3 }}>{error}</Alert>;
  }

  if (!caseDetail) {
    return <Alert severity="info" sx={{ m: 3 }}>{t('case_detail_unspecified_case')}</Alert>;
  }

  const displayCase = {
    name: caseDetail.name || t('case_detail_unnamed_case'),
    case_number: caseDetail.case_number || `BK-N/A-${caseDetail.id.toString().slice(caseDetail.id.toString().indexOf(':') + 1).slice(-4)}`,
    id: caseDetail.id.toString(),
    case_lead_name: caseDetail.case_lead_name || t('case_detail_to_be_assigned'),
    acceptance_date: caseDetail.acceptance_date || t('case_detail_date_unknown'),
    current_stage: caseDetail.current_stage || caseDetail.status || t('case_detail_stage_unknown'),
    filing_materials_status: filingMaterialContent ? t('case_detail_content_loaded') : t('case_detail_no_filing_material'),
    details: caseDetail.details || t('case_detail_no_details')
  };

  return (
    <Box sx={{ p: 3 }}>
      <Button component={Link} to="/cases" startIcon={<SvgIcon><path d={mdiArrowLeft} /></SvgIcon>} sx={{ mb: 2 }}>
        {t('case_detail_back_to_list_link')}
      </Button>
      <Typography variant="h4" component="h1" gutterBottom>
        {t('case_detail_page_title_prefix')}: {displayCase.case_number}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" gutterBottom sx={{ mb: 3 }}>
        {t('case_detail_id_label')}: {displayCase.id}
      </Typography>

      <Grid container spacing={3}>
        {/* Basic Info Section */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h5" component="h2" gutterBottom borderBottom={1} borderColor="divider" pb={1} mb={2}>
                {t('case_detail_basic_info_title')}
              </Typography>
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" component="span" color="text.secondary" sx={{ fontWeight: 'bold' }}>{t('case_detail_name_label')}: </Typography>
                <Typography variant="body1" component="span">{displayCase.name}</Typography>
              </Box>
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" component="span" color="text.secondary" sx={{ fontWeight: 'bold' }}>{t('case_detail_lead_label')}: </Typography>
                <Typography variant="body1" component="span">{displayCase.case_lead_name}</Typography>
              </Box>
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" component="span" color="text.secondary" sx={{ fontWeight: 'bold' }}>{t('case_detail_acceptance_time_label')}: </Typography>
                <Typography variant="body1" component="span">{displayCase.acceptance_date}</Typography>
              </Box>
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" component="span" color="text.secondary" sx={{ fontWeight: 'bold', mr:1 }}>{t('case_detail_current_stage_label')}: </Typography>
                <Chip size="small" label={displayCase.current_stage} color="primary" />
              </Box>
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" component="span" color="text.secondary" sx={{ fontWeight: 'bold', mr:1 }}>{t('case_detail_status_label')}: </Typography>
                <Chip size="small" label={caseDetail.status || t('case_detail_status_unknown')} color="secondary" />
              </Box>
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" component="span" color="text.secondary" sx={{ fontWeight: 'bold' }}>{t('case_detail_details_label')}: </Typography>
                <Typography variant="body1" component="span" sx={{whiteSpace: 'pre-wrap'}}>{displayCase.details}</Typography>
              </Box>
              
              <Typography variant="h6" component="h3" gutterBottom borderBottom={1} borderColor="divider" pb={1} mb={1} mt={3}>
                {t('case_detail_timeline_title')}
              </Typography>
              <List dense>
                <ListItem><ListItemIcon sx={{minWidth: 20}}><SvgIcon fontSize="small"><path d={mdiCircleSmall} /></SvgIcon></ListItemIcon><ListItemText primary={t('case_detail_timeline_event1')} /></ListItem>
                <ListItem><ListItemIcon sx={{minWidth: 20}}><SvgIcon fontSize="small"><path d={mdiCircleSmall} /></SvgIcon></ListItemIcon><ListItemText primary={t('case_detail_timeline_event2')} /></ListItem>
                <ListItem><ListItemIcon sx={{minWidth: 20}}><SvgIcon fontSize="small"><path d={mdiCircleSmall} /></SvgIcon></ListItemIcon><ListItemText primary={t('case_detail_timeline_event3')} /></ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Filing Material & Actions Section */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h5" component="h2" gutterBottom borderBottom={1} borderColor="divider" pb={1} mb={2}>
                {t('case_detail_filing_material_title')}
              </Typography>
              <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1, minHeight: '200px', '& .ProseMirror': { backgroundColor: 'transparent', minHeight: '180px', p:1 } }}>
                <RichTextEditor
                  value={filingMaterialContent}
                  onChange={() => {}} // Read-only, so no actual change handling needed
                  readOnly={true}
                  placeholder={t('case_detail_filing_material_empty')}
                />
              </Box>
              <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                <Button variant="contained" color="success" startIcon={<SvgIcon><path d={mdiBookOpenOutline} /></SvgIcon>}>
                  {t('case_detail_actions_meeting_minutes_button')}
                </Button>
                <Button variant="contained" color="warning" startIcon={<SvgIcon><path d={mdiSync} /></SvgIcon>}>
                  {t('case_detail_actions_change_status_button')}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Typography variant="caption" color="text.secondary" align="center" display="block" sx={{ mt: 3 }}>
        {t('case_detail_footer_info_1')} {t('case_detail_footer_info_2')}
      </Typography>
    </Box>
  );
};

export default CaseDetailPage;