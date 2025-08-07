import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { createTheme } from '@mui/material/styles';
// Mock SurrealProvider
const MockSurrealProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div data-testid="mock-surreal-provider">{children}</div>;
};

// Create a test theme
const testTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
  },
});

// Create a test query client
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
    mutations: {
      retry: false,
    },
  },
});

interface AllTheProvidersProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
  initialEntries?: string[];
}

const AllTheProviders: React.FC<AllTheProvidersProps> = ({
  children,
  queryClient = createTestQueryClient(),
  initialEntries = ['/']
}) => {
  // Create a fresh queryClient for each test to avoid state leakage
  const testQueryClient = React.useMemo(() => queryClient || createTestQueryClient(), [queryClient]);
  
  // Use a unique key to ensure complete provider isolation
  const uniqueKey = React.useMemo(() => `test-${Date.now()}-${Math.random()}`, []);
  
  return (
    <BrowserRouter key={uniqueKey}>
      <QueryClientProvider client={testQueryClient}>
        <ThemeProvider theme={testTheme}>
          <MockSurrealProvider>
            {children}
          </MockSurrealProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
  initialEntries?: string[];
}

const customRender = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { queryClient, initialEntries, ...renderOptions } = options;
  
  // Ensure we have a clean container for each test
  const container = document.createElement('div');
  document.body.appendChild(container);

  return render(ui, {
    container,
    wrapper: ({ children }) => (
      <AllTheProviders
        queryClient={queryClient}
        initialEntries={initialEntries}
      >
        {children}
      </AllTheProviders>
    ),
    ...renderOptions,
  });
};

// Mock react-i18next
export const mockUseTranslation = () => ({
  t: (key: string, fallback?: string) => fallback || key,
  i18n: {
    changeLanguage: vi.fn(),
    language: 'zh-CN',
  },
});

// Mock react-router-dom hooks
export const mockUseNavigate = vi.fn();
export const mockUseLocation = vi.fn(() => ({
  pathname: '/',
  search: '',
  hash: '',
  state: null,
}));
export const mockUseParams = vi.fn(() => ({}));

// Helper to wait for async operations
export const waitForAsyncOperations = () => new Promise(resolve => setTimeout(resolve, 0));

// Helper to create mock RecordId
export const createMockRecordId = (table: string, id: string) => ({
  tb: table,
  id: { String: id },
  toString: () => `${table}:${id}`,
});

// Export everything from testing-library
export * from '@testing-library/react';
export { customRender as render };