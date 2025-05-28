import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n'; // Adjust path
import AdminCreateClaimBasicInfoDialog, { AdminBasicClaimData } from './AdminCreateClaimBasicInfoDialog';

const mockOnClose = vi.fn();
const mockOnNext = vi.fn();

describe('AdminCreateClaimBasicInfoDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderDialog = (open = true) => {
        render(
            <I18nextProvider i18n={i18n}>
                <AdminCreateClaimBasicInfoDialog
                    open={open}
                    onClose={mockOnClose}
                    onNext={mockOnNext}
                />
            </I18nextProvider>
        );
    };

    // Rendering Test
    it('renders the MUI Dialog with all form fields', () => {
        renderDialog();
        expect(screen.getByText('创建债权 (管理员代报) - 基本信息')).toBeInTheDocument(); // Dialog Title

        // Creditor Info
        expect(screen.getByLabelText(/类别/)).toBeInTheDocument();
        expect(screen.getByLabelText(/姓名\/名称/)).toBeInTheDocument();
        // Identifier label changes, check for one of them or a generic part
        expect(screen.getByLabelText(/统一社会信用代码|身份证号/)).toBeInTheDocument();

        // Contact Info
        expect(screen.getByLabelText(/联系人姓名/)).toBeInTheDocument();
        expect(screen.getByLabelText(/联系方式/)).toBeInTheDocument();

        // Asserted Claim Info
        expect(screen.getByLabelText(/债权性质/)).toBeInTheDocument();
        expect(screen.getByLabelText(/币种/)).toBeInTheDocument();
        expect(screen.getByLabelText(/本金/)).toBeInTheDocument();
        expect(screen.getByLabelText(/利息/)).toBeInTheDocument();
        expect(screen.getByLabelText(/其他费用/)).toBeInTheDocument();

        expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '下一步 (编辑附件)' })).toBeInTheDocument();
    });

    // Validation Test
    it('shows FormHelperText errors if required fields are empty on "Next" click', async () => {
        renderDialog();
        const nextButton = screen.getByRole('button', { name: '下一步 (编辑附件)' });
        fireEvent.click(nextButton);

        await waitFor(() => {
            // Check for some of the error messages
            expect(screen.getByText('债权人类别不能为空')).toBeInTheDocument();
            expect(screen.getByText('债权人名称不能为空')).toBeInTheDocument();
            // Add more checks for other required fields as needed
        });
        expect(mockOnNext).not.toHaveBeenCalled();
    });

    it('shows an error if principal is not a positive number', async () => {
        renderDialog();
        // Fill other required fields to isolate principal validation
        fireEvent.mouseDown(screen.getByLabelText(/类别/));
        fireEvent.click(await screen.findByText('组织'));
        fireEvent.change(screen.getByLabelText(/姓名\/名称/), { target: { value: 'Test Org' } });
        fireEvent.change(screen.getByLabelText(/统一社会信用代码/), { target: { value: 'ORG123' } });
        fireEvent.change(screen.getByLabelText(/联系人姓名/), { target: { value: 'Test Contact' } });
        fireEvent.change(screen.getByLabelText(/联系方式/), { target: { value: '1234567890' } });
        fireEvent.mouseDown(screen.getByLabelText(/债权性质/));
        fireEvent.click(await screen.findByText('货款'));

        fireEvent.change(screen.getByLabelText(/本金/), { target: { value: '0' } });

        const nextButton = screen.getByRole('button', { name: '下一步 (编辑附件)' });
        fireEvent.click(nextButton);

        await waitFor(() => {
            expect(screen.getByText('本金必须为正数')).toBeInTheDocument();
        });
        expect(mockOnNext).not.toHaveBeenCalled();
    });

    // onNext Callback Test
    it('calls onNext with form data when valid and "Next" is clicked', async () => {
        renderDialog();
        const testData: AdminBasicClaimData = {
            creditorCategory: '个人',
            creditorName: 'Test Individual',
            creditorIdentifier: 'INDIVIDUAL123',
            contactPersonName: 'Test Individual Contact',
            contactInfo: '000111222',
            claimNature: '服务费',
            currency: 'USD',
            principal: '1500',
            interest: '50',
            otherFees: '10',
        };

        // Fill form
        fireEvent.mouseDown(screen.getByLabelText(/类别/));
        fireEvent.click(await screen.findByText(testData.creditorCategory!));
        fireEvent.change(screen.getByLabelText(/姓名\/名称/), { target: { value: testData.creditorName } });
        fireEvent.change(screen.getByLabelText(/身份证号/), { target: { value: testData.creditorIdentifier } }); // Label changes
        fireEvent.change(screen.getByLabelText(/联系人姓名/), { target: { value: testData.contactPersonName } });
        fireEvent.change(screen.getByLabelText(/联系方式/), { target: { value: testData.contactInfo } });

        fireEvent.mouseDown(screen.getByLabelText(/债权性质/));
        fireEvent.click(await screen.findByText(testData.claimNature!));

        fireEvent.mouseDown(screen.getByLabelText(/币种/));
        fireEvent.click(await screen.findByText(testData.currency!));

        fireEvent.change(screen.getByLabelText(/本金/), { target: { value: testData.principal } });
        fireEvent.change(screen.getByLabelText(/利息/), { target: { value: testData.interest } });
        fireEvent.change(screen.getByLabelText(/其他费用/), { target: { value: testData.otherFees } });

        const nextButton = screen.getByRole('button', { name: '下一步 (编辑附件)' });
        fireEvent.click(nextButton);

        await waitFor(() => {
            expect(mockOnNext).toHaveBeenCalledWith(testData);
        });
    });

    // onClose Callback Test
    it('calls onClose when "Cancel" button is clicked', () => {
        renderDialog();
        const cancelButton = screen.getByRole('button', { name: '取消' });
        fireEvent.click(cancelButton);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
});
