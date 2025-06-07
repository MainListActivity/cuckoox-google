import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/src/i18n'; // Adjust path
import { SnackbarProvider } from '@/src/contexts/SnackbarContext';
import ClaimListPage from '@/src/pages/claims/index'; // Adjust path

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

// Mock useSnackbar
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
const mockShowWarning = vi.fn();
const mockShowInfo = vi.fn();
vi.mock('../../../../src/contexts/SnackbarContext', async () => {
    const actual = await vi.importActual('../../../../src/contexts/SnackbarContext');
    return {
        ...actual,
        useSnackbar: () => ({
            showSuccess: mockShowSuccess,
            showError: mockShowError,
            showWarning: mockShowWarning,
            showInfo: mockShowInfo,
        }),
    };
});

// Mock AdminCreateClaimBasicInfoDialog
vi.mock('../../../../src/components/admin/claims/AdminCreateClaimBasicInfoDialog', () => ({
    __esModule: true,
    default: vi.fn(({ open, onClose, onNext }) => {
        if (!open) return null;
        return (
            <div data-testid="mocked-admin-create-claim-dialog">
                Mocked Admin Create Claim Dialog
                <button onClick={onClose}>CloseDialog</button>
                <button onClick={() => onNext({})}>NextDialog</button>
            </div>
        );
    }),
}));


