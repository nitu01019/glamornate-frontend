import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mock useCategories so we can drive the component's error/fetching states
// deterministically without a React Query provider.
// ---------------------------------------------------------------------------

interface CategoriesHookResult {
  data: unknown;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  refetch: () => void;
}

const hookResult: CategoriesHookResult = {
  data: undefined,
  isLoading: false,
  isFetching: false,
  isError: false,
  refetch: () => undefined,
};

vi.mock('@/hooks/useHomeData', () => ({
  useCategories: () => hookResult,
}));

const loadGrid = async () => (await import('../NewCategoriesGrid')).default;

describe('NewCategoriesGrid', () => {
  beforeEach(() => {
    hookResult.data = undefined;
    hookResult.isLoading = false;
    hookResult.isFetching = false;
    hookResult.isError = false;
  });

  it('renders a single Retry button when isError && !isFetching', async () => {
    hookResult.isError = true;
    hookResult.isFetching = false;

    const Grid = await loadGrid();
    render(<Grid />);

    const retryButtons = screen.getAllByRole('button', { name: /retry/i });
    expect(retryButtons).toHaveLength(1);
  });

  it('hides the Retry button while a fetch is in-flight (no flashing)', async () => {
    hookResult.isError = true;
    hookResult.isFetching = true;

    const Grid = await loadGrid();
    render(<Grid />);

    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  it('renders the skeleton during initial loading (no timer-based flip)', async () => {
    hookResult.isLoading = true;

    const Grid = await loadGrid();
    const { container } = render(<Grid />);

    // No Retry button visible during the initial load.
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    // Skeleton is rendered in place of the real grid heading.
    expect(container.querySelector('h2')).toBeNull();
  });

  it('renders the heading and no Retry when data is loaded successfully', async () => {
    hookResult.data = [];

    const Grid = await loadGrid();
    render(<Grid />);

    expect(screen.getByText(/explore our categories/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });
});
