import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
// import { db } from '../lib/surreal'; // REMOVED
import { useSurrealClient } from '../contexts/SurrealProvider'; // ADDED
import RichTextEditor, { QuillDelta } from '../components/RichTextEditor'; // Corrected path
import Delta from 'quill-delta'; // Import Delta for creating empty/initial deltas
import { useAuth } from '../contexts/AuthContext'; // To get user ID

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
  const client = useSurrealClient(); // ADDED
  const { user } = useAuth(); // Get current user for created_by/last_edited_by
  const navigate = useNavigate();

  const [filingMaterialDocId, setFilingMaterialDocId] = useState<string | null>(null);
  const [filingMaterialDelta, setFilingMaterialDelta] = useState<QuillDelta>(new Delta()); // Start with empty Delta
  const [isEditorLoading, setIsEditorLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null); // Added error state for UI feedback
  
  const liveQueryRef = useRef<string | null>(null); // Store the live query UUID string

  // 1. Create a new document on component mount for the filing material
  useEffect(() => {
    const createNewDocument = async () => {
      if (!user || !user.id) {
        console.error("User not available for creating document.");
        setError(t('create_case_error_generic')); // Or a more specific "user not found" error
        setIsEditorLoading(false);
        return;
      }
      setIsEditorLoading(true);
      try {
        const newEmptyDelta = new Delta();
        // Ensure content is stringified for SurrealDB.
        // The 'document' table expects content to be a string.
        // SurrealDB JS SDK v1.x returns the created records in an array.
        const createdRecords: Array<{ id: string, content: string, created_by: string }> = await client.create('document', { // MODIFIED db.create to client.create
          content: JSON.stringify(newEmptyDelta.ops), // Store Delta ops as stringified JSON
          created_by: user.id,
          last_edited_by: user.id,
        });

        if (createdRecords && createdRecords[0] && createdRecords[0].id) {
          setFilingMaterialDocId(createdRecords[0].id);
          // Content from DB is already stringified ops, parse then create Delta
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
    // Only run if docId is not set yet and user is available
    if(!filingMaterialDocId && user && user.id) { 
        createNewDocument();
    } else if (!user && !isEditorLoading) { // If user is not available and not already loading
        setIsEditorLoading(false); // Ensure loading is false if user is missing
        setError(t('create_case_error_generic')); // Or specific user error
    }
  }, [user, filingMaterialDocId, t, isEditorLoading]); // Added t and isEditorLoading

  // 2. Setup SurrealDB LIVE query when filingMaterialDocId is available
  useEffect(() => {
    if (!filingMaterialDocId || !user || !user.id) return; // Ensure user.id is available for comparison

    let isMounted = true; 
    // let streamKillUuid: string | null = null; // Not needed if liveQueryRef is used for UUID

    const setupLiveQuery = async () => {
      console.log(`Setting up LIVE query for document: ${filingMaterialDocId}`);
      try {
        const stream = await client.live('document', filingMaterialDocId); // MODIFIED db.live to client.live
        liveQueryRef.current = stream.toString(); // Store the UUID for killing

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
                    // Delta can be initialized with ops array directly
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
         client.kill(liveQueryRef.current as string).catch(err => console.error("Error killing live query:", err)); // MODIFIED db.kill to client.kill
         liveQueryRef.current = null;
      }
    };
  }, [filingMaterialDocId, user, t]);


  // 3. Debounced save function
  const debouncedSave = useCallback(
    debounce(async (deltaToSave: QuillDelta, docId: string, editorUserId: string | undefined) => {
      if (!docId || !editorUserId) return;
      console.log(`Debounced save triggered for doc: ${docId} by user: ${editorUserId}`);
      setIsSaving(true);
      try {
        await client.merge(docId, { // MODIFIED db.merge to client.merge
          content: JSON.stringify(deltaToSave.ops), // Save Delta ops as stringified JSON
          last_edited_by: editorUserId,
        });
        console.log(`Document ${docId} saved successfully.`);
      } catch (error) {
        console.error(`Error saving document ${docId}:`, error);
        // Optionally set an error state to inform the user
      } finally {
        setIsSaving(false);
      }
    }, 2000), 
    [] 
  );

  // 4. Handle editor text change
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
  
  // 5. Actual save case function 
  const handleSaveCase = async () => {
    if (!filingMaterialDocId) {
      alert(t('create_case_error_no_filing_doc')); 
      return;
    }
    const caseNameInput = document.getElementById('caseName') as HTMLInputElement;
    const caseName = caseNameInput?.value || `示例案件 ${Date.now()}`;

    const caseData = {
      name: caseName,
      case_number: "BK-" + Date.now().toString().slice(-6), // Placeholder
      details: "此案件通过在线编辑器创建。", // Placeholder
      status: '立案', 
      filing_material_doc_id: filingMaterialDocId,
      created_by: user?.id, 
      admin_id: user?.id, // Assuming creator is admin initially
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setIsSaving(true); 
    try {
      const createdCaseRecords: Array<{id: string}> = await client.create('case', caseData); // MODIFIED db.create to client.create
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


  if (isEditorLoading && !filingMaterialDocId && !error) { // Show loading only if no doc and no error yet
    return <div className="p-6 text-center">{t('create_case_editor_loading_new_doc')}</div>;
  }
  
  if (error && !filingMaterialDocId) { // If there was an error creating the initial doc
    return <div className="p-6 text-center text-red-500">{error}</div>;
  }


  return (
    <div className="p-6">
      <div className="mb-6">
        <Link to="/cases" className="text-blue-600 hover:underline">&larr; {t('create_case_back_to_list_link')}</Link>
      </div>
      <h1 className="text-2xl font-semibold text-gray-800 mb-4">{t('create_case_page_title')}</h1>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <p className="text-gray-700 mb-2">{t('create_case_intro_p1')}</p>
        <p className="text-gray-500 text-sm mb-4">{t('create_case_intro_p2')}</p>
        
        <div className="mb-4">
          <label htmlFor="caseName" className="block text-sm font-medium text-gray-700">案件名称 (示例)</label>
          <input type="text" id="caseName" name="caseName" defaultValue={`示例案件 ${Date.now()}`} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
        </div>

        <h2 className="text-xl font-semibold text-gray-700 mt-6 mb-3">{t('create_case_filing_material_title')}</h2>
        {isSaving && <p className="text-sm text-yellow-600">{t('saving_document')}</p>}
        
        <RichTextEditor
          value={filingMaterialDelta}
          onTextChange={handleEditorTextChange} // Use onTextChange
          placeholder={t('richtexteditor_placeholder')}
          readOnly={isEditorLoading || !filingMaterialDocId} 
        />
        
        <div className="mt-6">
          <button
            onClick={handleSaveCase}
            disabled={isSaving || isEditorLoading || !filingMaterialDocId}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isSaving ? t('saving_case_button_saving') : t('create_case_save_button')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateCasePage;
