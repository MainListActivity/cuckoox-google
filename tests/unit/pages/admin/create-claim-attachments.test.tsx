import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/src/i18n'; // Adjust path
import { SnackbarProvider, useSnackbar } from '@/src/contexts/SnackbarContext';
import AdminCreateClaimAttachmentsPage from '@/src/pages/admin/create-claim-attachments';
import { Delta } from 'quill/core';

// Mock useNavigate and useParams
const mockNavigate = vi.fn();
const mockTempClaimId = 'TEMP-CLAIM-MOCK-456';
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
        useParams: () => ({ tempClaimId: mockTempClaimId }),
    };
});

// Mock RichTextEditor
vi.mock('../../../../src/components/RichTextEditor', () => ({
    __esModule: true,
    default: vi.fn(({ value, onChange }) => (
        <textarea
            data-testid="mocked-rich-text-editor"
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
vi.mock('../../../../src/contexts/SnackbarContext', async () => {
    const actual = await vi.importActual('../../../../src/contexts/SnackbarContext');
    return {
        ...actual,
        useSnackbar: () => ({
            showSnackbar: mockShowSnackbar,
        }),
    };
});

describe('AdminCreateClaimAttachmentsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderComponent = () => {
        render(
            <BrowserRouter>
                <I18nextProvider i18n={i18n}>
                    <SnackbarProvider>
                        <AdminCreateClaimAttachmentsPage />
                    </SnackbarProvider>
                </I18nextProvider>
            </BrowserRouter>
        );
    };

    // Rendering Test
    it('renders the page with MUI components, displays tempClaimId, and shows RichTextEditor', () => {
        renderComponent();
        expect(screen.getByText('创建债权 (管理员代报) - 编辑附件材料')).toBeInTheDocument(); // AppBar Title
        expect(screen.getByText(new RegExp(mockTempClaimId))).toBeInTheDocument(); // tempClaimId display

        // Check for placeholder basic info (these are hardcoded in component for now)
        expect(screen.getByText(/示例债权人/)).toBeInTheDocument();
        expect(screen.getByText(/10,000.00 CNY/)).toBeInTheDocument();

        expect(screen.getByTestId('mocked-rich-text-editor')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '返回修改基本信息' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '保存草稿' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '完成并提交债权' })).toBeInTheDocument();
    });

    // Button Actions Tests
    it('clicking "返回修改基本信息" calls navigate with -1 (or specific path)', () => {
        renderComponent();
        const backButton = screen.getByRole('button', { name: '返回修改基本信息' });
        fireEvent.click(backButton);
        // The component uses navigate(-1). If it were a specific path, we'd check that.
        expect(mockNavigate).toHaveBeenCalledWith(-1);
        // Or if it's a specific path: expect(mockNavigate).toHaveBeenCalledWith(`/admin/create-claim/${mockTempClaimId}/edit-basic`);
    });

    it('"保存草稿" button logs correctly and calls showSnackbar', async () => {
        const consoleSpy = vi.spyOn(console, 'log');
        renderComponent();
        const saveDraftButton = screen.getByRole('button', { name: '保存草稿' });

        const editor = screen.getByTestId('mocked-rich-text-editor');
        fireEvent.change(editor, { target: { value: 'Admin draft content.' } });

        fireEvent.click(saveDraftButton);

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining(`Admin: Saving draft attachments for claim ID: ${mockTempClaimId}`),
                expect.any(Array) // For editorContent.ops
            );
        });
        expect(mockShowSnackbar).toHaveBeenCalledWith('附件草稿已保存 (模拟)', 'success');
        consoleSpy.mockRestore();
    });

    it('"完成并提交债权" button logs, calls showSnackbar, and navigates', async () => {
        const consoleSpy = vi.spyOn(console, 'log');
        renderComponent();
        const submitButton = screen.getByRole('button', { name: '完成并提交债权' });

        const editor = screen.getByTestId('mocked-rich-text-editor');
        fireEvent.change(editor, { target: { value: 'Admin final attachments.' } });

        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining(`Admin: Completing and submitting claim ID: ${mockTempClaimId}`),
                expect.any(Array) // For editorContent.ops
            );
        });
        expect(mockShowSnackbar).toHaveBeenCalledWith(expect.stringContaining(`管理员录入债权 ${mockTempClaimId} 已成功提交 (模拟)`), 'success');
        expect(mockNavigate).toHaveBeenCalledWith('/admin/claims');
        consoleSpy.mockRestore();
    });
});
