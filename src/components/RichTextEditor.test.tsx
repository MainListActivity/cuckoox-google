import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Quill from 'quill';
import RichTextEditor, { QuillDelta } from './RichTextEditor';
import { useSurreal } from '@/src/hooks/useSurreal';
import { uploadFile } from '@/src/services/fileUploadService';

// Mock Quill constructor and its methods
const mockGetContents = jest.fn(() => ({ ops: [{ insert: 'Initial content\n' }] }));
const mockSetContents = jest.fn();
const mockUpdateContents = jest.fn();
const mockGetSelection = jest.fn(() => ({ index: 0, length: 0 }));
const mockSetSelection = jest.fn();
const mockOn = jest.fn();
const mockOff = jest.fn();
const mockGetBounds = jest.fn(() => ({ top: 0, left: 0, width: 0, height: 10 }));
const mockEnable = jest.fn();
const mockHasFocus = jest.fn(() => false);
const mockRoot = { innerHTML: '', parentNode: document.createElement('div') }; // Mock parentNode

jest.mock('quill', () => {
  return jest.fn().mockImplementation(() => ({
    getContents: mockGetContents,
    setContents: mockSetContents,
    updateContents: mockUpdateContents,
    getSelection: mockGetSelection,
    setSelection: mockSetSelection,
    on: mockOn,
    off: mockOff,
    getBounds: mockGetBounds,
    enable: mockEnable,
    hasFocus: mockHasFocus,
    root: mockRoot,
    // Add any other Quill methods that your component might call
  }));
});

// Mock useSurreal hook
const mockSurrealQuery = jest.fn();
const mockSurrealCreate = jest.fn();
const mockSurrealChange = jest.fn();
const mockSurrealSelect = jest.fn();
const mockSurrealDelete = jest.fn();
const mockSurrealListenLive = jest.fn();
const mockSurrealKill = jest.fn();

jest.mock('@/src/hooks/useSurreal', () => ({
  useSurreal: jest.fn(() => ({
    surreal: {
      query: mockSurrealQuery,
      create: mockSurrealCreate,
      change: mockSurrealChange,
      select: mockSurrealSelect,
      delete: mockSurrealDelete,
      listenLive: mockSurrealListenLive,
      kill: mockSurrealKill,
    },
  })),
}));

// Mock fileUploadService
jest.mock('@/src/services/fileUploadService', () => ({
  uploadFile: jest.fn(),
}));

// Mock useTranslation
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));


const USER_COLORS = [
    '#26A69A', '#5C6BC0', '#EC407A',
    '#FF7043', '#66BB6A', '#78909C',
];

const hexToRgba = (hex: string, alpha: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};


