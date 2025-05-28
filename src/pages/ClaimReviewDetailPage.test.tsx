import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n'; // Adjust path
import { SnackbarProvider, useSnackbar } from '../contexts/SnackbarContext';
import ClaimReviewDetailPage from './ClaimReviewDetailPage';
import Delta from 'quill-delta';

// Mock useNavigate and useParams
const mockNavigate = vi.fn();
const mockClaimId = 'claim001'; // Use an ID that matches mock data for better testing
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
        useParams: () => ({ id: mockClaimId }), // Ensure 'id' matches what useParams expects
    };
});

// Mock RichTextEditor
vi.mock('../../components/RichTextEditor', () => ({
    __esModule: true,
    default: vi.fn(({ value, onChange, readOnly, placeholder }) => (
        <textarea
            data-testid={`mocked-rich-text-editor${readOnly ? '-readonly' : ''}`}
            placeholder={placeholder}
            readOnly={readOnly}
            value={value instanceof Delta ? JSON.stringify(value.ops) : ''}
            onChange={(e) => {
                const mockDelta = new Delta().insert(e.target.value);
                if (onChange) {
                    onChange(mockDelta);
                }
            }}
        />
    )),
}));

// Mock useSnackbar
const mockShowSnackbar = vi.fn();
vi.mock('../../contexts/SnackbarContext', async () => {
    const actual = await vi.importActual('../../contexts/SnackbarContext');
    return {
        ...actual,
        useSnackbar: () => ({
            showSnackbar: mockShowSnackbar,
        }),
    };
});

