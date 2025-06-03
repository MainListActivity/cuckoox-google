import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/src/i18n'; // Adjust path
import { SnackbarProvider, useSnackbar } from '@/src/contexts/SnackbarContext';
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
const mockShowSnackbar = vi.fn();
vi.mock('../../../../src/contexts/SnackbarContext', async () => {
    const actual = await vi.importActual('../../../../src/contexts/SnackbarContext');
    return {
        ...actual,
        useSnackbar: () => ({
            showSnackbar: mockShowSnackbar,
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

            const reasonTextarea = screen.getByLabelText(/驳回原因/i) as HTMLTextAreaElement; // This should be specific enough
            fireEvent.change(reasonTextarea, { target: { value: 'Test Rejection Reason' } });

            const confirmButton = screen.getByRole('button', { name: /确认驳回/i });
            fireEvent.click(confirmButton);

            await waitFor(() => {
                expect(mockShowSnackbar).toHaveBeenCalledWith(expect.stringContaining('1 个债权已批量驳回'), 'success');
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

    // Find the review/details link within that specific row
    // This assumes the link has text "审核债权" or "查看详情" or a specific href structure.
    // Adjust if the link text or role is different (e.g., a button with an icon).
    const reviewLink = within(claimRow!).getAllByRole('link').find(link =>
      link.getAttribute('href') === `/admin/claims/claim001/review` ||
      link.textContent?.includes('审核债权') ||
      link.textContent?.includes('查看详情')
        );
    // A more robust query might be getByRole('link', { name: /审核债权|查看详情/i }) if text is reliable

        expect(reviewLink).toBeDefined();
        fireEvent.click(reviewLink!);

        expect(mockNavigate).toHaveBeenCalledWith('/admin/claims/claim001/review');
    });
});