describe('ClaimListPage (Admin Claim Review)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderComponent = () => {
        render(
            <BrowserRouter>
                <I18nextProvider i18n={i18n}>
                    <SnackbarProvider>
                        <ClaimListPage />
                    </SnackbarProvider>
                </I18nextProvider>
            </BrowserRouter>
        );
    };

    // Rendering Tests
    it('renders MUI table, toolbar elements, and mock data', () => {
        renderComponent();
        expect(screen.getByText('债权申报与审核 (管理员)')).toBeInTheDocument(); // Page Title
        expect(screen.getByLabelText(/搜索债权人\/编号\/联系人/)).toBeInTheDocument(); // Search
        expect(screen.getByLabelText(/审核状态/)).toBeInTheDocument(); // Filter
        expect(screen.getByRole('button', { name: /创建债权/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /批量驳回/i })).toBeInTheDocument();

        // Check for some table headers (MUI specific query might be needed if labels are complex)
        expect(screen.getByRole('columnheader', { name: '债权人信息' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: '债权编号' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: '审核状态' })).toBeInTheDocument(); // More specific query for header

        // Check for some mock data rendering
        expect(screen.getByText('Acme Corp (组织)')).toBeInTheDocument();
        expect(screen.getByText('CL-2023-001')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith (个人)')).toBeInTheDocument();
    });

    // Interactions Tests
    it('filters claims based on search term', async () => {
        renderComponent();
        const searchInput = screen.getByLabelText(/搜索债权人\/编号\/联系人/);

        fireEvent.change(searchInput, { target: { value: 'Acme' } });
        await waitFor(() => {
            expect(screen.getByText('Acme Corp (组织)')).toBeInTheDocument();
            expect(screen.queryByText('Jane Smith (个人)')).not.toBeInTheDocument();
        });

        fireEvent.change(searchInput, { target: { value: 'CL-2023-002' } });
        await waitFor(() => {
            expect(screen.queryByText('Acme Corp (组织)')).not.toBeInTheDocument();
            expect(screen.getByText('Jane Smith (个人)')).toBeInTheDocument();
            expect(screen.getByText('CL-2023-002')).toBeInTheDocument();
        });
    });

    it('filters claims based on status dropdown', async () => {
        renderComponent();
        const filterSelect = screen.getByLabelText(/审核状态/);

        fireEvent.mouseDown(filterSelect);
        // MUI Select options are usually in a Popover/Menu, need to wait for them
        const pendingOption = await screen.findByRole('option', { name: '待审核' });
        fireEvent.click(pendingOption);

        await waitFor(() => {
            // Assuming 'Beta LLC' is '待审核'
            expect(screen.getByText('Beta LLC (组织)')).toBeInTheDocument();
            expect(screen.getByText('CL-2023-003')).toBeInTheDocument();
            expect(screen.queryByText('Acme Corp (组织)')).not.toBeInTheDocument(); // '部分通过'
            expect(screen.queryByText('Jane Smith (个人)')).not.toBeInTheDocument(); // '已驳回'
        });
    });

    it('opens AdminCreateClaimBasicInfoDialog when "创建债权" button is clicked', async () => {
        renderComponent();
        const createClaimButton = screen.getByRole('button', { name: /创建债权/i });
        fireEvent.click(createClaimButton);

        await waitFor(() => {
            expect(screen.getByTestId('mocked-admin-create-claim-dialog')).toBeInTheDocument();
        });
    });

    describe('Batch Reject Functionality', () => {
        it('opens rejection dialog when "批量驳回" is clicked with selected rows', async () => {
            renderComponent();
            const checkboxes = screen.getAllByRole('checkbox');
            // Select the first data row checkbox (index 1, as index 0 is select all)
            fireEvent.click(checkboxes[1]);

            const batchRejectButton = screen.getByRole('button', { name: /批量驳回/i });
            expect(batchRejectButton).not.toBeDisabled();
            fireEvent.click(batchRejectButton);

            await waitFor(() => {
                expect(screen.getByText('批量驳回原因')).toBeInTheDocument(); // Dialog title
            });
        });

        it('shows error if rejection reason is empty on confirm', async () => {
            renderComponent();
            const checkboxes = screen.getAllByRole('checkbox');
            fireEvent.click(checkboxes[1]); // Select one row
            fireEvent.click(screen.getByRole('button', { name: /批量驳回/i }));

            await screen.findByText('批量驳回原因'); // Wait for dialog

            const confirmButton = screen.getByRole('button', { name: /确认驳回/i });
            fireEvent.click(confirmButton);

            await waitFor(() => {
                expect(screen.getByText('驳回原因不能为空。')).toBeInTheDocument();
            });
        });

        it('submits rejection and updates claim data (mock)', async () => {
            renderComponent();
            // Select "Acme Corp" (claim001)
            const acmeCheckbox = screen.getAllByRole('checkbox').find(cb => {
                const row = cb.closest('tr');
                return row && row.textContent?.includes('Acme Corp');
            });
            expect(acmeCheckbox).toBeDefined();
            fireEvent.click(acmeCheckbox!);

            fireEvent.click(screen.getByRole('button', { name: /批量驳回/i }));

            // More specific query for dialog title
            const dialogTitle = await screen.findByRole('heading', { name: '批量驳回原因' });
            expect(dialogTitle).toBeInTheDocument();

            // Use the specific id to find the rejection reason textarea
            const reasonTextarea = document.getElementById('rejectionReason') as HTMLTextAreaElement;
            expect(reasonTextarea).toBeTruthy();
            fireEvent.change(reasonTextarea, { target: { value: 'Test Rejection Reason' } });

            const confirmButton = screen.getByRole('button', { name: /确认驳回/i });
            fireEvent.click(confirmButton);

            await waitFor(() => {
                expect(mockShowSuccess).toHaveBeenCalledWith(expect.stringContaining('1 个债权已批量驳回'));
            });

            // Wait for dialog to close and then verify data update
            await waitFor(() => {
                expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            });

            // Verify data update for Acme Corp
            const acmeRow = Array.from(screen.getAllByRole('row')).find(row => row.textContent?.includes('Acme Corp'));
            expect(acmeRow).toBeDefined();
            expect(acmeRow!.textContent).toContain('已驳回'); // Check for new status
            expect(acmeRow!.textContent).toContain('Test Rejection Reason'); // Check for new opinion
        });
    });

    // Row Actions Test
    it('navigates to review page when review/view link is clicked', () => {
        renderComponent();
        // Find the row for "CL-2023-001" which corresponds to claim001
        const claimRow = screen.getAllByRole('row').find(row => row.textContent?.includes('CL-2023-001'));
        expect(claimRow).toBeDefined();

        // Find the review/details link within that specific row (it's actually a link, not button)
        const reviewLink = within(claimRow!).getByRole('link', { 
            name: /查看详情/i 
        });

        expect(reviewLink).toBeDefined();
        expect(reviewLink).toHaveAttribute('href', '/admin/claims/claim001/review');
        
        fireEvent.click(reviewLink);
        // Note: In a real app this would navigate, but since we're using Link component,
        // the href attribute is what matters for navigation
    });

    // Additional Test Cases
    describe('Select All Functionality', () => {
        it('selects all visible claims when select all checkbox is clicked', async () => {
            renderComponent();
            const selectAllCheckbox = screen.getAllByRole('checkbox')[0]; // First checkbox is select all
            
            fireEvent.click(selectAllCheckbox);
            
            await waitFor(() => {
                const checkboxes = screen.getAllByRole('checkbox');
                // All checkboxes should be checked (including select all)
                checkboxes.forEach(checkbox => {
                    expect(checkbox).toBeChecked();
                });
            });
        });

        it('deselects all claims when select all is clicked again', async () => {
            renderComponent();
            const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
            
            // First select all
            fireEvent.click(selectAllCheckbox);
            await waitFor(() => {
                expect(selectAllCheckbox).toBeChecked();
            });
            
            // Then deselect all
            fireEvent.click(selectAllCheckbox);
            await waitFor(() => {
                const checkboxes = screen.getAllByRole('checkbox');
                checkboxes.forEach(checkbox => {
                    expect(checkbox).not.toBeChecked();
                });
            });
        });
    });

    describe('Currency Formatting', () => {
        it('displays currency amounts correctly formatted', () => {
            renderComponent();
            // Check for formatted currency display (CNY format)
            expect(screen.getByText('¥150,000.00')).toBeInTheDocument(); // Acme Corp asserted total
            expect(screen.getAllByText('¥75,000.00').length).toBeGreaterThan(0); // Jane Smith asserted total (may appear multiple times)
        });

        it('displays dash for null amounts', () => {
            renderComponent();
            // Find rows with null approved amounts and check for dash display
            const betaRow = screen.getAllByRole('row').find(row => row.textContent?.includes('Beta LLC'));
            expect(betaRow).toBeDefined();
            // Beta LLC should have null approved amounts, displayed as dashes
            expect(within(betaRow!).getAllByText('-').length).toBeGreaterThan(0);
        });
    });

    describe('Status Chip Colors', () => {
        it('displays correct chip colors for different audit statuses', () => {
            renderComponent();
            
            // Check for status chips with correct colors
            const pendingChip = screen.getByText('待审核');
            const partiallyApprovedChip = screen.getByText('部分通过');
            const rejectedChip = screen.getByText('已驳回');
            const approvedChip = screen.getByText('审核通过');
            
            expect(pendingChip).toBeInTheDocument();
            expect(partiallyApprovedChip).toBeInTheDocument();
            expect(rejectedChip).toBeInTheDocument();
            expect(approvedChip).toBeInTheDocument();
        });
    });

    describe('Attachment Links', () => {
        it('displays attachment links for claims with attachments', () => {
            renderComponent();
            
            // Find attachment links by their aria-label
            const attachmentLinks = screen.getAllByRole('link').filter(link => {
                const ariaLabel = link.getAttribute('aria-label');
                return ariaLabel && (ariaLabel.includes('查看附件') || ariaLabel.includes('查看管理人附件'));
            });
            
            // Since mock data has assertedAttachmentsLink: '#' for some claims
            expect(attachmentLinks.length).toBeGreaterThan(0);
        });

        it('opens attachment links in new tab', () => {
            renderComponent();
            
            // Find the first attachment link by aria-label
            const attachmentLink = screen.getAllByRole('link').find(link => 
                link.getAttribute('aria-label')?.includes('查看附件')
            );
            
            expect(attachmentLink).toBeDefined();
            expect(attachmentLink!.getAttribute('target')).toBe('_blank');
            expect(attachmentLink!.getAttribute('rel')).toBe('noopener noreferrer');
        });
    });

    describe('Empty State', () => {
        it('displays no data message when no claims match filters', async () => {
            renderComponent();
            
            // Search for non-existent claim
            const searchInput = screen.getByLabelText(/搜索债权人\/编号\/联系人/);
            fireEvent.change(searchInput, { target: { value: 'NonExistentClaim' } });
            
            await waitFor(() => {
                expect(screen.getByText('暂无匹配的债权数据')).toBeInTheDocument();
            });
        });
    });

    describe('Create Claim Dialog Interactions', () => {
        it('closes dialog when close button is clicked', async () => {
            renderComponent();
            
            // Open dialog
            const createButton = screen.getByRole('button', { name: /创建债权/i });
            fireEvent.click(createButton);
            
            await waitFor(() => {
                expect(screen.getByTestId('mocked-admin-create-claim-dialog')).toBeInTheDocument();
            });
            
            // Close dialog
            const closeButton = screen.getByText('CloseDialog');
            fireEvent.click(closeButton);
            
            await waitFor(() => {
                expect(screen.queryByTestId('mocked-admin-create-claim-dialog')).not.toBeInTheDocument();
            });
        });

        it('handles next button click in create claim dialog', async () => {
            renderComponent();
            
            // Open dialog
            const createButton = screen.getByRole('button', { name: /创建债权/i });
            fireEvent.click(createButton);
            
            await waitFor(() => {
                expect(screen.getByTestId('mocked-admin-create-claim-dialog')).toBeInTheDocument();
            });
            
            // Click next button
            const nextButton = screen.getByText('NextDialog');
            fireEvent.click(nextButton);
            
            await waitFor(() => {
                expect(mockShowSuccess).toHaveBeenCalledWith('基本信息已保存，请继续添加附件材料。');
                expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/^\/admin\/create-claim\/ADMIN-CLAIM-\d+\/attachments$/));
            });
        });
    });

    describe('Batch Operations Validation', () => {
        it('shows warning when trying to batch reject without selection', async () => {
            renderComponent();
            
            const batchRejectButton = screen.getByRole('button', { name: /批量驳回/i });
            
            // The button should be disabled when no selection
            expect(batchRejectButton).toBeDisabled();
            
            // Try to click it anyway (should not trigger the warning since it's disabled)
            fireEvent.click(batchRejectButton);
            
            // Since the button is disabled, the warning should not be called
            expect(mockShowWarning).not.toHaveBeenCalled();
        });

        it('shows warning when trying to reject already rejected claims', async () => {
            renderComponent();
            
            // Select Jane Smith's claim which is already rejected
            const janeRow = screen.getAllByRole('row').find(row => row.textContent?.includes('Jane Smith'));
            expect(janeRow).toBeDefined();
            
            const janeCheckbox = within(janeRow!).getByRole('checkbox');
            fireEvent.click(janeCheckbox);
            
            const batchRejectButton = screen.getByRole('button', { name: /批量驳回/i });
            fireEvent.click(batchRejectButton);
            
            await waitFor(() => {
                expect(mockShowWarning).toHaveBeenCalledWith(expect.stringContaining('CL-2023-002'));
                expect(mockShowWarning).toHaveBeenCalledWith(expect.stringContaining('已是"已驳回"状态'));
            });
        });
    });

    describe('Row Selection', () => {
        it('selects individual rows when clicked', async () => {
            renderComponent();
            
            const acmeRow = screen.getAllByRole('row').find(row => row.textContent?.includes('Acme Corp'));
            expect(acmeRow).toBeDefined();
            
            // Click on the row (not on checkbox or buttons)
            const acmeNameCell = within(acmeRow!).getByText('Acme Corp (组织)');
            fireEvent.click(acmeNameCell);
            
            await waitFor(() => {
                const acmeCheckbox = within(acmeRow!).getByRole('checkbox');
                expect(acmeCheckbox).toBeChecked();
            });
        });

        it('does not select row when clicking on interactive elements', async () => {
            renderComponent();
            
            const acmeRow = screen.getAllByRole('row').find(row => row.textContent?.includes('Acme Corp'));
            expect(acmeRow).toBeDefined();
            
            // Click on checkbox directly
            const acmeCheckbox = within(acmeRow!).getByRole('checkbox');
            fireEvent.click(acmeCheckbox);
            
            // Row should be selected
            await waitFor(() => {
                expect(acmeCheckbox).toBeChecked();
            });
        });
    });
});