describe('RichTextEditor - Real-time Collaboration', () => {
  const mockDocumentId = 'test-doc-1';
  const localUserId = 'user-local';
  const localUserName = 'Local User';
  const remoteUserId1 = 'user-remote-1';
  const remoteUserName1 = 'Remote User 1';

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mockRoot.parentNode for each test to ensure clean DOM
    mockRoot.parentNode = document.createElement('div');
    // Default mock implementations
    mockSurrealQuery.mockImplementation((query) => {
        if (query.startsWith('LIVE SELECT * FROM delta')) {
            return Promise.resolve([{ result: 'live-delta-query-id' }]);
        }
        if (query.startsWith('LIVE SELECT * FROM cursor')) {
            return Promise.resolve([{ result: 'live-cursor-query-id' }]);
        }
        return Promise.resolve([]);
    });
    mockSurrealSelect.mockResolvedValue(null); // Default to document not existing or no deltas
  });

  test('should render the editor', () => {
    render(
      <RichTextEditor
        documentId={mockDocumentId}
        userId={localUserId}
        userName={localUserName}
        value=""
      />
    );
    expect(Quill).toHaveBeenCalledTimes(1);
  });

  test('sends delta to SurrealDB on local text change', async () => {
    render(
      <RichTextEditor
        documentId={mockDocumentId}
        userId={localUserId}
        userName={localUserName}
        value=""
      />
    );

    // Simulate text-change event from Quill
    // The 'on' mock captures the handler, so we can call it
    const textChangeHandler = mockOn.mock.calls.find(call => call[0] === 'text-change')?.[1];
    expect(textChangeHandler).toBeDefined();

    const testDelta: QuillDelta = { ops: [{ insert: 'Hello' }] };
    await act(async () => {
      if (textChangeHandler) {
        textChangeHandler(testDelta, { ops: [] }, 'user');
      }
    });

    expect(mockSurrealCreate).toHaveBeenCalledWith('delta', expect.objectContaining({
      docId: mockDocumentId,
      delta: testDelta,
      userId: localUserId,
    }));
  });

  test('applies incoming delta from remote user', async () => {
    let deltaLiveCallback: ((data: any) => void) | null = null;
    mockSurrealListenLive.mockImplementation((queryId, callback) => {
      if (queryId === 'live-delta-query-id') {
        deltaLiveCallback = callback;
      }
    });

    render(
      <RichTextEditor
        documentId={mockDocumentId}
        userId={localUserId}
        userName={localUserName}
        value=""
      />
    );

    expect(deltaLiveCallback).not.toBeNull();

    const remoteDelta: QuillDelta = { ops: [{ insert: 'Remote change' }] };
    const remoteDeltaPayload = {
      action: 'CREATE',
      result: {
        docId: mockDocumentId,
        delta: remoteDelta,
        userId: remoteUserId1, // Different user
        ts: new Date().toISOString(),
      },
    };

    await act(async () => {
      if (deltaLiveCallback) {
        deltaLiveCallback(remoteDeltaPayload);
      }
    });
    expect(mockUpdateContents).toHaveBeenCalledWith(remoteDelta, 'api');
  });

  test('sends cursor update to SurrealDB on local selection change', async () => {
    render(
      <RichTextEditor
        documentId={mockDocumentId}
        userId={localUserId}
        userName={localUserName}
        value=""
        readOnly={false}
      />
    );

    const selectionChangeHandler = mockOn.mock.calls.find(call => call[0] === 'selection-change')?.[1];
    expect(selectionChangeHandler).toBeDefined();

    const testRange = { index: 5, length: 2 };
    await act(async () => {
      if (selectionChangeHandler) {
        selectionChangeHandler(testRange, null, 'user');
      }
    });

    expect(mockSurrealChange).toHaveBeenCalledWith(`cursor:${mockDocumentId}:${localUserId}`, expect.objectContaining({
      docId: mockDocumentId,
      userId: localUserId,
      userName: localUserName,
      range: testRange,
    }));
  });

  test('displays remote user cursor and selection correctly', async () => {
    let cursorLiveCallback: ((data: any) => void) | null = null;
    mockSurrealListenLive.mockImplementation((queryId, callback) => {
      // For this test, assume the second LIVE query is for cursors
      if (queryId === 'live-cursor-query-id') {
        cursorLiveCallback = callback;
      }
    });

    const { container } = render(
      <RichTextEditor
        documentId={mockDocumentId}
        userId={localUserId}
        userName={localUserName}
        value=""
        readOnly={false}
      />
    );

    expect(cursorLiveCallback).not.toBeNull();

    const remoteCursorPayload = {
      action: 'CREATE',
      result: {
        docId: mockDocumentId,
        userId: remoteUserId1,
        userName: remoteUserName1,
        range: { index: 10, length: 5 },
        ts: new Date().toISOString(),
      },
    };

    // Calculate expected color for remoteUser1
    const userHash = remoteUserId1.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const expectedColor = USER_COLORS[userHash % USER_COLORS.length];
    const expectedSelectionColor = hexToRgba(expectedColor, 0.3);

    await act(async () => {
      if (cursorLiveCallback) {
        cursorLiveCallback(remoteCursorPayload);
      }
    });

    // Wait for DOM updates
    await waitFor(() => {
      const remoteCursorEl = container.querySelector('.remote-cursor');
      expect(remoteCursorEl).toBeInTheDocument();
      if (remoteCursorEl) {
        expect(remoteCursorEl).toHaveStyle(`background-color: ${expectedColor}`);
        const nameLabel = remoteCursorEl.querySelector('.remote-cursor-name');
        expect(nameLabel).toBeInTheDocument();
        expect(nameLabel).toHaveTextContent(remoteUserName1);
        expect(nameLabel).toHaveStyle(`background-color: ${expectedColor}`);
      }

      const remoteSelectionEl = container.querySelector('.remote-selection');
      expect(remoteSelectionEl).toBeInTheDocument();
      if (remoteSelectionEl) {
         expect(remoteSelectionEl).toHaveStyle(`background-color: ${expectedSelectionColor}`);
      }
    });
  });

  test('updates and removes remote user cursor correctly', async () => {
    let cursorLiveCallback: ((data: any) => void) | null = null;
    mockSurrealListenLive.mockImplementation((queryId, callback) => {
      if (queryId === 'live-cursor-query-id') {
        cursorLiveCallback = callback;
      }
    });

    const { container } = render(
      <RichTextEditor
        documentId={mockDocumentId}
        userId={localUserId}
        userName={localUserName}
        value=""
        readOnly={false}
      />
    );

    const initialCursorPayload = {
      action: 'CREATE',
      result: { docId: mockDocumentId, userId: remoteUserId1, userName: remoteUserName1, range: { index: 1, length: 0 }, ts: new Date().toISOString() },
    };
    const updatedCursorPayload = {
      action: 'UPDATE',
      result: { docId: mockDocumentId, userId: remoteUserId1, userName: remoteUserName1, range: { index: 5, length: 2 }, ts: new Date().toISOString() },
    };
    const deleteCursorPayload = {
      action: 'DELETE',
      result: { docId: mockDocumentId, userId: remoteUserId1, userName: remoteUserName1, range: { index: 5, length: 2 }, ts: new Date().toISOString()}, // Range might not be in delete, but result structure matters
    };
     // Calculate expected color for remoteUser1
    const userHash = remoteUserId1.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const expectedColor = USER_COLORS[userHash % USER_COLORS.length];
    const expectedSelectionColor = hexToRgba(expectedColor, 0.3);


    // CREATE
    await act(async () => { if (cursorLiveCallback) cursorLiveCallback(initialCursorPayload); });
    await waitFor(() => {
      expect(container.querySelector('.remote-cursor')).toBeInTheDocument();
      expect(container.querySelector('.remote-selection')).not.toBeInTheDocument(); // length 0
    });

    // UPDATE (with selection)
    mockGetBounds.mockReturnValue({ top: 10, left: 20, width: 30, height: 15 }); // Ensure getBounds is called for selection
    await act(async () => { if (cursorLiveCallback) cursorLiveCallback(updatedCursorPayload); });
    await waitFor(() => {
      const remoteCursorEl = container.querySelector('.remote-cursor');
      expect(remoteCursorEl).toBeInTheDocument();
      const nameLabel = remoteCursorEl?.querySelector('.remote-cursor-name');
      expect(nameLabel).toHaveTextContent(remoteUserName1);

      const remoteSelectionEl = container.querySelector('.remote-selection');
      expect(remoteSelectionEl).toBeInTheDocument();
      expect(remoteSelectionEl).toHaveStyle(`background-color: ${expectedSelectionColor}`);
    });

    // DELETE
    await act(async () => { if (cursorLiveCallback) cursorLiveCallback(deleteCursorPayload); });
    await waitFor(() => {
      expect(container.querySelector('.remote-cursor')).not.toBeInTheDocument();
      expect(container.querySelector('.remote-selection')).not.toBeInTheDocument();
    });
  });

  test('cleans up local user cursor on unmount', async () => {
    const { unmount } = render(
      <RichTextEditor
        documentId={mockDocumentId}
        userId={localUserId}
        userName={localUserName}
        value=""
        readOnly={false} // Important for cleanup logic
      />
    );

    // Ensure selectionChangeHandler has been set up by triggering an effect
    // This is a bit of a workaround to ensure the cleanup function in the effect is registered
    // In a real scenario, effects run after render. Here, we want to ensure the setup effect has run.
    await act(async () => {});


    unmount();

    expect(mockSurrealDelete).toHaveBeenCalledWith(`cursor:${mockDocumentId}:${localUserId}`);
  });

  test('cleans up local user cursor on beforeunload event', async () => {
    render(
      <RichTextEditor
        documentId={mockDocumentId}
        userId={localUserId}
        userName={localUserName}
        value=""
        readOnly={false}
      />
    );
    // Similar to unmount, ensure effect has run
    await act(async () => {});

    // Simulate beforeunload
    act(() => {
        window.dispatchEvent(new Event('beforeunload'));
    });

    expect(mockSurrealDelete).toHaveBeenCalledWith(`cursor:${mockDocumentId}:${localUserId}`);
    // Note: In a real browser, beforeunload might prevent further actions.
    // Here, we're just testing if our event listener calls the cleanup.
  });


  test('initial content is loaded from deltas if available', async () => {
    const initialDelta1: QuillDelta = { ops: [{ insert: 'Part 1 ' }] };
    const initialDelta2: QuillDelta = { ops: [{ insert: 'Part 2' }] };
    mockSurrealSelect.mockImplementation(async (query) => {
        if (query === `delta WHERE docId = '${mockDocumentId}' ORDER BY ts ASC`) {
            return [
                { delta: initialDelta1, ts: '2023-01-01T10:00:00Z' },
                { delta: initialDelta2, ts: '2023-01-01T10:00:01Z' },
            ];
        }
        if (query === `document:${mockDocumentId}`) { // Fallback document check
            return null;
        }
        return [];
    });

    // Combined delta for setContents
    const expectedCombinedDelta = new Quill(document.createElement('div')).getContents() // empty delta
                                  .compose(initialDelta1).compose(initialDelta2);


    render(
        <RichTextEditor
            documentId={mockDocumentId}
            userId={localUserId}
            userName={localUserName}
            value=""
        />
    );

    await waitFor(() => {
      // Quill's setContents is called with a Delta object.
      // We need to compare the ops, not object identity.
      expect(mockSetContents).toHaveBeenCalledTimes(1);
      const calledDelta = mockSetContents.mock.calls[0][0];
      expect(calledDelta.ops).toEqual(expectedCombinedDelta.ops);

    });
  });

});
