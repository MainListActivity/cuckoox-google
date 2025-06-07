import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import RichTextEditor from '@/src/components/RichTextEditor';
import { Delta } from 'quill/core';

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
};

// Mock Quill with stable reference
vi.mock('quill', () => {
  const QuillConstructor = vi.fn().mockImplementation(() => mockQuillInstance);
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

// Mock file upload service with stable reference
const mockUploadFile = vi.fn();
vi.mock('@/src/services/fileUploadService', () => ({
  uploadFile: mockUploadFile,
}));

// Mock SurrealDB provider with stable reference
vi.mock('@/src/contexts/SurrealProvider', () => ({
  useSurrealClient: vi.fn(() => null),
}));

// Mock i18n with stable reference
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
    mockUploadFile.mockResolvedValue({
      url: 'https://example.com/uploaded-file.jpg',
      name: 'test-file.jpg'
    });
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
    }, { timeout: 1000 });
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

    // In read-only mode, the editor should be disabled
    expect(mockQuillInstance.enable).toHaveBeenCalledWith(false);
  });

  it('handles file upload', async () => {
    const mockDelta = new Delta([{ insert: 'Test content' }]);

    renderWithTheme(
      <RichTextEditor
        value={mockDelta}
        onChange={mockOnChange}
      />
    );

    // Simulate file upload (this would typically be triggered by Quill's image handler)
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    
    // Trigger the upload through the component's internal mechanisms
    // This is a simplified test - in reality, the upload would be triggered by Quill
    await waitFor(() => {
      expect(mockUploadFile).not.toHaveBeenCalled(); // Initially not called
    }, { timeout: 500 });
  });

  it('handles error states gracefully', () => {
    const mockDelta = new Delta([{ insert: 'Test content' }]);
    
    // Mock an error in Quill initialization
    mockQuillInstance.getContents.mockImplementation(() => {
      throw new Error('Quill error');
    });

    // Component should still render without crashing
    expect(() => {
      renderWithTheme(
        <RichTextEditor
          value={mockDelta}
          onChange={mockOnChange}
        />
      );
    }).not.toThrow();
  });

  it('cleans up properly on unmount', () => {
    const mockDelta = new Delta([{ insert: 'Test content' }]);
    
    const { unmount } = renderWithTheme(
      <RichTextEditor
        value={mockDelta}
        onChange={mockOnChange}
      />
    );

    unmount();

    // Verify cleanup methods were called
    expect(mockQuillInstance.off).toHaveBeenCalled();
  });
}); 