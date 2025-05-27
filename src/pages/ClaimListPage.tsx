import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // Added useNavigate
import { useSnackbar } from '../../contexts/SnackbarContext'; // Assuming path

// Placeholder SVG icons (simple versions)
const MagnifyIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>;
const PlusCircleIcon = () => <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>;
const CloseCircleIcon = () => <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>;
const PencilIcon = () => <svg className="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>;
const EyeIcon = () => <svg className="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>;


interface Claim {
  id: string;
  creditorName: string;
  creditorType: '组织' | '个人'; // For "债权人 (类别)"
  claim_number: string;
  asserted_total: number;
  approved_total: number | null;
  auditor: string;
  audit_status: '待审核' | '部分通过' | '已驳回' | '审核通过'; // Added '审核通过'
  audit_time: string;
}

const initialMockClaims: Claim[] = [
  { id: 'claim001', creditorName: 'Acme Corp', creditorType: '组织', claim_number: 'CL-2023-001', asserted_total: 150000, approved_total: 145000, auditor: 'Reviewer A', audit_status: '部分通过', audit_time: '2023-04-10' },
  { id: 'claim002', creditorName: 'Jane Smith', creditorType: '个人', claim_number: 'CL-2023-002', asserted_total: 75000, approved_total: 0, auditor: 'Reviewer B', audit_status: '已驳回', audit_time: '2023-04-12' },
  { id: 'claim003', creditorName: 'Beta LLC', creditorType: '组织', claim_number: 'CL-2023-003', asserted_total: 220000, approved_total: null, auditor: '', audit_status: '待审核', audit_time: '' },
  { id: 'claim004', creditorName: 'Gamma Inc', creditorType: '组织', claim_number: 'CL-2023-004', asserted_total: 50000, approved_total: 50000, auditor: 'Reviewer C', audit_status: '审核通过', audit_time: '2023-05-15' },
  { id: 'claim005', creditorName: 'John Doe', creditorType: '个人', claim_number: 'CL-2023-005', asserted_total: 10000, approved_total: null, auditor: '', audit_status: '待审核', audit_time: '' },
];

