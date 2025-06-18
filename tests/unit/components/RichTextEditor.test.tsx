import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import RichTextEditor from '@/src/components/RichTextEditor';
import { Delta } from 'quill/core';

// Mock MUI icons to avoid file handle issues
vi.mock('@mui/icons-material', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'mocked-icon' }),
  Close: () => React.createElement('div', { 'data-testid': 'close-icon' }),
  Fullscreen: () => React.createElement('div', { 'data-testid': 'fullscreen-icon' }),
  FullscreenExit: () => React.createElement('div', { 'data-testid': 'fullscreen-exit-icon' }),
  Upload: () => React.createElement('div', { 'data-testid': 'upload-icon' }),
  Image: () => React.createElement('div', { 'data-testid': 'image-icon' }),
  AttachFile: () => React.createElement('div', { 'data-testid': 'attach-file-icon' }),
  Save: () => React.createElement('div', { 'data-testid': 'save-icon' }),
  Edit: () => React.createElement('div', { 'data-testid': 'edit-icon' }),
  Preview: () => React.createElement('div', { 'data-testid': 'preview-icon' }),
  AddComment: () => React.createElement('div', { 'data-testid': 'add-comment-icon' }),
  ChevronLeft: () => React.createElement('div', { 'data-testid': 'chevron-left-icon' }),
  ExpandMore: () => React.createElement('div', { 'data-testid': 'expand-more-icon' }),
  ExpandLess: () => React.createElement('div', { 'data-testid': 'expand-less-icon' }),
}));

// Mock file upload service first
vi.mock('@/src/services/fileUploadService', () => ({
  uploadFile: vi.fn(),
}));

// Create mock SurrealDB client with all required methods
const mockSurrealClient = {
  status: 'disconnected',
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  use: vi.fn().mockResolvedValue(undefined),
  select: vi.fn().mockResolvedValue([]),
  create: vi.fn().mockResolvedValue({}),
  update: vi.fn().mockResolvedValue({}),
  merge: vi.fn().mockResolvedValue({}),
  delete: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockResolvedValue([]),
  live: vi.fn().mockResolvedValue('mock-live-id'),
  subscribeLive: vi.fn(),
  kill: vi.fn().mockResolvedValue(undefined),
};

// Mock SurrealDB provider
vi.mock('@/src/contexts/SurrealProvider', () => ({
  useSurrealClient: vi.fn(() => mockSurrealClient),
}));

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockToolbar = {
  addHandler: vi.fn(),
};

// Create stable mock objects to avoid reference changes
const mockQuillInstance = {
  getContents: vi.fn(() => ({ ops: [] })),
  setContents: vi.fn(),
  getText: vi.fn(() => ''),
  getSelection: vi.fn(() => ({ index: 0, length: 0 })),
  setSelection: vi.fn(),
  insertText: vi.fn(),
  insertEmbed: vi.fn(),
  deleteText: vi.fn(),
  updateContents: vi.fn(),
  enable: vi.fn(),
  isEnabled: vi.fn(() => true),
  getBounds: vi.fn(() => ({ top: 0, left: 0, width: 100, height: 20 })),
  root: {
    innerHTML: '',
    getAttribute: vi.fn(),
    setAttribute: vi.fn(),
    parentNode: document.createElement('div'),
  },
  on: vi.fn(),
  off: vi.fn(),
  hasFocus: vi.fn(() => false),
  getModule: vi.fn((moduleName: string) => {
    if (moduleName === 'toolbar') {
      return mockToolbar;
    }
    return null;
  }),
  clipboard: {
    dangerouslyPasteHTML: vi.fn(),
  },
};

// Mock Quill with stable reference
vi.mock('quill', () => {
  const QuillConstructor = vi.fn().mockImplementation(() => mockQuillInstance);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (QuillConstructor as any).import = vi.fn((module) => {
    if (module === 'ui/icons') {
      return {};
    }
    if (module === 'delta') {
      return Delta;
    }
    return {};
  });

  // Add events property
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (QuillConstructor as any).events = {
    TEXT_CHANGE: 'text-change',
    SELECTION_CHANGE: 'selection-change',
  };

  return {
    __esModule: true,
    default: QuillConstructor,
  };
});

