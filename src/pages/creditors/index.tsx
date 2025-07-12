// TODO: Automatic Navigation - Logic for navigating to this page when case status is '立案' should be handled in higher-level routing (e.g., App.tsx or ProtectedRoute.tsx).
// TODO: Access Control - Page access to Creditor Management itself should be controlled via routing based on user permissions (e.g., has 'view_creditors' or a general case access permission).
import React, { useState, useEffect } from 'react';
import Papa from 'papaparse'; // Added for CSV parsing
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Stack,
  SvgIcon,
  TextField, // Added
  InputAdornment, // Added
  Checkbox, // Added
  Tooltip, // Added for clarity on icon buttons
  CircularProgress, // Added for loading state
  Alert, // Added for error state
  TablePagination, // Added for pagination
  Chip, // Added for search criteria display
} from '@mui/material';
import { 
  mdiAccountPlusOutline, 
  mdiPrinterOutline, 
  mdiPencilOutline, 
  mdiDeleteOutline, 
  mdiMagnify, // Added
  mdiFileImportOutline,
  mdiFilterOutline, // Added for advanced search
} from '@mdi/js';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from '@/src/contexts/SnackbarContext';
import PrintWaybillsDialog from './PrintWaybillsDialog'; // MODIFIED PATH
import AddCreditorDialog from './AddCreditorDialog'; // MODIFIED PATH
import type { CreditorFormData, Creditor, RawCreditorData, CountResult, CsvRowData } from './types'; // MODIFIED PATH for type
import BatchImportCreditorsDialog from './BatchImportCreditorsDialog'; // MODIFIED PATH
import AdvancedSearchDialog, { type AdvancedSearchCriteria } from './AdvancedSearchDialog';
import CreditorClaimsDialog from './CreditorClaimsDialog';
import ConfirmDeleteDialog from '@/src/components/common/ConfirmDeleteDialog';
import { useAuth } from '@/src/contexts/AuthContext'; // Added
import { useSurreal } from '@/src/contexts/SurrealProvider'; // Added
import { RecordId } from 'surrealdb'; // Added
import { useDebounce } from '@/src/hooks/useDebounce'; // ADDED
import { useOperationPermission } from '@/src/hooks/usePermission';
import { AuthenticationRequiredError } from '@/src/services/dataService'; // Added for new auth check
import { useNavigate } from 'react-router-dom'; // Added for navigation

// Creditor interface moved to ./types.ts

// Mock data removed

