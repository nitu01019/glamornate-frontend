interface CurtainRevealBadgeProps {
  readonly label: string;
  readonly className?: string;
  readonly curtainClassName?: string;
}

/**
 * Static "Most Booked" badge with a decorative pink curtain that periodically
 * slides over the label and wipes up to reveal it again.
 *
 * - Label text is always rendered (no re-render cycling, no text jitter).
 * - Curtain is an absolutely-positioned overlay clipped by the parent's
 *   `overflow-hidden`, so it cannot bleed into sibling rows.
 * - Curtain is `aria-hidden` and `pointer-events-none` — purely decorative.
 * - Respects `prefers-reduced-motion` via the CSS override on
 *   `.animate-curtain-up` in `globals.css`.
 *
 * See docs/plans/investigations/round3/p1-a4-curtain-animation.md.
 */
export function CurtainRevealBadge({
  label,
  className,
  curtainClassName,
}: CurtainRevealBadgeProps) {
  const wrapperClass = [
    'relative inline-flex items-center gap-1 overflow-hidden',
    'rounded-md bg-brand-pink-200/80 px-2 py-0.5',
    'text-[10px] font-semibold uppercase tracking-wider text-brand-maroon-700',
    className ?? '',
  ]
    .join(' ')
    .trim();

  const curtainClass = [
    'pointer-events-none absolute inset-0 z-10',
    'bg-brand-pink-300 animate-curtain-up',
    curtainClassName ?? '',
  ]
    .join(' ')
    .trim();

  return (
    <span className={wrapperClass}>
      <span className="relative z-0">{label}</span>
      <span aria-hidden="true" className={curtainClass} />
    </span>
  );
}

export default CurtainRevealBadge;
