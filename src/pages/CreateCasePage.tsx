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
  Alert,
  SvgIcon,
} from '@mui/material';
import { mdiArrowLeft, mdiContentSave } from '@mdi/js';

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
  const [error, setError] = useState<string | null>(null);
  
  const liveQueryRef = useRef<string | null>(null);

  useEffect(() => {
    const createNewDocument = async () => {
      if (!user || !user.id) {
        console.error("User not available for creating document.");
        setError(t('create_case_error_generic'));
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
      } catch (error) {
        console.error("Error creating new document for filing material:", error);
        setError(t('create_case_error_generic'));
      } finally {
        setIsEditorLoading(false);
      }
    };
    if(!filingMaterialDocId && user && user.id) {
        createNewDocument();
    } else if (!user && !isEditorLoading) {
        setIsEditorLoading(false);
        setError(t('create_case_error_generic'));
    }
  }, [user, filingMaterialDocId, t, isEditorLoading, client]); // Added client to dependencies

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
                    setError(t('create_case_error_no_filing_doc'));
                }
            }
        }
      } catch (e) {
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
      alert(t('create_case_error_no_filing_doc'));
      return;
    }
    const caseNameInput = document.getElementById('caseName') as HTMLInputElement;
    const caseName = caseNameInput?.value || `示例案件 ${Date.now()}`;

    const caseData = {
      name: caseName,
      case_number: "BK-" + Date.now().toString().slice(-6),
      details: "此案件通过在线编辑器创建。",
      status: '立案',
      filing_material_doc_id: filingMaterialDocId,
      created_by: user?.id,
      admin_id: user?.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setIsSaving(true);
    try {
      const createdCaseRecords: Array<{id: string}> = await client.create('case', caseData);
      console.log('Case created:', createdCaseRecords);
      alert(t('create_case_success'));
      if (createdCaseRecords[0]?.id) {
        navigate(`/cases/${createdCaseRecords[0].id.replace('case:', '')}`);
      } else {
        navigate('/cases');
      }
    } catch (error) {
      console.error('Error creating case:', error);
      alert(t('create_case_error_generic'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditorLoading && !filingMaterialDocId && !error) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 200px)', p: 3 }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>{t('create_case_editor_loading_new_doc')}</Typography>
      </Box>
    );
  }
  
  if (error && !filingMaterialDocId) {
    return <Box sx={{ p: 3 }}><Alert severity="error">{error}</Alert></Box>;
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
          
          <TextField
            id="caseName"
            label={t('create_case_case_name_label', '案件名称 (示例)')}
            defaultValue={`示例案件 ${Date.now()}`}
            fullWidth
            variant="outlined"
            sx={{ mb: 3 }}
          />

          <Typography variant="h5" component="h2" gutterBottom sx={{ mt: 3 }}>
            {t('create_case_filing_material_title')}
          </Typography>
          {isSaving && (
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