const CreditorListPage: React.FC = () => {
  const { t } = useTranslation();
  const { showSuccess, showError, showInfo } = useSnackbar(); // Added showError and showInfo
  const { selectedCaseId, user, hasRole } = useAuth(); // Added user and hasRole
  const { dataService, isSuccess: isDbConnected } = useSurreal(); // Updated to use dataService
  const navigate = useNavigate(); // Added for navigation

  // Determine if the user has management permissions
  // For now, system admin (user?.github_id === '--admin--') or users with 'case_manager' role for the selected case.
  // Assuming hasRole('admin') covers the system admin case.
  const canManageCreditors = hasRole('admin') || hasRole('case_manager');

  // 权限检查
  const { hasPermission: canCreate } = useOperationPermission('creditor_create');
  const { hasPermission: canEdit } = useOperationPermission('creditor_edit');
  const { hasPermission: canDelete } = useOperationPermission('creditor_delete');
  const { hasPermission: canBatchImport } = useOperationPermission('creditor_batch_import');
  const { hasPermission: canPrintWaybill } = useOperationPermission('creditor_print_waybill');

  const [creditors, setCreditors] = useState<Creditor[]>([]); // Initialize with empty array
  const [isLoading, setIsLoading] = useState<boolean>(true); // Added
  const [error, setError] = useState<string | null>(null); // Added
  const [selectedCreditorIds, setSelectedCreditorIds] = useState<(RecordId | string)[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500); // ADDED

  // Pagination states
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [totalCreditors, setTotalCreditors] = useState<number>(0);
  
  // Dialog states
  const [printWaybillsDialogOpen, setPrintWaybillsDialogOpen] = useState<boolean>(false);
  const [addCreditorOpen, setAddCreditorOpen] = useState<boolean>(false);
  const [batchImportOpen, setBatchImportOpen] = useState<boolean>(false);
  const [editingCreditor, setEditingCreditor] = useState<Creditor | null>(null);
  // const [isImporting, setIsImporting] = useState<boolean>(false); // Replaced by isBatchProcessing
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false); // Added for batch import loading state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [creditorToDelete, setCreditorToDelete] = useState<Creditor | null>(null);
  
  // Advanced search states
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState<boolean>(false);
  const [currentSearchCriteria, setCurrentSearchCriteria] = useState<AdvancedSearchCriteria | null>(null);
  
  // Creditor claims dialog states
  const [claimsDialogOpen, setClaimsDialogOpen] = useState<boolean>(false);
  const [selectedCreditorForClaims, setSelectedCreditorForClaims] = useState<Creditor | null>(null);

  const fetchCreditors = React.useCallback(async (currentPage: number, currentRowsPerPage: number, currentSearchTerm: string, searchCriteria?: AdvancedSearchCriteria | null) => {
    if (!selectedCaseId || !isDbConnected) {
      setCreditors([]);
      setTotalCreditors(0);
      setIsLoading(false);
      if (!selectedCaseId && isDbConnected) {
        setError(t('error_no_case_selected', '请先选择一个案件。'));
      } else if (selectedCaseId && !isDbConnected) {
        setError(t('error_db_not_connected', '数据库未连接。'));
      } else if (!selectedCaseId && !isDbConnected) {
        setError(t('error_no_case_selected_or_db_issues', '请选择案件或检查数据库连接。'));
      }
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      let dataQuery = `SELECT 
        id, 
        type, 
        name, 
        legal_id, 
        contact_person_name, 
        contact_phone, 
        contact_address, 
        created_at, 
        case_id,
        (SELECT math::sum(asserted_claim_details.total_asserted_amount) FROM claim WHERE creditor_id = \$parent.id AND case_id = \$parent.case_id GROUP ALL)[0] AS total_claim_amount,
        (SELECT count() FROM claim WHERE creditor_id = \$parent.id AND case_id = \$parent.case_id GROUP ALL)[0] AS claim_count
      FROM creditor WHERE case_id = $caseId`;
      let countQuery = 'SELECT count() AS total FROM creditor WHERE case_id = $caseId';
      const queryParams: Record<string, unknown> = {
        caseId: selectedCaseId,
      };

      // Build search conditions based on search criteria or simple search term
      const searchConditions: string[] = [];
      
      if (searchCriteria) {
        // Advanced search mode
        if (searchCriteria.useFullTextSearch && searchCriteria.fullTextSearch.trim()) {
          // Use full-text search with @@ operator across multiple fields
          const fullTextQuery = searchCriteria.fullTextSearch.trim();
          searchConditions.push(`AND (name @@ $fullTextQuery OR legal_id @@ $fullTextQuery OR contact_person_name @@ $fullTextQuery OR contact_phone @@ $fullTextQuery OR contact_address @@ $fullTextQuery)`);
          queryParams.fullTextQuery = fullTextQuery;
        } else {
          // Field-specific search
          if (searchCriteria.name.trim()) {
            searchConditions.push(`AND name CONTAINS $nameQuery`);
            queryParams.nameQuery = searchCriteria.name.trim();
          }
          if (searchCriteria.identifier.trim()) {
            searchConditions.push(`AND legal_id CONTAINS $identifierQuery`);
            queryParams.identifierQuery = searchCriteria.identifier.trim();
          }
          if (searchCriteria.contactPersonName.trim()) {
            searchConditions.push(`AND contact_person_name CONTAINS $contactPersonQuery`);
            queryParams.contactPersonQuery = searchCriteria.contactPersonName.trim();
          }
          if (searchCriteria.contactPhone.trim()) {
            searchConditions.push(`AND contact_phone CONTAINS $contactPhoneQuery`);
            queryParams.contactPhoneQuery = searchCriteria.contactPhone.trim();
          }
          if (searchCriteria.address.trim()) {
            searchConditions.push(`AND contact_address CONTAINS $addressQuery`);
            queryParams.addressQuery = searchCriteria.address.trim();
          }
        }
        
        // Type filter
        if (searchCriteria.type !== 'all') {
          searchConditions.push(`AND type = $typeFilter`);
          queryParams.typeFilter = searchCriteria.type;
        }
        
        // Date range filters
        if (searchCriteria.createdAfter) {
          searchConditions.push(`AND created_at >= $createdAfter`);
          queryParams.createdAfter = searchCriteria.createdAfter.toISOString();
        }
        if (searchCriteria.createdBefore) {
          searchConditions.push(`AND created_at <= $createdBefore`);
          queryParams.createdBefore = searchCriteria.createdBefore.toISOString();
        }
      } else if (currentSearchTerm && currentSearchTerm.trim() !== '') {
        // Simple search mode (legacy)
        searchConditions.push(`AND (name CONTAINS $searchTerm OR legal_id CONTAINS $searchTerm OR contact_person_name CONTAINS $searchTerm OR contact_phone CONTAINS $searchTerm OR contact_address CONTAINS $searchTerm)`);
        queryParams.searchTerm = currentSearchTerm;
      }
      
      // Apply search conditions
      const searchConditionStr = searchConditions.join(' ');
      dataQuery += searchConditionStr;
      countQuery += searchConditionStr;

      dataQuery += ' ORDER BY created_at DESC LIMIT $limit START $start;';
      queryParams.limit = currentRowsPerPage;
      queryParams.start = currentPage * currentRowsPerPage;

      countQuery += ' GROUP ALL;';

      // Fetch paginated data with authentication check
      const dataResult: unknown = await dataService.queryWithAuth(dataQuery, queryParams);
      const fetchedData = Array.isArray(dataResult) ? dataResult as RawCreditorData[] : [];
      const formattedCreditors: Creditor[] = fetchedData.map((cred: RawCreditorData) => ({
        id: cred.id,
        name: cred.name,
        identifier: cred.legal_id,
        contact_person_name: cred.contact_person_name,
        contact_person_phone: cred.contact_phone,
        address: cred.contact_address,
        type: cred.type === 'organization' ? '组织' : '个人',
        case_id: cred.case_id,
        created_at: cred.created_at,
        updated_at: cred.updated_at,
        total_claim_amount: cred.total_claim_amount || 0,
        claim_count: cred.claim_count || 0,
      }));
      setCreditors(formattedCreditors);

      // Fetch total count with authentication check
      // Remove limit and start params for count query, keep all search-related params
      const countQueryParams: Record<string, unknown> = { caseId: selectedCaseId };
      
      // Copy search-related parameters for count query
      if (searchCriteria) {
        if (searchCriteria.useFullTextSearch && searchCriteria.fullTextSearch.trim()) {
          countQueryParams.fullTextQuery = queryParams.fullTextQuery;
        } else {
          // Copy field-specific search params
          if (queryParams.nameQuery) countQueryParams.nameQuery = queryParams.nameQuery;
          if (queryParams.identifierQuery) countQueryParams.identifierQuery = queryParams.identifierQuery;
          if (queryParams.contactPersonQuery) countQueryParams.contactPersonQuery = queryParams.contactPersonQuery;
          if (queryParams.contactPhoneQuery) countQueryParams.contactPhoneQuery = queryParams.contactPhoneQuery;
          if (queryParams.addressQuery) countQueryParams.addressQuery = queryParams.addressQuery;
        }
        // Copy filter params
        if (queryParams.typeFilter) countQueryParams.typeFilter = queryParams.typeFilter;
        if (queryParams.createdAfter) countQueryParams.createdAfter = queryParams.createdAfter;
        if (queryParams.createdBefore) countQueryParams.createdBefore = queryParams.createdBefore;
      } else if (currentSearchTerm && currentSearchTerm.trim() !== '') {
        countQueryParams.searchTerm = currentSearchTerm;
      }
      const countResult: unknown = await dataService.queryWithAuth(countQuery, countQueryParams);

      // SurrealDB's count() GROUP ALL returns an array with an object, e.g., [{ total: 50 }]
      // If no records, it might return an empty array or an array with an object where total is 0 or undefined.
      const total = Array.isArray(countResult) && countResult.length > 0 && countResult[0] && typeof (countResult[0] as CountResult).total === 'number'
                    ? (countResult[0] as CountResult).total
                    : 0;
      setTotalCreditors(total);

    } catch (err) {
      console.error("Error fetching creditors:", err);
      
      // Check if it's an authentication error
      if (err instanceof AuthenticationRequiredError) {
        // Redirect to login page
        navigate('/login');
        showError(err.message);
      } else {
        // Show general error message
        const errorMessage = t('error_fetching_creditors', '获取债权人列表失败。');
        setError(errorMessage);
        showError(errorMessage);
      }
      setCreditors([]); // Clear data on error
      setTotalCreditors(0); // Reset total on error
    } finally {
      setIsLoading(false);
    }
  }, [selectedCaseId, isDbConnected, t, dataService, navigate, showError]); // Updated dependencies

  useEffect(() => {
    // Reset page to 0 when debouncedSearchTerm changes
    setPage(0);
  }, [debouncedSearchTerm]);

  useEffect(() => {
    fetchCreditors(page, rowsPerPage, debouncedSearchTerm, currentSearchCriteria);
  }, [fetchCreditors, page, rowsPerPage, debouncedSearchTerm, currentSearchCriteria]);

  const handleChangePage = (_event: React.MouseEvent<HTMLButtonElement> | null, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0); // Reset to first page when rows per page changes
  };

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelecteds = creditors.map((n) => n.id); // Use creditors instead of filteredCreditors
      setSelectedCreditorIds(newSelecteds);
      return;
    }
    setSelectedCreditorIds([]);
  };

  const handleClick = (_event: React.MouseEvent<unknown>, id: RecordId | string) => {
    const selectedIndex = selectedCreditorIds.indexOf(id);
    let newSelected: (RecordId | string)[] = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selectedCreditorIds, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selectedCreditorIds.slice(1));
    } else if (selectedIndex === selectedCreditorIds.length - 1) {
      newSelected = newSelected.concat(selectedCreditorIds.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selectedCreditorIds.slice(0, selectedIndex),
        selectedCreditorIds.slice(selectedIndex + 1),
      );
    }
    setSelectedCreditorIds(newSelected);
  };

  const isSelected = (id: RecordId | string) => selectedCreditorIds.indexOf(id) !== -1;

  // filteredCreditors is removed, use 'creditors' directly from state which is now backend-filtered

  const handleOpenPrintWaybillsDialog = () => {
    if (selectedCreditorIds.length > 0) {
      setPrintWaybillsDialogOpen(true);
    }
  };
  
  const creditorsToPrint: Creditor[] = creditors.filter(c => selectedCreditorIds.includes(c.id)); // Use state variable 'creditors'

  // Handlers for AddCreditorDialog
  const handleOpenAddCreditorDialog = () => {
    setEditingCreditor(null); // Ensure we are in "add" mode
    setAddCreditorOpen(true);
  };

  const handleOpenEditCreditorDialog = (creditor: Creditor) => {
    setEditingCreditor(creditor);
    setAddCreditorOpen(true);
  };
  
  const handleCloseAddCreditorDialog = () => {
    setAddCreditorOpen(false);
    setEditingCreditor(null); // Clean up editing state
  };

  const handleSaveCreditor = async (dataToSave: CreditorFormData) => {
    if (dataToSave.id) { // Editing existing creditor
      if (!isDbConnected) {
        showError(t('database_not_connected', '数据库未连接'));
        return;
      }
      try {
        const dataForUpdate = {
          type: dataToSave.category === '组织' ? 'organization' : 'individual',
          name: dataToSave.name,
          legal_id: dataToSave.identifier,
          contact_person_name: dataToSave.contactPersonName,
          contact_phone: dataToSave.contactInfo,
          contact_address: dataToSave.address,
        };

        // dataToSave.id is the full record ID string like 'creditor:uuid'
        await dataService.mutateWithAuth('UPDATE $id MERGE $data;', {
          id: dataToSave.id,
          data: dataForUpdate
        });

        showSuccess(t('creditor_updated_success', '债权人已成功更新'));
        fetchCreditors(page, rowsPerPage, debouncedSearchTerm, currentSearchCriteria); // Refresh the list with current search criteria
        handleCloseAddCreditorDialog();
      } catch (err) {
        console.error("Error updating creditor:", err);
        
        // Check if it's an authentication error
        if (err instanceof AuthenticationRequiredError) {
          navigate('/login');
          showError(err.message);
        } else {
          showError(t('creditor_update_failed', '更新债权人失败'));
        }
      }
    } else { // Adding new creditor
      if (!selectedCaseId) {
        console.error("No case selected. Cannot create creditor.");
        showError(t('error_no_case_selected_for_creditor_add', '没有选择案件，无法添加债权人。'));
        return;
      }
      if (!isDbConnected) {
        console.error("Database not connected. Cannot create creditor.");
        showError(t('error_db_not_connected_for_creditor_add', '数据库未连接，无法添加债权人。'));
        return;
      }

      const newCreditorData = {
        case_id: selectedCaseId, // Ensure this is the full RecordId string, e.g., "case:xxxx"
        type: dataToSave.category === '组织' ? 'organization' : 'individual',
        name: dataToSave.name,
        legal_id: dataToSave.identifier,
        contact_person_name: dataToSave.contactPersonName,
        contact_phone: dataToSave.contactInfo,
        contact_address: dataToSave.address,
        created_by: user?.id, 
      };

      try {
        // Use dataService.create with authentication check
        const result = await dataService.queryWithAuth('CREATE creditor CONTENT $data', { data: newCreditorData });
        console.log("Creditor created successfully:", result);
        showSuccess(t('creditor_added_success', '债权人已成功添加'));
        fetchCreditors(page, rowsPerPage, debouncedSearchTerm, currentSearchCriteria); // Refresh the creditor list with current search criteria
        handleCloseAddCreditorDialog();
      } catch (err) { // ADDED opening brace
        console.error("Error creating creditor:", err);
        
        // Check if it's an authentication error
        if (err instanceof AuthenticationRequiredError) {
          navigate('/login');
          showError(err.message);
        } else {
          showError(t('creditor_add_failed', '添加债权人失败'));
        }
      } // ADDED closing brace
    }
  };

  // Handlers for BatchImportCreditorsDialog
  const handleOpenBatchImportDialog = () => {
    setBatchImportOpen(true);
  };

  const handleImportCreditors = (file: File) => {
    if (!selectedCaseId || !isDbConnected) {
      showError(t('import_error_no_case_or_db', '无法导入：未选择案件或数据库未连接。'));
      setBatchImportOpen(false);
      return;
    }

    setIsBatchProcessing(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        let successfulImports = 0;
        let failedImports = 0;
        const errors: string[] = [];

        // Assuming CSV headers are: 类别, 名称, ID/统一码, 联系人姓名, 联系方式, 地址
        // Match these with the actual headers in public/templates/creditor_import_template.csv
        const expectedHeaders = {
          type: '类别',
          name: '名称',
          identifier: 'ID/统一码',
          contact_person_name: '联系人姓名',
          contact_person_phone: '联系方式',
          address: '地址',
        };

        for (const row of results.data as CsvRowData[]) {
          if (!row[expectedHeaders.name] || !row[expectedHeaders.identifier] || !row[expectedHeaders.type]) {
            failedImports++;
            errors.push(t('import_error_missing_fields_row', '无效行数据 (缺少必填字段: 名称, ID/统一码, 类别): {{rowJson}}', {rowJson: JSON.stringify(row)}));
            continue;
          }

          const typeValue = row[expectedHeaders.type] as string;
          if (typeValue !== '组织' && typeValue !== '个人') {
            failedImports++;
            errors.push(t('import_error_invalid_type_row', '无效行数据 (类别必须是 "组织" 或 "个人"): {{rowJson}}', {rowJson: JSON.stringify(row)}));
            continue;
          }

          const creditorDataToCreate = {
            case_id: selectedCaseId,
            type: typeValue === '组织' ? 'organization' : 'individual',
            name: row[expectedHeaders.name],
            legal_id: row[expectedHeaders.identifier],
            contact_person_name: row[expectedHeaders.contact_person_name] || '',
            contact_phone: row[expectedHeaders.contact_person_phone] || '',
            contact_address: row[expectedHeaders.address] || '',
            created_by: user?.id, // Explicitly set created_by to current user's ID
          };

          try {
            await dataService.queryWithAuth('CREATE creditor CONTENT $data', { data: creditorDataToCreate });
            successfulImports++;
          } catch (err: unknown) {
            const error = err as Error;
            // Check if it's an authentication error
            if (err instanceof AuthenticationRequiredError) {
              // Authentication failed, stop import and redirect to login
              navigate('/login');
              showError(error.message);
              break;
            }
            
            failedImports++;
            console.error('Failed to import creditor row:', row, err);
            errors.push(t('import_error_db_error_row', '导入失败 (数据库错误) 行: {{rowJson}} - {{errorMessage}}', { rowJson: JSON.stringify(row), errorMessage: error.message }));
          }
        }

        setIsBatchProcessing(false);
        setBatchImportOpen(false); // Close dialog
        fetchCreditors(page, rowsPerPage, debouncedSearchTerm, currentSearchCriteria); // Refresh the main list with current search criteria

        if (failedImports > 0) {
          showError(t('batch_import_summary_with_errors',
            '批量导入部分完成：成功 {{successCount}} 条，失败 {{failureCount}} 条。详情请查看控制台。',
            { successCount: successfulImports, failureCount: failedImports }
          ));
          console.warn("Batch import errors:", errors);
        } else if (successfulImports > 0) {
          showSuccess(t('batch_import_summary_all_success',
            '批量导入成功：共导入 {{successCount}} 条记录。',
            { successCount: successfulImports }
          ));
        } else {
          showInfo(t('batch_import_summary_no_valid_rows', '批量导入：未找到有效数据行进行导入。'));
        }
      },
      error: (error: Error) => {
        console.error("CSV parsing error:", error);
        showError(t('csv_parse_error', 'CSV文件解析失败。'));
        setIsBatchProcessing(false);
        setBatchImportOpen(false);
      }
    });
  };

  // Delete handlers
  const handleOpenDeleteDialog = (creditor: Creditor) => {
    setCreditorToDelete(creditor);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setCreditorToDelete(null);
  };

  const handleConfirmDelete = async () => { // Make it async
    if (!creditorToDelete || !creditorToDelete.id) {
      console.error("No creditor selected for deletion.");
      showError(t('creditor_delete_failed_no_selection', '未选择要删除的债权人。'));
      handleCloseDeleteDialog(); // Close dialog as there's nothing to do
      return;
    }

    if (!isDbConnected) {
      showError(t('database_not_connected', '数据库未连接'));
      handleCloseDeleteDialog(); // Close dialog as action cannot be performed
      return;
    }

    try {
      // creditorToDelete.id is the full record ID, e.g., 'creditor:xyz'
      await dataService.mutateWithAuth('DELETE $id;', { id: creditorToDelete.id });

      showSuccess(t('creditor_deleted_success', '债权人已成功删除'));
      fetchCreditors(page, rowsPerPage, debouncedSearchTerm, currentSearchCriteria); // Refresh the list with current search criteria
    } catch (err) {
      console.error("Error deleting creditor:", err);
      
      // Check if it's an authentication error
      if (err instanceof AuthenticationRequiredError) {
        navigate('/login');
        showError(err.message);
      } else {
        showError(t('creditor_delete_failed', '删除债权人失败'));
      }
    } finally {
      handleCloseDeleteDialog(); // Close dialog regardless of success or failure
    }
  };

  // Advanced search handlers
  const handleOpenAdvancedSearch = () => {
    setAdvancedSearchOpen(true);
  };

  const handleCloseAdvancedSearch = () => {
    setAdvancedSearchOpen(false);
  };

  const handleAdvancedSearch = (criteria: AdvancedSearchCriteria) => {
    setCurrentSearchCriteria(criteria);
    setSearchTerm(''); // Clear simple search when using advanced search
    setPage(0); // Reset to first page for new search
  };

  const handleClearAdvancedSearch = () => {
    setCurrentSearchCriteria(null);
    setSearchTerm('');
    setPage(0);
  };

  // Check if advanced search is active
  const isAdvancedSearchActive = currentSearchCriteria !== null;

  // Creditor claims dialog handlers
  const handleOpenCreditorClaims = (creditor: Creditor) => {
    setSelectedCreditorForClaims(creditor);
    setClaimsDialogOpen(true);
  };

  const handleCloseCreditorClaims = () => {
    setClaimsDialogOpen(false);
    setSelectedCreditorForClaims(null);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>{t('creditor_list_page_title', '债权人管理')}</Typography>
      
      {/* 搜索区域 */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: isAdvancedSearchActive ? 2 : 0, flexWrap: 'wrap' }}>
          <TextField
            label={t('search_creditors_label', '搜索债权人')}
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={isAdvancedSearchActive}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SvgIcon fontSize="small"><path d={mdiMagnify} /></SvgIcon>
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: '300px', flexGrow: { xs:1, sm: 0.5, md:0.3 } }}
          />
          <Button
            variant={isAdvancedSearchActive ? "contained" : "outlined"}
            color={isAdvancedSearchActive ? "primary" : "inherit"}
            startIcon={<SvgIcon><path d={mdiFilterOutline} /></SvgIcon>}
            onClick={handleOpenAdvancedSearch}
            size="small"
          >
            {t('advanced_search_button', '高级搜索')}
          </Button>
          {isAdvancedSearchActive && (
            <Button
              variant="outlined"
              color="warning"
              onClick={handleClearAdvancedSearch}
              size="small"
            >
              {t('clear_search_button', '清除搜索')}
            </Button>
          )}
        </Box>
        
        {/* 当前搜索条件显示 */}
        {isAdvancedSearchActive && currentSearchCriteria && (
          <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              {t('current_search_conditions', '当前搜索条件')}:
            </Typography>
            <Box sx={{ mt: 1 }}>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {/* 全文搜索 */}
                {currentSearchCriteria.useFullTextSearch && currentSearchCriteria.fullTextSearch && (
                  <Chip
                    label={`全文搜索: "${currentSearchCriteria.fullTextSearch}"`}
                    size="small"
                    color="primary"
                    variant="filled"
                  />
                )}
                
                {/* 字段搜索 */}
                {!currentSearchCriteria.useFullTextSearch && (
                  <>
                    {currentSearchCriteria.name && (
                      <Chip label={`姓名: "${currentSearchCriteria.name}"`} size="small" variant="outlined" />
                    )}
                    {currentSearchCriteria.identifier && (
                      <Chip label={`证件号: "${currentSearchCriteria.identifier}"`} size="small" variant="outlined" />
                    )}
                    {currentSearchCriteria.contactPersonName && (
                      <Chip label={`联系人: "${currentSearchCriteria.contactPersonName}"`} size="small" variant="outlined" />
                    )}
                    {currentSearchCriteria.contactPhone && (
                      <Chip label={`电话: "${currentSearchCriteria.contactPhone}"`} size="small" variant="outlined" />
                    )}
                    {currentSearchCriteria.address && (
                      <Chip label={`地址: "${currentSearchCriteria.address}"`} size="small" variant="outlined" />
                    )}
                  </>
                )}
                
                {/* 筛选条件 */}
                {currentSearchCriteria.type !== 'all' && (
                  <Chip 
                    label={`类型: ${currentSearchCriteria.type === 'organization' ? '组织' : '个人'}`} 
                    size="small" 
                    color="secondary" 
                    variant="outlined" 
                  />
                )}
                
                {(currentSearchCriteria.minClaimAmount || currentSearchCriteria.maxClaimAmount) && (
                  <Chip 
                    label={`债权金额: ${currentSearchCriteria.minClaimAmount ? `≥${currentSearchCriteria.minClaimAmount}元` : ''}${currentSearchCriteria.minClaimAmount && currentSearchCriteria.maxClaimAmount ? ' 且 ' : ''}${currentSearchCriteria.maxClaimAmount ? `≤${currentSearchCriteria.maxClaimAmount}元` : ''}`}
                    size="small" 
                    color="info" 
                    variant="outlined" 
                  />
                )}
                
                {(currentSearchCriteria.createdAfter || currentSearchCriteria.createdBefore) && (
                  <Chip 
                    label={`创建时间: ${currentSearchCriteria.createdAfter ? currentSearchCriteria.createdAfter.toLocaleDateString() : ''}${currentSearchCriteria.createdAfter && currentSearchCriteria.createdBefore ? ' 至 ' : ''}${currentSearchCriteria.createdBefore ? currentSearchCriteria.createdBefore.toLocaleDateString() : ''}`}
                    size="small" 
                    color="warning" 
                    variant="outlined" 
                  />
                )}
              </Stack>
            </Box>
          </Box>
        )}
      </Box>

      {/* 操作按钮区域 */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Stack direction="row" spacing={1} sx={{flexWrap: 'wrap', gap:1}}> {/* Allow buttons to wrap and add gap */}
          {canCreate && (
            <Button variant="contained" color="primary" startIcon={<SvgIcon><path d={mdiAccountPlusOutline} /></SvgIcon>} onClick={handleOpenAddCreditorDialog}>
              {t('add_single_creditor_button', '添加单个债权人')}
            </Button>
          )}
          {canBatchImport && (
            <Button variant="outlined" color="secondary" startIcon={<SvgIcon><path d={mdiFileImportOutline} /></SvgIcon>} onClick={handleOpenBatchImportDialog}>
              {t('batch_import_creditors_button', '批量导入债权人')}
            </Button>
          )}
          {canPrintWaybill && selectedCreditorIds.length > 0 && (
            <Button
              variant="contained" 
              color="secondary" 
              startIcon={<SvgIcon><path d={mdiPrinterOutline} /></SvgIcon>}
              onClick={handleOpenPrintWaybillsDialog}
              disabled={!canManageCreditors || selectedCreditorIds.length === 0}
            >
              {t('print_waybill_button', '打印快递单号')} ({selectedCreditorIds.length})
            </Button>
          )}
        </Stack>
      </Box>
      
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
          <Table stickyHeader aria-label="creditor list table" size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    color="primary"
                    indeterminate={selectedCreditorIds.length > 0 && selectedCreditorIds.length < creditors.length}
                    checked={creditors.length > 0 && selectedCreditorIds.length === creditors.length}
                    onChange={handleSelectAllClick}
                    inputProps={{ 'aria-label': t('select_all_creditors_aria_label', 'select all creditors') }}
                  />
                </TableCell>
                <TableCell sx={{whiteSpace: 'nowrap'}}>{t('table_header_no', '序号')}</TableCell>
                <TableCell sx={{whiteSpace: 'nowrap'}}>{t('table_header_type', '类别')}</TableCell>
                <TableCell sx={{whiteSpace: 'nowrap'}}>{t('table_header_name', '姓名/名称')}</TableCell>
                <TableCell sx={{whiteSpace: 'nowrap'}}>{t('table_header_identifier', 'ID/统一码')}</TableCell>
                <TableCell sx={{whiteSpace: 'nowrap'}}>{t('table_header_contact_person', '联系人')}</TableCell>
                <TableCell sx={{whiteSpace: 'nowrap'}}>{t('table_header_contact_phone', '联系方式')}</TableCell>
                <TableCell sx={{whiteSpace: 'nowrap'}}>{t('table_header_address', '地址')}</TableCell>
                <TableCell align="right" sx={{whiteSpace: 'nowrap'}}>{t('table_header_claim_amount', '债权金额')}</TableCell>
                <TableCell align="center" sx={{whiteSpace: 'nowrap'}}>{t('table_header_claim_count', '债权数量')}</TableCell>
                <TableCell align="center" sx={{whiteSpace: 'nowrap'}}>{t('table_header_actions', '操作')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} align="center" sx={{ py: 3 }}>
                    <CircularProgress />
                    <Typography sx={{ mt: 1 }}>{t('loading_creditors', '正在加载债权人数据...')}</Typography>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={11} align="center" sx={{ py: 3 }}>
                    <Alert severity="error" sx={{ justifyContent: 'center' }}>{error}</Alert>
                  </TableCell>
                </TableRow>
              ) : creditors.length === 0 ? ( // Use creditors instead of filteredCreditors
                <TableRow><TableCell colSpan={11} align="center"><Typography sx={{p:2}}>{debouncedSearchTerm ? t('no_matching_creditors_found', '没有找到匹配的债权人') : t('no_creditors_found', '暂无债权人数据')}</Typography></TableCell></TableRow>
              ) : (
                creditors.map((creditor, index) => { // Use creditors instead of filteredCreditors
                  const isItemSelected = isSelected(creditor.id);
                const labelId = `creditor-table-checkbox-${index}`;
                return (
                  <TableRow 
                    hover 
                    onClick={(event) => handleClick(event, creditor.id)}
                    role="checkbox"
                    aria-checked={isItemSelected}
                    tabIndex={-1}
                    key={creditor.id.toString()}
                    selected={isItemSelected}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        color="primary"
                        checked={isItemSelected}
                        inputProps={{ 'aria-labelledby': labelId }}
                      />
                    </TableCell>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{creditor.type}</TableCell>
                    <TableCell component="th" id={labelId} scope="row">{creditor.name}</TableCell>
                    <TableCell>{creditor.identifier}</TableCell>
                    <TableCell>{creditor.contact_person_name}</TableCell>
                    <TableCell>{creditor.contact_person_phone}</TableCell>
                    <TableCell>{creditor.address}</TableCell>
                    <TableCell align="right">
                      {creditor.total_claim_amount ? 
                        `¥${creditor.total_claim_amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 
                        '¥0.00'
                      }
                    </TableCell>
                    <TableCell 
                      align="center" 
                      sx={{ 
                        cursor: creditor.claim_count && creditor.claim_count > 0 ? 'pointer' : 'default',
                        color: creditor.claim_count && creditor.claim_count > 0 ? 'primary.main' : 'text.primary',
                        textDecoration: creditor.claim_count && creditor.claim_count > 0 ? 'underline' : 'none',
                        '&:hover': creditor.claim_count && creditor.claim_count > 0 ? { 
                          backgroundColor: 'action.hover' 
                        } : {}
                      }}
                      onClick={creditor.claim_count && creditor.claim_count > 0 ? (e) => {
                        e.stopPropagation();
                        handleOpenCreditorClaims(creditor);
                      } : undefined}
                      title={creditor.claim_count && creditor.claim_count > 0 ? t('click_to_view_claims', '点击查看债权详情') : undefined}
                    >
                      {creditor.claim_count || 0}
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0} justifyContent="center">
                        {canEdit && (
                          <Tooltip title={t('edit_creditor_tooltip', '编辑')}>
                            <IconButton
                              color="primary"
                              size="small"
                              aria-label="edit creditor"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditCreditorDialog(creditor);
                              }}
                            >
                              <SvgIcon fontSize="small"><path d={mdiPencilOutline} /></SvgIcon>
                            </IconButton>
                          </Tooltip>
                        )}
                        {canDelete && (
                          <Tooltip title={t('delete_creditor_tooltip', '删除')}>
                            <IconButton
                              color="error"
                              size="small"
                              aria-label="delete creditor"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDeleteDialog(creditor);
                              }}
                            >
                              <SvgIcon fontSize="small"><path d={mdiDeleteOutline} /></SvgIcon>
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              }))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={totalCreditors}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[5, 10, 25, 50]} // Standard options
          labelRowsPerPage={t('table_pagination_rows_per_page', '每页行数:')}
          labelDisplayedRows={({ from, to, count }) =>
            t('table_pagination_displayed_rows', `第 ${from} 到 ${to} 条 / 共 ${count !== -1 ? count : `超过 ${to}`} 条`, { from, to, count})
          }
          backIconButtonProps={{
            'aria-label': t('table_pagination_previous_page_aria_label', '上一页'),
          }}
          nextIconButtonProps={{
            'aria-label': t('table_pagination_next_page_aria_label', '下一页'),
          }}
        />
      </Paper>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
        {t('creditor_list_footer_note_1', '债权人管理页面。当案件处于立案阶段且用户有权限时，将自动进入此菜单。')}
        {t('creditor_list_footer_note_2', '支持录入债权人信息和打印快递单号。')}
      </Typography>
      
      <PrintWaybillsDialog
        open={printWaybillsDialogOpen}
        onClose={() => setPrintWaybillsDialogOpen(false)}
        selectedCreditors={creditorsToPrint}
      />
      <AddCreditorDialog
        open={addCreditorOpen}
        onClose={handleCloseAddCreditorDialog}
        onSave={handleSaveCreditor}
        existingCreditor={editingCreditor}
      />
      <BatchImportCreditorsDialog
        open={batchImportOpen}
        onClose={() => setBatchImportOpen(false)}
        onImport={handleImportCreditors}
        isImporting={isBatchProcessing} // Pass isBatchProcessing state
      />
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
        title={t('delete_creditor_dialog_title', '确认删除债权人')}
        contentText={
          creditorToDelete 
            ? t('delete_creditor_dialog_content', `您确定要删除债权人 "${creditorToDelete.name}" 吗？此操作不可撤销。`)
            : ''
        }
      />
      <AdvancedSearchDialog
        open={advancedSearchOpen}
        onClose={handleCloseAdvancedSearch}
        onSearch={handleAdvancedSearch}
        onClear={handleClearAdvancedSearch}
        initialCriteria={currentSearchCriteria || undefined}
      />
      <CreditorClaimsDialog
        open={claimsDialogOpen}
        onClose={handleCloseCreditorClaims}
        creditor={selectedCreditorForClaims}
      />
    </Box>
  );
};

export default CreditorListPage;
