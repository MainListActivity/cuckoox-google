import React from 'react';
import { screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '../utils/testUtils';
import RichTextEditor from '@/src/components/RichTextEditor';
import { Delta } from 'quill/core';
import {mdiAccount, mdiCalendar, mdiFileDocument, mdiInformation} from "@mdi/js";

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

// Mock file upload service
vi.mock('@/src/services/fileUploadService', () => ({
  uploadFile: vi.fn(),
}));

// 扩展区域标签页定义
const extensionAreaTabs = [
  { id: 'case', label: '案件信息', icon: mdiInformation },
  { id: 'timeline', label: '案件时间线', icon: mdiCalendar },
  { id: 'members', label: '案件成员', icon: mdiAccount },
  { id: 'related_docs', label: '相关文档', icon: mdiFileDocument },
];

// 创建稳定的 mock SurrealDB 客户端引用
const mockSurrealClient = {
  status: 'disconnected' as const,
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
  useSurrealContext: vi.fn(() => ({
    client: mockSurrealClient,
    isConnected: false,
  })),
}));

// 创建稳定的 mock 函数引用
const mockT = vi.fn((key: string) => key);

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockT,
  }),
}));

// Mock Quill - 简化版，避免复杂的交互
vi.mock('quill', () => {
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
      parentNode: typeof document !== 'undefined' ? document.createElement('div') : {},
    },
    on: vi.fn(),
    off: vi.fn(),
    hasFocus: vi.fn(() => false),
    getModule: vi.fn(() => ({ addHandler: vi.fn() })),
    clipboard: {
      dangerouslyPasteHTML: vi.fn(),
    },
  };
  
  const QuillConstructor = vi.fn(() => mockQuillInstance);
  
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

// Remove renderWithTheme as we now use testUtils

describe('RichTextEditor', () => {
  // 创建稳定的 props 引用，避免每次渲染时创建新对象
  const mockOnTextChange = vi.fn();
  const stableExtensionAreaTabs = extensionAreaTabs;
  const stableMockDelta = new Delta([{ insert: 'Hello World' }]);

  beforeEach(async () => {
    // 重置所有 mock 函数，但保持对象引用稳定
    vi.clearAllMocks();
    
    // 重置 mock T 函数
    mockT.mockImplementation((key: string) => key);
    
    // 重置稳定的 mock 函数
    mockOnTextChange.mockClear();
    
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
    render(
      <RichTextEditor
        extensionAreaTabs={stableExtensionAreaTabs}
        showExtensionArea={false}
        defaultValue={stableMockDelta}
        onTextChange={mockOnTextChange}
        placeholder="请输入内容..."
        documentId="test"
        userId="test"
        userName="test"
        enableAutoSave={true}
        autoSaveInterval={10000}
        showSaveButton={true}
        saveButtonText="保存文档"
      />
    );

    // Check if the editor container is present
    expect(document.querySelector('[class*="ql-"]')).toBeTruthy();
  });

  it('renders with context information panel', async () => {
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

    render(
      <RichTextEditor
        defaultValue={stableMockDelta}
        onTextChange={mockOnTextChange}
        contextInfo={contextInfo}
      />
    );

    // Check if context panel is rendered
    expect(screen.getByText('案件编号: TEST001')).toBeInTheDocument();
    expect(screen.getByText('负责人')).toBeInTheDocument();
    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.getByText('创建时间')).toBeInTheDocument();
    expect(screen.getByText('2024-01-01')).toBeInTheDocument();
  });

  it('handles read-only mode', async () => {
    render(
      <RichTextEditor
        defaultValue={stableMockDelta}
        onTextChange={mockOnTextChange}
        readOnly={true}
      />
    );

    // Check if the editor container is present
    expect(document.querySelector('[class*="ql-"]')).toBeTruthy();
  });

  it('renders built-in save button when onSave is provided', async () => {
    const mockOnSave = vi.fn();

    render(
      <RichTextEditor
        defaultValue={stableMockDelta}
        onSave={mockOnSave}
        showSaveButton={true}
      />
    );

    // Check if save button is rendered
    const saveButton = screen.getByText('save');
    expect(saveButton).toBeTruthy();
  });

  it('shows saving status when isSaving is true', async () => {
    const mockOnSave = vi.fn();

    render(
      <RichTextEditor
        defaultValue={stableMockDelta}
        onSave={mockOnSave}
        isSaving={true}
        showSaveButton={true}
      />
    );

    // Check if saving status is shown
    expect(screen.getByText('saving')).toBeTruthy();
  });

  it('displays custom save button text', async () => {
    const mockOnSave = vi.fn();

    render(
      <RichTextEditor
        defaultValue={stableMockDelta}
        onSave={mockOnSave}
        showSaveButton={true}
        saveButtonText="提交"
      />
    );

    // Check if custom save button text is displayed
    expect(screen.getByText('提交')).toBeTruthy();
  });
});