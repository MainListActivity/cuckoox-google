import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSurrealClient } from '../contexts/SurrealProvider';
import RichTextEditor, { QuillDelta } from '../components/RichTextEditor';
import Delta from 'quill-delta';
import { useAuth } from '../contexts/AuthContext';
import {
  Box,
  Typography,
  Button,
  TextField,
  Card,
  CardContent,
  CircularProgress,
  Alert as MuiAlert, // Renamed to avoid conflict with local Alert
  SvgIcon,
  Grid, // For layout
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  FormHelperText,
} from '@mui/material';
import { mdiArrowLeft, mdiContentSave } from '@mdi/js';
import { useSnackbar } from '../contexts/SnackbarContext'; // Added

// Debounce helper
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<F>): Promise<ReturnType<F>> =>
    new Promise(resolve => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => resolve(func(...args)), waitFor);
    });
}

const CreateCasePage: React.FC = () => {
  const { t } = useTranslation();
  const client = useSurrealClient();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [filingMaterialDocId, setFilingMaterialDocId] = useState<string | null>(null);
  const [filingMaterialDelta, setFilingMaterialDelta] = useState<QuillDelta>(new Delta());
  const [isEditorLoading, setIsEditorLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [pageError, setPageError] = useState<string | null>(null); // Renamed error state for clarity
  const { showSuccess } = useSnackbar(); // Added

  // New form states
  const [caseName, setCaseName] = useState<string>(`示例案件 ${Date.now()}`);
  const [caseLead, setCaseLead] = useState<string>('');
  const [caseProcedure, setCaseProcedure] = useState<string>('破产清算'); // Default procedure
  const [acceptanceDate, setAcceptanceDate] = useState<string>('');
  
  // Conditional date fields
  const [announcementDate, setAnnouncementDate] = useState<string>('');
  const [claimStartDate, setClaimStartDate] = useState<string>('');
  const [claimEndDate, setClaimEndDate] = useState<string>('');
  
  const liveQueryRef = useRef<string | null>(null);
  
  // Determine if bankruptcy-specific fields should be shown
  const showBankruptcyFields = caseProcedure === '破产清算' || caseProcedure === '破产重整' || caseProcedure === '破产和解';

  useEffect(() => {
    const createNewDocument = async () => {
      if (!user || !user.id) {
        console.error("User not available for creating document.");
        setPageError(t('create_case_error_generic')); // Use new error state
        setIsEditorLoading(false);
        return;
      }
      setIsEditorLoading(true);
      try {
        const newEmptyDelta = new Delta();
        const createdRecords: Array<{ id: string, content: string, created_by: string }> = await client.create('document', {
          content: JSON.stringify(newEmptyDelta.ops),
          created_by: user.id,
          last_edited_by: user.id,
        });

        if (createdRecords && createdRecords[0] && createdRecords[0].id) {
          setFilingMaterialDocId(createdRecords[0].id);
          setFilingMaterialDelta(new Delta(JSON.parse(createdRecords[0].content)));
          console.log('Created new document for filing material:', createdRecords[0].id);
        } else {
          throw new Error('Failed to create document record or get its ID.');
        }
      } catch (e) { // Changed error variable name to avoid conflict
        console.error("Error creating new document for filing material:", e);
        setPageError(t('create_case_error_generic')); // Use new error state
      } finally {
        setIsEditorLoading(false);
      }
    };
    if(!filingMaterialDocId && user && user.id) {
        createNewDocument();
    } else if (!user && !isEditorLoading) {
        setIsEditorLoading(false);
        setPageError(t('create_case_error_generic')); // Use new error state
    }
  }, [user, filingMaterialDocId, t, isEditorLoading, client]);

  useEffect(() => {
    if (!filingMaterialDocId || !user || !user.id) return;

    let isMounted = true;
    const setupLiveQuery = async () => {
      console.log(`Setting up LIVE query for document: ${filingMaterialDocId}`);
      try {
        const stream = await client.live('document', filingMaterialDocId);
        liveQueryRef.current = stream.toString();

        for await (const event of stream) {
            if (!isMounted) break;
            console.log('Live event received:', event);
            
            if (event.action === 'UPDATE' && event.result && typeof event.result.content === 'string') {
                if (user && event.result.last_edited_by === user.id) {
                    console.log("Live: Ignoring own change for user:", user.id);
                    continue;
                }
                try {
                    const remoteDeltaOps = JSON.parse(event.result.content as string);
                    const remoteDelta = new Delta(remoteDeltaOps.ops ? remoteDeltaOps.ops : remoteDeltaOps);
                    console.log("Live: Applying remote delta from user:", event.result.last_edited_by);
                    setFilingMaterialDelta(remoteDelta);
                } catch (e) {
                    console.error("Live: Error parsing remote delta:", e, "Raw content:", event.result.content);
                }
            } else if (event.action === 'DELETE') {
                console.warn(`Live: Document ${filingMaterialDocId} was deleted.`);
                if (isMounted) {
                    setFilingMaterialDelta(new Delta());
                    setPageError(t('create_case_error_no_filing_doc')); // Use new error state
                }
            }
        }
      } catch (e) { // Changed error variable name
        if (isMounted) console.error("Live query setup or stream error:", e);
      }
    };

    setupLiveQuery();

    return () => {
      isMounted = false;
      if (liveQueryRef.current) {
         console.log('Requesting to kill live query UUID:', liveQueryRef.current);
         client.kill(liveQueryRef.current as string).catch(err => console.error("Error killing live query:", err));
         liveQueryRef.current = null;
      }
    };
  }, [filingMaterialDocId, user, t, client]); // Added client to dependencies


  const debouncedSave = useCallback(
    debounce(async (deltaToSave: QuillDelta, docId: string, editorUserId: string | undefined) => {
      if (!docId || !editorUserId) return;
      console.log(`Debounced save triggered for doc: ${docId} by user: ${editorUserId}`);
      setIsSaving(true);
      try {
        await client.merge(docId, {
          content: JSON.stringify(deltaToSave.ops),
          last_edited_by: editorUserId,
        });
        console.log(`Document ${docId} saved successfully.`);
      } catch (error) {
        console.error(`Error saving document ${docId}:`, error);
      } finally {
        setIsSaving(false);
      }
    }, 2000),
    [client] // Added client to dependencies
  );

  const handleEditorTextChange = (
    currentContentsDelta: QuillDelta,
    changeDelta: QuillDelta,
    source: string
  ) => {
    if (source === 'user') {
      console.log('User change detected, new full delta:', currentContentsDelta);
      setFilingMaterialDelta(currentContentsDelta);
      if (filingMaterialDocId && user && user.id) {
        debouncedSave(currentContentsDelta, filingMaterialDocId, user.id);
      }
    }
  };
  
  const handleSaveCase = async () => {
    if (!filingMaterialDocId) {
      setPageError(t('create_case_error_no_filing_doc')); // Use new error state
      return;
    }
    setPageError(null); // Clear previous errors

    // Validate required fields (example for caseLead and acceptanceDate)
    if (!caseLead.trim() || !acceptanceDate) {
      setPageError(t('create_case_error_required_fields', '请填写所有必填字段：案件负责人和受理时间。'));
      return;
    }


    const caseData = {
      name: caseName,
      case_lead: caseLead,
      case_procedure: caseProcedure,
      acceptance_date: acceptanceDate,
      announcement_date: showBankruptcyFields ? announcementDate : null,
      claim_start_date: showBankruptcyFields ? claimStartDate : null,
      claim_end_date: showBankruptcyFields ? claimEndDate : null,
      case_number: "BK-" + Date.now().toString().slice(-6), // Placeholder
      details: "此案件通过在线编辑器创建。", // Placeholder
      status: '立案', // Default status
      filing_material_doc_id: filingMaterialDocId,
      created_by: user?.id,
      admin_id: user?.id, // Assuming creator is admin for now
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    console.log("Saving case data:", caseData);

    setIsSaving(true);
    try {
      const createdCaseRecords: Array<{id: string}> = await client.create('case', caseData);
      console.log('Case created:', createdCaseRecords);
      showSuccess(t('create_case_success')); // Use snackbar
      if (createdCaseRecords[0]?.id) {
        navigate(`/cases/${createdCaseRecords[0].id.replace('case:', '')}`);
      } else {
        navigate('/cases');
      }
    } catch (e) { // Changed error variable name
      console.error('Error creating case:', e);
      setPageError(t('create_case_error_generic')); // Use new error state
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleInputChange = () => {
    if (pageError) {
      setPageError(null); // Clear error when user starts editing
    }
  };

  if (isEditorLoading && !filingMaterialDocId && !pageError) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 200px)', p: 3 }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>{t('create_case_editor_loading_new_doc')}</Typography>
      </Box>
    );
  }
  
  if (pageError && !filingMaterialDocId) { // If doc creation failed critically
    return <Box sx={{ p: 3 }}><MuiAlert severity="error">{pageError}</MuiAlert></Box>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Button component={Link} to="/cases" startIcon={<SvgIcon><path d={mdiArrowLeft} /></SvgIcon>} sx={{ mb: 2 }}>
        {t('create_case_back_to_list_link')}
      </Button>
      <Typography variant="h4" component="h1" gutterBottom>
        {t('create_case_page_title')}
      </Typography>
      
      <Card>
        <CardContent>
          <Typography variant="body1" gutterBottom>{t('create_case_intro_p1')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{t('create_case_intro_p2')}</Typography>
          
          {pageError && <MuiAlert severity="error" sx={{ mb: 2 }}>{pageError}</MuiAlert>}

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                id="caseName"
                label={t('create_case_case_name_label', '案件名称')}
                value={caseName}
                onChange={(e) => { setCaseName(e.target.value); handleInputChange(); }}
                fullWidth
                variant="outlined"
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                id="caseLead"
                label={t('create_case_lead_label', '案件负责人')}
                value={caseLead}
                onChange={(e) => { setCaseLead(e.target.value); handleInputChange();}}
                fullWidth
                variant="outlined"
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth variant="outlined" required>
                <InputLabel id="case-procedure-label">{t('create_case_procedure_label', '案件程序')}</InputLabel>
                <Select
                  labelId="case-procedure-label"
                  id="caseProcedure"
                  value={caseProcedure}
                  onChange={(e) => { setCaseProcedure(e.target.value as string); handleInputChange();}}
                  label={t('create_case_procedure_label', '案件程序')}
                >
                  <MenuItem value="破产清算">{t('procedure_liquidation', '破产清算')}</MenuItem>
                  <MenuItem value="破产重整">{t('procedure_reorganization', '破产重整')}</MenuItem>
                  <MenuItem value="破产和解">{t('procedure_composition', '破产和解')}</MenuItem>
                  {/* Add other procedures if any */}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                id="acceptanceDate"
                label={t('create_case_acceptance_date_label', '受理时间')}
                type="date"
                value={acceptanceDate}
                onChange={(e) => { setAcceptanceDate(e.target.value); handleInputChange();}}
                fullWidth
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>

            {showBankruptcyFields && (
              <>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    id="announcementDate"
                    label={t('create_case_announcement_date_label', '公告时间')}
                    type="date"
                    value={announcementDate}
                    onChange={(e) => { setAnnouncementDate(e.target.value); handleInputChange();}}
                    fullWidth
                    variant="outlined"
                    InputLabelProps={{ shrink: true }}
                    helperText={t('create_case_announcement_date_hint', '最迟受理破产申请之日起25日')}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    id="claimStartDate"
                    label={t('create_case_claim_start_date_label', '债权申报开始时间')}
                    type="date"
                    value={claimStartDate}
                    onChange={(e) => { setClaimStartDate(e.target.value); handleInputChange();}}
                    fullWidth
                    variant="outlined"
                    InputLabelProps={{ shrink: true }}
                    helperText={t('create_case_claim_start_date_hint', '最早发布受理破产申请公告之日30日')}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    id="claimEndDate"
                    label={t('create_case_claim_end_date_label', '债权申报截止时间')}
                    type="date"
                    value={claimEndDate}
                    onChange={(e) => { setClaimEndDate(e.target.value); handleInputChange();}}
                    fullWidth
                    variant="outlined"
                    InputLabelProps={{ shrink: true }}
                    helperText={t('create_case_claim_end_date_hint', '最迟发布受理破产申请公告之日3个月')}
                  />
                </Grid>
              </>
            )}
          </Grid>

          <Typography variant="h5" component="h2" gutterBottom sx={{ mt: 4, mb: 2 }}>
            {t('create_case_filing_material_title')}
          </Typography>
          {isSaving && !pageError && ( // Only show saving indicator if no page error
            <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary', mb: 1 }}>
              <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />
              <Typography variant="caption">{t('saving_document')}</Typography>
            </Box>
          )}
          
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, minHeight: 300, p: 1, '& .ProseMirror': { minHeight: '280px' } }}>
            <RichTextEditor
              value={filingMaterialDelta}
              onTextChange={handleEditorTextChange}
              placeholder={t('richtexteditor_placeholder')}
              readOnly={isEditorLoading || !filingMaterialDocId}
            />
          </Box>
          
          <Button
            variant="contained"
            color="primary"
            onClick={handleSaveCase}
            disabled={isSaving || isEditorLoading || !filingMaterialDocId}
            startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : <SvgIcon><path d={mdiContentSave} /></SvgIcon>}
            sx={{ mt: 3 }}
          >
            {isSaving ? t('saving_case_button_saving') : t('create_case_save_button')}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default CreateCasePage;
