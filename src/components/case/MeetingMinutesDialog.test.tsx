import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n'; // Assuming your i18n setup is here
import MeetingMinutesDialog, { QuillDelta } from './MeetingMinutesDialog'; // Assuming QuillDelta is exported or defined
import Delta from 'quill-delta'; // Import Delta

// Mock RichTextEditor
vi.mock('../RichTextEditor', () => ({
  __esModule: true,
  default: vi.fn(({ value, onChange, placeholder }) => ( // Changed onTextChange to onChange based on MeetingMinutesDialog
      <textarea
          data-testid="mocked-rich-text-editor"
          placeholder={placeholder}
          value={typeof value === 'string' ? value : JSON.stringify(value?.ops)}
          onChange={(e) => {
            const mockDelta = new Delta().insert(e.target.value); // Use new Delta()
            if (onChange) {
              onChange(mockDelta, mockDelta, 'user'); // Pass Delta, lastChangeDelta, source
            }
          }}
      />
  )),
}));

const mockCaseInfo = {
  caseId: 'case:testcaseid',
  caseName: 'Test Case Name 2023',
};

const mockMeetingTitle = 'Test Meeting Minutes Title';

describe('MeetingMinutesDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderDialog = (
      open = true,
      onClose = vi.fn(),
      onSave = vi.fn(),
      existingMinutes?: QuillDelta | string
  ) => {
    return render(
        <I18nextProvider i18n={i18n}>
          <MeetingMinutesDialog
              open={open}
              onClose={onClose}
              caseInfo={mockCaseInfo}
              meetingTitle={mockMeetingTitle}
              existingMinutes={existingMinutes}
              onSave={onSave}
          />
        </I18nextProvider>
    );
  };

  it('renders with the provided title and case name', () => {
    renderDialog();
    expect(screen.getByText(mockMeetingTitle)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(mockCaseInfo.caseName))).toBeInTheDocument(); // Check for case name part in title
  });

  it('save button is initially disabled when creating new minutes (no existingMinutes)', () => {
    renderDialog();
    const saveButton = screen.getByRole('button', { name: '保存纪要' }); // Adjust name if translation changes
    expect(saveButton).toBeDisabled();
  });

  it('save button is enabled after typing in the editor when creating new minutes', async () => {
    renderDialog();
    const saveButton = screen.getByRole('button', { name: '保存纪要' });
    expect(saveButton).toBeDisabled();

    const editor = screen.getByTestId('mocked-rich-text-editor');
    fireEvent.change(editor, { target: { value: 'Some meeting notes.' } });

    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });
  });

  it('save button is initially disabled if existingMinutes are provided but editor is not dirty', () => {
    const initialDelta = new Delta().insert('Initial content.\n');
    renderDialog(true, vi.fn(), vi.fn(), initialDelta);
    const saveButton = screen.getByRole('button', { name: '保存纪要' });
    expect(saveButton).toBeDisabled(); // Should be disabled because it's not dirty yet
  });

  it('save button is enabled if existingMinutes are provided and editor becomes dirty', async () => {
    const initialDelta = new Delta().insert('Initial content.\n');
    renderDialog(true, vi.fn(), vi.fn(), initialDelta);
    const saveButton = screen.getByRole('button', { name: '保存纪要' });
    expect(saveButton).toBeDisabled();

    const editor = screen.getByTestId('mocked-rich-text-editor');
    fireEvent.change(editor, { target: { value: 'Initial content has been modified.' } });

    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });
  });

  it('calls onSave with the correct content when save button is clicked', async () => {
    const handleSaveMock = vi.fn();
    renderDialog(true, vi.fn(), handleSaveMock);

    const editor = screen.getByTestId('mocked-rich-text-editor');
    const testContent = 'Detailed meeting discussion notes.';
    fireEvent.change(editor, { target: { value: testContent } });

    const saveButton = screen.getByRole('button', { name: '保存纪要' });
    await waitFor(() => expect(saveButton).not.toBeDisabled());
    fireEvent.click(saveButton);

    expect(handleSaveMock).toHaveBeenCalledTimes(1);

    // Check the first argument (QuillDelta) passed to onSave
    const savedDelta = handleSaveMock.mock.calls[0][0] as QuillDelta;
    expect(savedDelta.ops).toEqual([{ insert: testContent }]);

    // Check the second argument (meetingTitle)
    expect(handleSaveMock.mock.calls[0][1]).toBe(mockMeetingTitle);

    // Check the third argument (caseId)
    expect(handleSaveMock.mock.calls[0][2]).toBe(mockCaseInfo.caseId);
  });

});
