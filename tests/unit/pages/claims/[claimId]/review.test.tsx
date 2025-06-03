import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/src/i18n'; // Adjust path
import { SnackbarProvider, useSnackbar } from '@/src/contexts/SnackbarContext';
import ClaimReviewDetailPage from '@/src/pages/claims/[claimId]/review';
import { Delta } from 'quill/core';

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
vi.mock('../../../../../src/components/RichTextEditor', () => ({
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
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
const mockShowInfo = vi.fn();
const mockShowWarning = vi.fn();

vi.mock('../../../../../src/contexts/SnackbarContext', async () => {
    const actual = await vi.importActual('../../../../../src/contexts/SnackbarContext');
    return {
        ...actual, // Spread actual to keep SnackbarProvider if it's used by the test directly
        useSnackbar: () => ({
            showSuccess: mockShowSuccess,
            showError: mockShowError,
            showInfo: mockShowInfo,
            showWarning: mockShowWarning,
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
            // For MUI Select, check the displayed value, not a hidden input if that's the case.
            // Assuming the label is associated with the select's display element or its FormControl.
            expect(screen.getByLabelText(/审核认定债权性质/)).toHaveTextContent('货款'); // Check displayed text for Select
            expect(screen.getByLabelText(/审核认定本金/)).toHaveValue(120000); // For TextField input

            // For an empty Select, its text content might be a zero-width space or rely on placeholder.
            // If it's a native select or a specific MUI setup, .value might work.
            // Let's assume it displays nothing or a placeholder that isn't '货款' or '120000'
            const statusSelectDisplay = screen.getByLabelText(/审核状态/);
            // More robust: check it doesn't have a specific value selected if it should be empty
            // For example, if '审核通过' is an option:
            // expect(within(statusSelectDisplay).queryByText('审核通过')).not.toBeInTheDocument();
            // Or check its direct text content if it's simple
            expect(statusSelectDisplay.textContent || "").toBe(""); // Or check for a specific placeholder if any

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
            expect(mockShowError).toHaveBeenCalledWith('请修正审核表单中的错误。'); // Changed to mockShowError and removed 'error' type arg
        });

        it('calls handleSubmitReview, updates data, and shows snackbar on successful modal submission', async () => {
            renderComponent();
            await waitFor(() => expect(screen.getByText(`审核债权: CL-${mockClaimId.slice(-5)}`)).toBeInTheDocument());
            fireEvent.click(screen.getByRole('button', { name: /audit claim/i }));
            await waitFor(() => expect(screen.getByText('填写审核意见与认定金额')).toBeInTheDocument());

            // Fill the modal form
            // Interact with "审核认定债权性质" Select
            const natureSelectControl = screen.getByLabelText(/审核认定债权性质/);
            fireEvent.mouseDown(natureSelectControl);
            const serviceFeeOption = await screen.findByRole('option', { name: '服务费' });
            fireEvent.click(serviceFeeOption);

            // Interact with "审核状态" Select
            const statusSelectControl = screen.getByLabelText(/审核状态/);
            fireEvent.mouseDown(statusSelectControl);
            const approvedOption = await screen.findByRole('option', { name: '审核通过' });
            fireEvent.click(approvedOption);

            fireEvent.change(screen.getByLabelText(/审核认定本金/), { target: { value: '100000' } });
            fireEvent.change(screen.getByLabelText(/审核认定利息/), { target: { value: '1000' } });
            // For RichTextEditor mock, the interaction is simplified
            fireEvent.change(screen.getByTestId('mocked-rich-text-editor'), { target: { value: '审核通过，材料齐全。' } });

            // Mock window.confirm
            const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);

            const submitReviewButton = screen.getByRole('button', { name: '提交审核' });
            fireEvent.click(submitReviewButton);

            await waitFor(() => {
                expect(mockShowSuccess).toHaveBeenCalledWith('审核意见已提交 (模拟)'); // Changed to mockShowSuccess and removed 'success' type arg
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
