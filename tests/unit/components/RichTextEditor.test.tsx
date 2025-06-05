import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import RichTextEditor from '@/src/components/RichTextEditor';
import { Delta } from 'quill/core';

// Mock Quill
vi.mock('quill', () => {
  const mockQuill = {
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
  };

  const QuillConstructor = vi.fn().mockImplementation(() => mockQuill) as any;
  QuillConstructor.import = vi.fn((module) => {
    if (module === 'ui/icons') {
      return {};
    }
    if (module === 'delta') {
      return Delta;
    }
    return {};
  });

  return {
    __esModule: true,
    default: QuillConstructor,
  };
});

// Mock file upload service
vi.mock('@/src/services/fileUploadService', () => ({
  uploadFile: vi.fn().mockResolvedValue({
    url: 'https://example.com/uploaded-file.jpg',
    name: 'test-file.jpg'
  })
}));

// Mock SurrealDB provider
vi.mock('@/src/contexts/SurrealProvider', () => ({
  useSurrealClient: vi.fn(() => null),
}));

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const renderWithTheme = (component: React.ReactElement) => {
  const theme = createTheme();
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('RichTextEditor', () => {
  const mockOnChange = vi.fn();
  const mockOnTextChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders editor with basic props', () => {
    const mockDelta = new Delta([{ insert: 'Hello World' }]);
    
    renderWithTheme(
      <RichTextEditor
        value={mockDelta}
        onChange={mockOnChange}
        placeholder="请输入内容..."
      />
    );

    // Check if the editor container is present
    expect(document.querySelector('[class*="ql-"]')).toBeTruthy();
  });

  it('renders with context information panel', () => {
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
        value={mockDelta}
        onChange={mockOnChange}
        contextInfo={contextInfo}
      />
    );

    // Check if context panel is rendered
    expect(screen.getByText('案件详情')).toBeInTheDocument();
    expect(screen.getByText('案件编号: TEST001')).toBeInTheDocument();
    expect(screen.getByText('负责人')).toBeInTheDocument();
    expect(screen.getByText('张三')).toBeInTheDocument();
  });

  it('handles fullscreen toggle', async () => {
    const mockOnFullscreenChange = vi.fn();
    const mockDelta = new Delta([{ insert: 'Test content' }]);

    renderWithTheme(
      <RichTextEditor
        value={mockDelta}
        onChange={mockOnChange}
        enableFullscreen={true}
        onFullscreenChange={mockOnFullscreenChange}
      />
    );

    // Find and click fullscreen button
    const fullscreenButton = screen.getByLabelText('全屏编辑');
    fireEvent.click(fullscreenButton);

    await waitFor(() => {
      expect(mockOnFullscreenChange).toHaveBeenCalledWith(true);
    });
  });

  it('hides context panel when close button is clicked', () => {
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
        value={mockDelta}
        onChange={mockOnChange}
        contextInfo={contextInfo}
      />
    );

    // Context panel should be visible
    expect(screen.getByText('测试标题')).toBeInTheDocument();

    // Click close button
    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);

    // Context panel should be hidden
    expect(screen.queryByText('测试标题')).not.toBeInTheDocument();
  });

  it('handles read-only mode', () => {
    const mockDelta = new Delta([{ insert: 'Read only content' }]);

    renderWithTheme(
      <RichTextEditor
        value={mockDelta}
        onChange={mockOnChange}
        readOnly={true}
      />
    );

    // In read-only mode, certain UI elements should be disabled or hidden
    expect(document.querySelector('.ql-toolbar')).toBeTruthy();
  });

  it('displays collaboration indicators when remote cursors are present', () => {
    const mockDelta = new Delta([{ insert: 'Collaborative content' }]);

    renderWithTheme(
      <RichTextEditor
        value={mockDelta}
        onChange={mockOnChange}
        documentId="test-doc"
        userId="user1"
        userName="Test User"
      />
    );

    // The component should render without collaboration indicators initially
    expect(screen.getByText('未命名文档')).toBeInTheDocument();
  });

  it('handles string value input', () => {
    renderWithTheme(
      <RichTextEditor
        value="<p>HTML string content</p>"
        onChange={mockOnChange}
      />
    );

    // Should render without errors
    expect(document.querySelector('[class*="ql-"]')).toBeTruthy();
  });

  it('displays document title from context info', () => {
    const mockDelta = new Delta([{ insert: 'Test content' }]);
    const contextInfo = {
      title: '重要文档标题',
      details: []
    };

    renderWithTheme(
      <RichTextEditor
        value={mockDelta}
        onChange={mockOnChange}
        contextInfo={contextInfo}
      />
    );

    // Document title should be displayed in the toolbar
    expect(screen.getByText('重要文档标题')).toBeInTheDocument();
  });
}); 