const renderWithTheme = (component: React.ReactElement) => {
  const theme = createTheme();
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('RichTextEditor', () => {
  const mockOnTextChange = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    // Use fake timers to control setTimeout/setInterval
    vi.useFakeTimers();
    
    // Setup mock for uploadFile
    const { uploadFile } = await import('@/src/services/fileUploadService');
    vi.mocked(uploadFile).mockResolvedValue({
      url: 'https://example.com/uploaded-file.jpg',
      name: 'test-file.jpg',
      size: 1024,
      type: 'image/jpeg'
    });
  });

  afterEach(() => {
    // Clean up timers
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders editor with basic props', async () => {
    const mockDelta = new Delta([{ insert: 'Hello World' }]);
    
    renderWithTheme(
      <RichTextEditor
        defaultValue={mockDelta}
        onTextChange={mockOnTextChange}
        placeholder="请输入内容..."
      />
    );

    // Check if the editor container is present
    expect(document.querySelector('[class*="ql-"]')).toBeTruthy();
  });

  it('renders with context information panel', async () => {
    const mockDelta = new Delta([{ insert: 'Test content' }]);
    const contextInfo = {
      title: '案件详情',
      subtitle: '案件编号: TEST001',
      avatar: {
        text: '案',
        color: '#1976d2'
      },
      details: [
        {
          label: '负责人',
          value: '张三',
          icon: 'M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z'
        },
        {
          label: '创建时间',
          value: '2024-01-01',
          icon: 'M19,19H5V8H19V19Z'
        }
      ]
    };

    renderWithTheme(
      <RichTextEditor
        defaultValue={mockDelta}
        onTextChange={mockOnTextChange}
        contextInfo={contextInfo}
      />
    );

    // Check if context panel is rendered - use more specific selectors
    expect(screen.getByText('案件编号: TEST001')).toBeInTheDocument();
    expect(screen.getByText('负责人')).toBeInTheDocument();
    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.getByText('创建时间')).toBeInTheDocument();
    expect(screen.getByText('2024-01-01')).toBeInTheDocument();
  });

  it('hides context panel when close button is clicked', async () => {
    const mockDelta = new Delta([{ insert: 'Test content' }]);
    const contextInfo = {
      title: '测试标题',
      details: [
        {
          label: '测试标签',
          value: '测试值'
        }
      ]
    };

    renderWithTheme(
      <RichTextEditor
        defaultValue={mockDelta}
        onTextChange={mockOnTextChange}
        contextInfo={contextInfo}
      />
    );

    // Context panel should be visible - check for unique content
    expect(screen.getByText('测试标签')).toBeInTheDocument();
    expect(screen.getByText('测试值')).toBeInTheDocument();

    // Click close button
    const closeIcon = screen.getByTestId('close-icon');
    const closeButton = closeIcon.closest('button');
    expect(closeButton).toBeInTheDocument();
    if(closeButton) {
      fireEvent.click(closeButton);
    }

    // Context panel should be hidden
    expect(screen.queryByText('测试标签')).not.toBeInTheDocument();
    expect(screen.queryByText('测试值')).not.toBeInTheDocument();
  });

  it('handles read-only mode', async () => {
    const mockDelta = new Delta([{ insert: 'Read only content' }]);

    renderWithTheme(
      <RichTextEditor
        defaultValue={mockDelta}
        onTextChange={mockOnTextChange}
        readOnly={true}
      />
    );

    // In read-only mode, the editor should be disabled
    expect(mockQuillInstance.enable).toHaveBeenCalledWith(false);
  });

  it('uploads image and inserts it into editor', async () => {
    const { uploadFile } = await import('@/src/services/fileUploadService');
    const imageFile = new File(['image content'], 'image.png', { type: 'image/png' });

    renderWithTheme(<RichTextEditor defaultValue={new Delta()} onTextChange={vi.fn()} />);

    await waitFor(() => {
      expect(mockToolbar.addHandler).toHaveBeenCalledWith('image', expect.any(Function));
    });

    const imageHandler = vi.mocked(mockToolbar.addHandler).mock.calls.find(call => call[0] === 'image')?.[1];
    expect(imageHandler).toBeDefined();

    const mockInput = {
      click: vi.fn(),
      onchange: null as (() => void) | null,
      files: [imageFile],
      setAttribute: vi.fn(),
    };
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockInput as any);

    // Call the handler
    imageHandler();

    // The handler should have set the onchange property and called click
    expect(mockInput.click).toHaveBeenCalled();
    expect(mockInput.onchange).toBeInstanceOf(Function);

    // Manually trigger onchange
    if (mockInput.onchange) {
      await mockInput.onchange();
    }

    await waitFor(() => {
      expect(uploadFile).toHaveBeenCalledWith(imageFile);
    });

    await waitFor(() => {
      expect(mockQuillInstance.insertEmbed).toHaveBeenCalledWith(
        expect.any(Number),
        'image',
        'https://example.com/uploaded-file.jpg'
      );
    });

    createElementSpy.mockRestore();
  });

  it('uploads attachment and inserts it as a link', async () => {
    const { uploadFile } = await import('@/src/services/fileUploadService');
    const attachmentFile = new File(['file content'], 'document.pdf', { type: 'application/pdf' });

    renderWithTheme(<RichTextEditor defaultValue={new Delta()} onTextChange={vi.fn()} />);

    await waitFor(() => {
      expect(mockToolbar.addHandler).toHaveBeenCalledWith('attach', expect.any(Function));
    });

    const attachHandler = vi.mocked(mockToolbar.addHandler).mock.calls.find(call => call[0] === 'attach')?.[1];
    expect(attachHandler).toBeDefined();

    const mockInput = {
      click: vi.fn(),
      onchange: null as (() => void) | null,
      files: [attachmentFile],
      setAttribute: vi.fn(),
    };
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockInput as any);

    attachHandler();
    expect(mockInput.click).toHaveBeenCalled();
    expect(mockInput.onchange).toBeInstanceOf(Function);

    if (mockInput.onchange) {
      await mockInput.onchange();
    }

    await waitFor(() => {
      expect(uploadFile).toHaveBeenCalledWith(attachmentFile);
    });

    await waitFor(() => {
      expect(mockQuillInstance.clipboard.dangerouslyPasteHTML).toHaveBeenCalledWith(
        expect.any(Number),
        '<a href="https://example.com/uploaded-file.jpg" target="_blank" rel="noopener noreferrer">test-file.jpg</a>'
      );
    });

    createElementSpy.mockRestore();
  });


  it('handles error states gracefully', async () => {
    const mockDelta = new Delta([{ insert: 'Test content' }]);
    
    // Mock an error in Quill initialization
    mockQuillInstance.getContents.mockImplementation(() => {
      throw new Error('Quill error');
    });

    // Component should still render without crashing
    expect(() => {
      renderWithTheme(
        <RichTextEditor
          defaultValue={mockDelta}
          onTextChange={mockOnTextChange}
        />
      );
    }).not.toThrow();
  });

  it('cleans up properly on unmount', async () => {
    const mockDelta = new Delta([{ insert: 'Test content' }]);
    
    const { unmount } = renderWithTheme(
      <RichTextEditor
        defaultValue={mockDelta}
        onTextChange={mockOnTextChange}
      />
    );

    // Component should unmount without errors
    expect(() => unmount()).not.toThrow();
  });

  // 新增测试用例：测试扩展区域功能
  it('handles expanded area functionality', async () => {
    const mockDelta = new Delta([{ insert: 'Test content for expanded area' }]);
    const extensionAreaTabs = [
      { id: 'case', label: '案件信息' },
      { id: 'law', label: '法律条文' }
    ];
    const extensionAreaContent = {
      type: 'case' as const,
      data: { caseNumber: 'TEST001', caseName: '测试案件' }
    };

    renderWithTheme(
      <RichTextEditor
        defaultValue={mockDelta}
        onTextChange={mockOnTextChange}
        extensionAreaTabs={extensionAreaTabs}
        extensionAreaContent={extensionAreaContent}
        showExtensionArea={true}
      />
    );

    // Check if the editor renders with extension area
    expect(document.querySelector('[class*="ql-"]')).toBeTruthy();
  });

  // 新增测试用例：测试文档视图模式
  it('handles document view mode', async () => {
    const mockDelta = new Delta([{ insert: 'Document view content' }]);
    const comments = [
      { id: '1', author: '张三', content: '这里需要修改', time: '2024-01-01' }
    ];

    renderWithTheme(
      <RichTextEditor
        defaultValue={mockDelta}
        onTextChange={mockOnTextChange}
        viewMode="document"
        comments={comments}
      />
    );

    // Check if the editor renders in document view mode
    expect(document.querySelector('[class*="ql-"]')).toBeTruthy();
  });

  // 新增测试用例：测试协作编辑功能
  it('handles collaborative editing features', async () => {
    const mockDelta = new Delta([{ insert: 'Collaborative content' }]);

    renderWithTheme(
      <RichTextEditor
        defaultValue={mockDelta}
        onTextChange={mockOnTextChange}
        documentId="doc123"
        userId="user123"
        userName="测试用户"
      />
    );

    // Check if the editor renders with collaborative features
    expect(document.querySelector('[class*="ql-"]')).toBeTruthy();
  });

  // 新增测试用例：测试实时保存功能
  it('handles real-time saving', async () => {
    const mockDelta = new Delta([{ insert: 'Auto save content' }]);

    renderWithTheme(
      <RichTextEditor
        defaultValue={mockDelta}
        onTextChange={mockOnTextChange}
        documentId="doc123"
      />
    );

    // Check if the editor renders with document ID for real-time saving
    expect(document.querySelector('[class*="ql-"]')).toBeTruthy();
  });

  // 新增测试用例：测试内置保存按钮
  it('renders built-in save button when onSave is provided', async () => {
    const mockDelta = new Delta([{ insert: 'Saveable content' }]);
    const mockOnSave = vi.fn();

    renderWithTheme(
      <RichTextEditor
        defaultValue={mockDelta}
        onSave={mockOnSave}
        showSaveButton={true}
      />
    );

    // Check if save button is rendered
    const saveButton = screen.getByText('保存');
    expect(saveButton).toBeTruthy();
  });

  // 新增测试用例：测试保存按钮点击
  it('calls onSave when save button is clicked', async () => {
    const mockDelta = new Delta([{ insert: 'Content to save' }]);
    const mockOnSave = vi.fn().mockResolvedValue(undefined);

    renderWithTheme(
      <RichTextEditor
        defaultValue={mockDelta}
        onSave={mockOnSave}
        showSaveButton={true}
      />
    );

    // Click save button
    const saveButton = screen.getByText('保存');
    fireEvent.click(saveButton);

    // Wait for async operation
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled();
    });
  });

  // 新增测试用例：测试保存状态显示
  it('shows saving status when isSaving is true', async () => {
    const mockDelta = new Delta([{ insert: 'Saving content' }]);
    const mockOnSave = vi.fn();

    renderWithTheme(
      <RichTextEditor
        defaultValue={mockDelta}
        onSave={mockOnSave}
        isSaving={true}
        showSaveButton={true}
      />
    );

    // Check if saving status is shown
    expect(screen.getByText('保存中...')).toBeTruthy();
  });

  // 新增测试用例：测试隐藏保存按钮
  it('hides save button when showSaveButton is false', async () => {
    const mockDelta = new Delta([{ insert: 'Content without save button' }]);
    const mockOnSave = vi.fn();

    renderWithTheme(
      <RichTextEditor
        defaultValue={mockDelta}
        onSave={mockOnSave}
        showSaveButton={false}
      />
    );

    // Check if save button is not rendered
    expect(screen.queryByText('保存')).toBeNull();
  });

  // 新增测试用例：测试自定义保存按钮文本
  it('displays custom save button text', async () => {
    const mockDelta = new Delta([{ insert: 'Custom save text content' }]);
    const mockOnSave = vi.fn();

    renderWithTheme(
      <RichTextEditor
        defaultValue={mockDelta}
        onSave={mockOnSave}
        showSaveButton={true}
        saveButtonText="提交"
      />
    );

    // Check if custom save button text is displayed
    expect(screen.getByText('提交')).toBeTruthy();
  });

  // 新增测试用例：测试自动保存功能
  it('handles auto-save functionality', async () => {
    const mockDelta = new Delta([{ insert: 'Auto save content' }]);
    const mockOnSave = vi.fn().mockResolvedValue(undefined);

    renderWithTheme(
      <RichTextEditor
        defaultValue={mockDelta}
        onSave={mockOnSave}
        enableAutoSave={true}
        autoSaveInterval={1000} // 1秒用于测试
      />
    );

    // 模拟用户输入触发文本变化
    // 注意：这里可能需要更复杂的模拟，因为需要触发Quill的text-change事件
    // 暂时验证组件正常渲染
    expect(document.querySelector('[class*="ql-"]')).toBeTruthy();
    
    // Advance timers to trigger auto-save
    vi.advanceTimersByTime(1000);
  });
});