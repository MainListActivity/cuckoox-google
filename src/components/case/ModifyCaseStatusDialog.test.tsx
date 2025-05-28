import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n'; // Assuming your i18n setup is here
import { SnackbarProvider } from '../../contexts/SnackbarContext';
import ModifyCaseStatusDialog, { CaseStatus } from './ModifyCaseStatusDialog';

// Mock RichTextEditor
vi.mock('../RichTextEditor', () => ({
  __esModule: true,
  default: vi.fn(({ value, onTextChange, placeholder }) => (
      <textarea
          data-testid="mocked-rich-text-editor"
          placeholder={placeholder}
          value={typeof value === 'string' ? value : JSON.stringify(value?.ops)}
          onChange={(e) => {
            const mockDelta = { ops: [{ insert: e.target.value }] };
            if (onTextChange) {
              onTextChange(mockDelta, mockDelta, 'user');
            }
          }}
      />
  )),
}));

const mockCurrentCase = (status: CaseStatus) => ({
  id: 'case:testcaseid',
  current_status: status,
});

describe('ModifyCaseStatusDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderDialog = (currentStatus: CaseStatus, open = true, onClose = vi.fn()) => {
    return render(
        <I18nextProvider i18n={i18n}>
          <SnackbarProvider>
            <ModifyCaseStatusDialog
                open={open}
                onClose={onClose}
                currentCase={mockCurrentCase(currentStatus)}
            />
          </SnackbarProvider>
        </I18nextProvider>
    );
  };

  it('renders without crashing when open', () => {
    renderDialog('立案');
    expect(screen.getByText('修改案件状态')).toBeInTheDocument(); // Dialog title
    expect(screen.getByLabelText('选择新的状态')).toBeInTheDocument();
  });

  it('shows "公告时间" field when transitioning from "立案" to "公告"', async () => {
    renderDialog('立案');

    const nextStatusSelect = screen.getByLabelText('选择新的状态');
    fireEvent.mouseDown(nextStatusSelect); // Open select

    // Wait for MenuItems to be available if they are rendered asynchronously or within a Portal
    const公告Option = await screen.findByText('公告');
    fireEvent.click(公告Option);

    await waitFor(() => {
      expect(screen.getByLabelText('公告时间')).toBeInTheDocument();
    });
  });

  it('shows "结案时间" field when transitioning from "立案" to "结案"', async () => {
    renderDialog('立案');

    const nextStatusSelect = screen.getByLabelText('选择新的状态');
    fireEvent.mouseDown(nextStatusSelect);

    const 结案Option = await screen.findByText('结案');
    fireEvent.click(结案Option);

    await waitFor(() => {
      expect(screen.getByLabelText('结案时间')).toBeInTheDocument();
    });
  });

  it('shows "裁定重整公告" editor and "裁定重整时间" when transitioning from "债权人第一次会议" to "裁定重整"', async () => {
    renderDialog('债权人第一次会议');

    const nextStatusSelect = screen.getByLabelText('选择新的状态');
    fireEvent.mouseDown(nextStatusSelect);

    const 裁定重整Option = await screen.findByText('裁定重整');
    fireEvent.click(裁定重整Option);

    await waitFor(() => {
      // As per current implementation, "债权人第一次会议时间" is asked first
      expect(screen.getByLabelText('债权人第一次会议时间')).toBeInTheDocument();
      // Then "裁定重整时间"
      expect(screen.getByLabelText('裁定重整时间')).toBeInTheDocument();
      // And the RichTextEditor for "裁定重整公告"
      expect(screen.getByText('裁定重整公告')).toBeInTheDocument();
      expect(screen.getByTestId('mocked-rich-text-editor')).toBeInTheDocument();
    });
  });

  it('disables submit button if no next status is selected', () => {
    renderDialog('立案');
    const submitButton = screen.getByRole('button', { name: '提交' });
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when a next status is selected', async () => {
    renderDialog('立案');
    const submitButton = screen.getByRole('button', { name: '提交' });
    expect(submitButton).toBeDisabled();

    const nextStatusSelect = screen.getByLabelText('选择新的状态');
    fireEvent.mouseDown(nextStatusSelect);
    const 公告Option = await screen.findByText('公告');
    fireEvent.click(公告Option);

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

});
