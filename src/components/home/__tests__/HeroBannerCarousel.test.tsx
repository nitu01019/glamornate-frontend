import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks — declared before component import so the module resolves them.
// ---------------------------------------------------------------------------

const addItem = vi.fn();
const push = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('@/store/cart', () => ({
  useCartStore: (selector: (state: { addItem: typeof addItem }) => unknown) =>
    selector({ addItem }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, back: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/lib/providers', () => ({
  useToastActions: () => ({
    success: toastSuccess,
    error: toastError,
    warning: vi.fn(),
    info: vi.fn(),
  }),
}));

// next/image → plain <img> so jsdom can render without a real optimizer.
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { priority, fill, sizes, ...rest } = props as Record<string, unknown>;
    void priority;
    void fill;
    void sizes;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
}));

const loadCarousel = async () =>
  (await import('../HeroBannerCarousel')).default;

function setMatchMedia(prefersReduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: prefersReduced && query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

describe('HeroBannerCarousel', () => {
  beforeEach(() => {
    addItem.mockClear();
    push.mockClear();
    toastSuccess.mockClear();
    toastError.mockClear();
    setMatchMedia(false);
  });

  it('renders all 6 banner slides', async () => {
    const Carousel = await loadCarousel();
    render(<Carousel />);

    // Each slide has a dot indicator button.
    expect(
      screen.getAllByRole('button', { name: /go to slide \d+/i }),
    ).toHaveLength(6);

    // Active slide's title is present.
    expect(screen.getByText('Astaberry Wine Facial')).toBeInTheDocument();
  });

  it('CTA click on first slide adds Astaberry Wine Facial and navigates', async () => {
    const Carousel = await loadCarousel();
    render(<Carousel />);

    const cta = screen.getByRole('button', {
      name: /add astaberry wine facial to cart/i,
    });
    fireEvent.click(cta);

    expect(addItem).toHaveBeenCalledTimes(1);
    const payload = addItem.mock.calls[0][0];
    expect(payload).toMatchObject({
      serviceName: 'Astaberry Wine Facial',
    });
    expect(payload.serviceId).toMatch(/^svc-\d+$/);
    expect(typeof payload.price).toBe('number');
    expect(payload.duration).toBeGreaterThan(0);

    expect(toastSuccess).toHaveBeenCalledWith(
      'Added to cart',
      'Astaberry Wine Facial',
    );
    expect(push).toHaveBeenCalledWith('/services/category/facials');
  });

  it('tapping banner body (not CTA) navigates to facials anchor without cart side-effect', async () => {
    const Carousel = await loadCarousel();
    render(<Carousel />);

    const bodyButton = screen.getByRole('button', {
      name: /view astaberry wine facial in facials/i,
    });
    fireEvent.click(bodyButton);

    expect(addItem).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][0]).toMatch(/^\/services\/category\/facials#svc-\d+$/);
  });

  it('respects prefers-reduced-motion (no autoplay-driven state change)', async () => {
    setMatchMedia(true);
    vi.useFakeTimers();
    const Carousel = await loadCarousel();
    render(<Carousel />);

    const firstTitle = screen.getByText('Astaberry Wine Facial');
    expect(firstTitle).toBeInTheDocument();

    // Advance well past an autoplay cycle — nothing should auto-rotate.
    vi.advanceTimersByTime(10_000);
    expect(screen.getByText('Astaberry Wine Facial')).toBeInTheDocument();
    vi.useRealTimers();
  });
});
