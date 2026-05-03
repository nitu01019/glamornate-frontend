import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks — declared before the component import so the module graph resolves
// them. Mirrors the pattern used by HeroBannerCarousel.test.tsx.
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

// next/image → plain <img> so jsdom can render without the real optimizer.
// Mirror priority + loading onto data-attributes so tests can assert LCP hints.
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { priority, fill, sizes, loading, ...rest } = props as Record<string, unknown>;
    const dataAttrs: Record<string, string> = {};
    if (priority) dataAttrs['data-priority'] = 'true';
    if (loading) dataAttrs['data-loading'] = String(loading);
    void fill;
    void sizes;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} {...dataAttrs} />;
  },
}));

const loadCarousel = async () => (await import('../HomeHeroCarousel')).default;

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

describe('HomeHeroCarousel', () => {
  beforeEach(() => {
    addItem.mockClear();
    push.mockClear();
    toastSuccess.mockClear();
    toastError.mockClear();
    setMatchMedia(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders one slide per HERO_BANNER_SLIDES entry and the expected dot count', async () => {
    const Carousel = await loadCarousel();
    render(<Carousel />);

    expect(screen.getAllByTestId('home-hero-slide')).toHaveLength(6);
    expect(screen.getAllByRole('button', { name: /go to slide \d+/i })).toHaveLength(6);
  });

  it('renders image-only slides — no painted-on title, subtitle, or "Featured Facial" text', async () => {
    const Carousel = await loadCarousel();
    render(<Carousel />);

    for (const slide of screen.getAllByTestId('home-hero-slide')) {
      expect(slide.querySelector('h1')).toBeNull();
      expect(slide.querySelector('h2')).toBeNull();
      expect(slide.querySelector('h3')).toBeNull();
      expect(slide.querySelector('p')).toBeNull();
    }

    const hero = screen.getByTestId('home-hero');
    expect(hero.textContent ?? '').not.toMatch(/Featured Facial/i);
    expect(hero.textContent ?? '').not.toMatch(/From ₹/);
    // Subtitles must not appear on the image.
    expect(hero.textContent ?? '').not.toMatch(/Radiant wine-infused glow/i);
  });

  it('only the first slide has priority; subsequent slides lazy-load', async () => {
    const Carousel = await loadCarousel();
    render(<Carousel />);

    const slides = screen.getAllByTestId('home-hero-slide');
    const images = slides.map((slide) => slide.querySelector('img'));

    expect(images[0]?.getAttribute('data-priority')).toBe('true');
    expect(images[0]?.getAttribute('data-loading')).toBeNull();

    for (let i = 1; i < images.length; i += 1) {
      expect(images[i]?.getAttribute('data-priority')).toBeNull();
      expect(images[i]?.getAttribute('data-loading')).toBe('lazy');
    }
  });

  it('compact Add-to-Cart chip sits at bottom-right and only appears on the active slide', async () => {
    const Carousel = await loadCarousel();
    render(<Carousel />);

    const chips = screen.getAllByTestId('home-hero-add-to-cart');
    expect(chips).toHaveLength(1);

    const chip = chips[0];
    const wrapper = chip.parentElement;
    expect(wrapper?.className).toMatch(/absolute/);
    expect(wrapper?.className).toMatch(/bottom-5/);
    expect(wrapper?.className).toMatch(/right-5/);
    expect(chip.className).toMatch(/min-h-\[44px\]/);
    expect(chip.className).toMatch(/min-w-\[44px\]/);
  });

  it('clicking the active Add-to-Cart chip adds an item + toasts + navigates to facials', async () => {
    const Carousel = await loadCarousel();
    render(<Carousel />);

    const chip = screen.getByRole('button', {
      name: /add astaberry wine facial to cart/i,
    });
    fireEvent.click(chip);

    expect(addItem).toHaveBeenCalledTimes(1);
    const payload = addItem.mock.calls[0][0];
    expect(payload).toMatchObject({ serviceName: 'Astaberry Wine Facial' });
    expect(payload.serviceId).toMatch(/^svc-\d+$/);
    expect(typeof payload.price).toBe('number');
    expect(payload.duration).toBeGreaterThan(0);

    expect(toastSuccess).toHaveBeenCalledWith('Added to cart', 'Astaberry Wine Facial');
    expect(push).toHaveBeenCalledWith('/services/category/facials');
  });

  it('tapping the body (not the chip) routes to facials anchor without a cart side-effect', async () => {
    const Carousel = await loadCarousel();
    render(<Carousel />);

    const body = screen.getAllByRole('button', {
      name: /view astaberry wine facial in facials/i,
    })[0];
    fireEvent.click(body);

    expect(addItem).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][0]).toMatch(/^\/services\/category\/facials#svc-\d+$/);
  });

  it('ArrowRight / ArrowLeft cycle the active slide', async () => {
    const Carousel = await loadCarousel();
    render(<Carousel />);

    const hero = screen.getByTestId('home-hero');
    // First slide active → chip aria-label references its title.
    expect(
      screen.getByRole('button', { name: /add astaberry wine facial to cart/i }),
    ).toBeInTheDocument();

    fireEvent.keyDown(hero, { key: 'ArrowRight' });

    expect(screen.queryByRole('button', { name: /add astaberry wine facial to cart/i })).toBeNull();
    // Index 1 is the Aroma Magic Fruit Facial.
    expect(
      screen.getByRole('button', { name: /add aroma magic fruit facial to cart/i }),
    ).toBeInTheDocument();

    fireEvent.keyDown(hero, { key: 'ArrowLeft' });
    expect(
      screen.getByRole('button', { name: /add astaberry wine facial to cart/i }),
    ).toBeInTheDocument();
  });

  it('prefers-reduced-motion disables autoplay — active slide does not advance on interval', async () => {
    setMatchMedia(true);
    vi.useFakeTimers();

    const Carousel = await loadCarousel();
    render(<Carousel />);

    expect(
      screen.getByRole('button', { name: /add astaberry wine facial to cart/i }),
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    // Still on the first slide (no auto-rotate while reduced motion is on).
    expect(
      screen.getByRole('button', { name: /add astaberry wine facial to cart/i }),
    ).toBeInTheDocument();
  });

  it('hovering the hero pauses autoplay', async () => {
    vi.useFakeTimers();
    const Carousel = await loadCarousel();
    render(<Carousel />);

    const hero = screen.getByTestId('home-hero');

    fireEvent.mouseEnter(hero);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    // Paused on hover → still on first slide.
    expect(
      screen.getByRole('button', { name: /add astaberry wine facial to cart/i }),
    ).toBeInTheDocument();
  });

  it('exposes carousel semantics: role=region, aria-roledescription=carousel, aria-label', async () => {
    const Carousel = await loadCarousel();
    render(<Carousel />);
    const hero = screen.getByTestId('home-hero');
    expect(hero.getAttribute('role')).toBe('region');
    expect(hero.getAttribute('aria-roledescription')).toBe('carousel');
    expect(hero.getAttribute('aria-label')).toBe('Featured facials');
  });
});
