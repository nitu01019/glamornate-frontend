import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import type { UserLocation } from '@/lib/location-provider';

// ---------------------------------------------------------------------------
// Mocks — configured per-test via mutable state objects.
// ---------------------------------------------------------------------------

interface LocationState {
  location: UserLocation | null;
}

const locationState: LocationState = {
  location: null,
};

vi.mock('@/lib/location-provider', () => ({
  useLocation: () => locationState,
}));

const pickerOpenState = { lastIsOpen: false };

vi.mock('@/components/home/LocationPicker', () => ({
  default: ({ isOpen }: { isOpen: boolean; onClose: () => void }) => {
    pickerOpenState.lastIsOpen = isOpen;
    return isOpen ? <div data-testid="location-picker-sheet" /> : null;
  },
}));

const loadTrigger = async () => {
  const mod = await import('../InlineLocationTrigger');
  return mod.default;
};

async function renderTrigger() {
  const InlineLocationTrigger = await loadTrigger();
  await act(async () => {
    render(<InlineLocationTrigger />);
  });
}

describe('InlineLocationTrigger', () => {
  beforeEach(() => {
    cleanup();
    locationState.location = null;
    pickerOpenState.lastIsOpen = false;
  });

  it('shows "Set location" label when no location is set', async () => {
    locationState.location = null;
    await renderTrigger();

    const trigger = screen.getByTestId('inline-location-trigger');
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent('Set location');
    expect(trigger).toHaveAttribute('aria-label', 'Set your location');
  });

  it('shows the city name when location is set', async () => {
    locationState.location = {
      lat: 32.7266,
      lng: 74.857,
      city: 'Jammu',
      area: 'Gandhi Nagar',
      fullAddress: 'Gandhi Nagar, Jammu',
    };
    await renderTrigger();

    const trigger = screen.getByTestId('inline-location-trigger');
    expect(trigger).toHaveTextContent('Jammu');
    expect(trigger).toHaveAttribute('aria-label', 'Change location (currently Jammu)');
  });

  it('opens the LocationPicker sheet when tapped', async () => {
    locationState.location = null;
    await renderTrigger();

    const trigger = screen.getByTestId('inline-location-trigger');
    expect(screen.queryByTestId('location-picker-sheet')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(trigger);
    });

    expect(screen.getByTestId('location-picker-sheet')).toBeInTheDocument();
    expect(pickerOpenState.lastIsOpen).toBe(true);
  });
});