const ClaimListPage: React.FC = () => {
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();
  const [claims, setClaims] = useState<Claim[]>(initialMockClaims);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Modal State
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectReasonError, setRejectReasonError] = useState('');

  // Use a state for claims to make it updatable
  const [claimsData, setClaimsData] = useState<Claim[]>(initialMockClaims);

  const filteredClaims = useMemo(() => {
    let currentClaims = [...claimsData]; // Use claimsData state here
    if (searchTerm) {
      currentClaims = currentClaims.filter(claim =>
        claim.creditorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        claim.claim_number.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filterStatus) {
      currentClaims = currentClaims.filter(claim => claim.audit_status === filterStatus);
    }
    return currentClaims;
  }, [claimsData, searchTerm, filterStatus]); // Add claimsData to dependency array
  
  useEffect(() => {
    setSelected([]);
  }, [searchTerm, filterStatus]);

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelecteds = filteredClaims.map((n) => n.id);
      setSelected(newSelecteds);
      return;
    }
    setSelected([]);
  };

  const handleClick = (event: React.MouseEvent<unknown>, id: string) => {
    const selectedIndex = selected.indexOf(id);
    let newSelected: readonly string[] = [];
    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selected, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selected.slice(1));
    } else if (selectedIndex === selected.length - 1) {
      newSelected = newSelected.concat(selected.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(selected.slice(0, selectedIndex), selected.slice(selectedIndex + 1));
    }
    setSelected(newSelected);
  };

  const isSelected = (id: string) => selected.indexOf(id) !== -1;

  const getStatusBadgeStyle = (status: Claim['audit_status']) => {
    switch (status) {
      case '待审核': return 'bg-blue-100 text-blue-800 dark:bg-blue-700 dark:text-blue-200';
      case '部分通过': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-200';
      case '已驳回': return 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-200';
      case '审核通过': return 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const handleOpenRejectModal = () => {
    if (selected.length === 0) {
      showSnackbar('没有选中任何债权。', 'warning');
      return;
    }
    // Check if any selected claims are not in '待审核' status, as typically only those can be rejected.
    // This logic can be adjusted based on specific business rules.
    const nonRejectableClaim = filteredClaims.find(claim => selected.includes(claim.id) && claim.audit_status !== '待审核' && claim.audit_status !== '部分通过' && claim.audit_status !== '审核通过'); // Allow rejection for already reviewed claims to change status
    if (nonRejectableClaim && (nonRejectableClaim.audit_status === '已驳回')) {
       showSnackbar(`债权 ${nonRejectableClaim.claim_number} 已是“已驳回”状态，无需再次驳回。`, 'warning');
       // return; // Or allow re-rejection with new reason
    }

    setRejectionReason('');
    setRejectReasonError('');
    setShowRejectModal(true);
  };

  const handleConfirmBatchReject = () => {
    if (!rejectionReason.trim()) {
      setRejectReasonError('驳回原因不能为空。');
      return;
    }
    setRejectReasonError('');

    setClaimsData(prevClaims =>
      prevClaims.map(claim =>
        selected.includes(claim.id)
          ? { ...claim, audit_status: '已驳回', reviewOpinion: rejectionReason, auditor: 'AdminUser', audit_time: new Date().toISOString().split('T')[0] } // Simulate auditor and time
          : claim
      )
    );

    showSnackbar(`${selected.length} 个债权已批量驳回。`, 'success');
    setShowRejectModal(false);
    setSelected([]);
    setRejectionReason('');
  };
  
  const commonInputClass = "block w-full sm:w-auto text-sm dark:text-gray-300 dark:border-gray-600 dark:bg-gray-700 form-input focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 rounded-md shadow-sm";
  const commonButtonClass = "inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800";
  const primaryButtonClass = `${commonButtonClass} bg-blue-600 hover:bg-blue-700 focus:ring-blue-500`;
  const secondaryButtonClass = `${commonButtonClass} bg-red-600 hover:bg-red-700 focus:ring-red-500 disabled:opacity-50`;
  const outlineButtonClass = "inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800";


  return (
    <div className="p-4 sm:p-6 bg-gray-100 dark:bg-gray-900 min-h-screen">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white mb-6">
        债权申报与审核 (管理员)
      </h1>

      <div className="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="搜索债权人/编号..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`${commonInputClass} flex-grow`}
          />
           <button type="button" className={`${outlineButtonClass} px-3 py-2`}><MagnifyIcon /></button>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={`${commonInputClass}`}
          >
            <option value="">所有状态</option>
            <option value="待审核">待审核</option>
            <option value="部分通过">部分通过</option>
            <option value="已驳回">已驳回</option>
            <option value="审核通过">审核通过</option>
          </select>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mt-2 sm:mt-0">
          <button
            onClick={() => navigate('/claims/submit')} // Admin might use the same creation form or a specific one
            className={`${primaryButtonClass} w-full sm:w-auto`}
          >
            <PlusCircleIcon /> 创建债权
          </button>
          <button
            onClick={handleOpenRejectModal} // Updated handler
            className={`${secondaryButtonClass} w-full sm:w-auto`}
            disabled={selected.length === 0}
          >
            <CloseCircleIcon /> 批量驳回
          </button>
        </div>
      </div>
      
      {/* Main Table */}
      <div className="bg-white dark:bg-gray-800 shadow-md sm:rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    className="form-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-offset-gray-800"
                    indeterminate={selected.length > 0 && selected.length < filteredClaims.length}
                    checked={filteredClaims.length > 0 && selected.length === filteredClaims.length}
                    onChange={handleSelectAllClick}
                    aria-label="select all claims"
                  />
                </th>
                {['债权人 (类别)', '债权编号', '主张债权总额', '认定债权总额', '审核状态', '审核人', '审核时间', '操作'].map(header => (
                  <th key={header} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredClaims.length === 0 && (
                <tr><td colSpan={9} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">暂无匹配的债权数据</td></tr>
              )}
              {filteredClaims.map((claim) => {
                const isItemSelected = isSelected(claim.id);
                return (
                  <tr 
                    key={claim.id} 
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150 ${isItemSelected ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
                    onClick={(event) => {
                      // Prevent row click if clicking on a button/link inside the row
                      if ((event.target as HTMLElement).closest('button, a')) return;
                      handleClick(event, claim.id);
                    }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        className="form-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-offset-gray-800"
                        checked={isItemSelected}
                        onChange={(event) => handleClick(event, claim.id)} // This allows checkbox click to also select
                        aria-labelledby={`claim-checkbox-${claim.id}`}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{claim.creditorName} ({claim.creditorType})</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{claim.claim_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300">{claim.asserted_total.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300">{claim.approved_total !== null ? claim.approved_total.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' }) : '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeStyle(claim.audit_status)}`}>
                        {claim.audit_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{claim.auditor || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{claim.audit_time || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link
                        to={`/admin/claims/${claim.id}/review`} // Corrected path
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 inline-flex items-center"
                        onClick={(e) => e.stopPropagation()} // Prevent row click
                      >
                        {claim.audit_status === '待审核' ? <PencilIcon /> : <EyeIcon />}
                        {claim.audit_status === '待审核' ? '审核债权' : '查看详情'}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        此页面供管理员审核债权申报。支持创建、批量驳回、搜索和筛选功能。
      </p>

      {/* Batch Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 transition-opacity duration-300 ease-in-out">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md mx-4 sm:mx-auto transform transition-all duration-300 ease-in-out scale-100">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              批量驳回原因
            </h3>
            <textarea
              value={rejectionReason}
              onChange={(e) => {
                setRejectionReason(e.target.value);
                if (e.target.value.trim()) setRejectReasonError('');
              }}
              rows={4}
              placeholder="请输入驳回原因..."
              className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 ${rejectReasonError ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
            ></textarea>
            {rejectReasonError && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{rejectReasonError}</p>}
            <div className="mt-6 flex flex-col sm:flex-row sm:justify-end sm:space-x-3 space-y-2 sm:space-y-0">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className={`${outlineButtonClass} w-full sm:w-auto justify-center`}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmBatchReject}
                className={`${primaryButtonClass} bg-red-600 hover:bg-red-700 focus:ring-red-500 w-full sm:w-auto justify-center`}
              >
                确认驳回 ({selected.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClaimListPage;