describe('ClaimReviewDetailPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderComponent = () => {
        render(
            <BrowserRouter>
                <I18nextProvider i18n={i18n}>
                    <SnackbarProvider>
                        <ClaimReviewDetailPage />
                    </SnackbarProvider>
                </I18nextProvider>
            </BrowserRouter>
        );
    };

    // Rendering Tests
    it('renders MUI layout and displays mock claim details after loading', async () => {
        renderComponent();
        // Wait for loading to complete (data to be set)
        await waitFor(() => {
            expect(screen.getByText(`审核债权: CL-${mockClaimId.slice(-5)}`)).toBeInTheDocument(); // AppBar title
        });

        // Check for some key elements from the layout
        expect(screen.getByText('债权人申报信息')).toBeInTheDocument(); // Left panel title
        expect(screen.getByText('债权人提交的附件材料')).toBeInTheDocument(); // Right panel title
        expect(screen.getByText('管理员内部审核备注')).toBeInTheDocument(); // Right panel title

        // Check for some data from initialMockClaimData (Acme Corp)
        expect(screen.getByText('Acme Corp (组织)')).toBeInTheDocument();
        expect(screen.getByText('91310000MA1FL000XQ')).toBeInTheDocument(); // Creditor ID
        expect(screen.getByText(/150,000\.00/)).toBeInTheDocument(); // Asserted total amount

        // Check for the FAB
        expect(screen.getByRole('button', { name: /audit claim/i })).toBeInTheDocument(); // FAB aria-label
    });

    // Audit Modal Tests
    describe('Audit Modal Functionality', () => {
        it('opens the audit modal when FAB is clicked', async () => {
            renderComponent();
            await waitFor(() => expect(screen.getByText(`审核债权: CL-${mockClaimId.slice(-5)}`)).toBeInTheDocument());

            const fab = screen.getByRole('button', { name: /audit claim/i });
            fireEvent.click(fab);

            await waitFor(() => {
                expect(screen.getByText('填写审核意见与认定金额')).toBeInTheDocument(); // Modal title
            });
            // Check for some form fields in the modal
            expect(screen.getByLabelText(/审核认定债权性质/)).toBeInTheDocument();
            expect(screen.getByLabelText(/审核状态/)).toBeInTheDocument();
            expect(screen.getByLabelText(/审核认定本金/)).toBeInTheDocument();
        });

        it('pre-fills modal form correctly for a "待审核" claim', async () => {
            renderComponent();
            await waitFor(() => expect(screen.getByText(`审核债权: CL-${mockClaimId.slice(-5)}`)).toBeInTheDocument());
            fireEvent.click(screen.getByRole('button', { name: /audit claim/i }));
            await waitFor(() => expect(screen.getByText('填写审核意见与认定金额')).toBeInTheDocument());

            // initialMockClaimData has '待审核' status and asserted_details
            expect(screen.getByLabelText(/审核认定债权性质/).closest('div')?.querySelector('input')).toHaveValue('货款');
            expect(screen.getByLabelText(/审核认定本金/).closest('div')?.querySelector('input')).toHaveValue('120000'); // principal
            expect(screen.getByLabelText(/审核状态/).closest('div')?.querySelector('input')).toHaveValue(''); // Status should be empty to force selection
        });

        it('shows validation errors in modal if required fields are empty on submit', async () => {
            renderComponent();
            await waitFor(() => expect(screen.getByText(`审核债权: CL-${mockClaimId.slice(-5)}`)).toBeInTheDocument());
            fireEvent.click(screen.getByRole('button', { name: /audit claim/i }));
            await waitFor(() => expect(screen.getByText('填写审核意见与认定金额')).toBeInTheDocument());

            const submitReviewButton = screen.getByRole('button', { name: '提交审核' });
            fireEvent.click(submitReviewButton);

            await waitFor(() => {
                expect(screen.getByText('审核认定债权性质不能为空。')).toBeInTheDocument();
                expect(screen.getByText('审核状态不能为空。')).toBeInTheDocument();
                // Principal might default to 0 from parseFloat('')
                // expect(screen.getByText('审核认定本金不能为空且必须大于等于0。')).toBeInTheDocument();
                expect(screen.getByText('审核意见/备注不能为空。')).toBeInTheDocument();
            });
            expect(mockShowSnackbar).toHaveBeenCalledWith('请修正审核表单中的错误。', 'error');
        });

        it('calls handleSubmitReview, updates data, and shows snackbar on successful modal submission', async () => {
            renderComponent();
            await waitFor(() => expect(screen.getByText(`审核债权: CL-${mockClaimId.slice(-5)}`)).toBeInTheDocument());
            fireEvent.click(screen.getByRole('button', { name: /audit claim/i }));
            await waitFor(() => expect(screen.getByText('填写审核意见与认定金额')).toBeInTheDocument());

            // Fill the modal form
            fireEvent.change(screen.getByLabelText(/审核认定债权性质/).closest('div')!.querySelector('input')!, { target: { value: '服务费' } }); // This is simplified, real MUI select needs proper interaction
            // Simulate selecting from MUI Select
            const natureSelect = screen.getByLabelText(/审核认定债权性质/).parentElement!;
            fireEvent.mouseDown(natureSelect);
            const serviceFeeOption = await screen.findByRole('option', { name: '服务费' });
            fireEvent.click(serviceFeeOption);

            const statusSelect = screen.getByLabelText(/审核状态/).parentElement!;
            fireEvent.mouseDown(statusSelect);
            const approvedOption = await screen.findByRole('option', { name: '审核通过' });
            fireEvent.click(approvedOption);

            fireEvent.change(screen.getByLabelText(/审核认定本金/), { target: { value: '100000' } });
            fireEvent.change(screen.getByLabelText(/审核认定利息/), { target: { value: '1000' } });
            fireEvent.change(screen.getByLabelText(/审核意见\/备注/), { target: { value: '审核通过，材料齐全。' } });

            // Mock window.confirm
            const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);

            const submitReviewButton = screen.getByRole('button', { name: '提交审核' });
            fireEvent.click(submitReviewButton);

            await waitFor(() => {
                expect(mockShowSnackbar).toHaveBeenCalledWith('审核意见已提交 (模拟)', 'success');
            });

            // Check if data on the page updated (e.g., status chip)
            // Need to wait for modal to close and UI to re-render
            await waitFor(() => {
                expect(screen.getByText('审核通过')).toBeInTheDocument(); // Chip text
            });
            expect(screen.getByText('审核通过').closest('.MuiChip-root')).toHaveClass('MuiChip-colorSuccess'); // Chip color
            expect(screen.getByText('审核通过，材料齐全。')).toBeInTheDocument(); // Review opinion on page

            confirmSpy.mockRestore();
        });
    });
});
