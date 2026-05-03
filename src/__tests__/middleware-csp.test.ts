/**
 * Regression test (Patch SB-5): assert the built CSP header contains zero
 * references to Stripe domains after the Phase 1 Stripe removal.
 *
 * The CSP-building logic is exported from `middleware.ts` as `buildCsp`
 * specifically so this test can call it directly without booting a full
 * Edge runtime.
 */
import { describe, it, expect } from 'vitest';
import { buildCsp } from '../middleware';

describe('CSP regression (Patch SB-5)', () => {
  it('production CSP contains no stripe.com references', () => {
    const csp = buildCsp('test-nonce', false);
    expect(csp).not.toMatch(/stripe\.com/i);
    expect(csp).not.toMatch(/js\.stripe/i);
    expect(csp).not.toMatch(/api\.stripe/i);
  });

  it('development CSP contains no stripe.com references', () => {
    const csp = buildCsp('test-nonce', true);
    expect(csp).not.toMatch(/stripe\.com/i);
    expect(csp).not.toMatch(/js\.stripe/i);
    expect(csp).not.toMatch(/api\.stripe/i);
  });

  it('CSP retains required Firebase and Google directives', () => {
    const csp = buildCsp('test-nonce', false);
    // Sanity: the rest of the CSP must still be intact.
    expect(csp).toMatch(/firebaseio\.com/);
    expect(csp).toMatch(/googleapis\.com/);
    expect(csp).toMatch(/accounts\.google\.com/);
    expect(csp).toMatch(/recaptcha|gstatic|google\.com/);
  });

  it('CSP embeds the supplied nonce', () => {
    const csp = buildCsp('abc-xyz-123', false);
    expect(csp).toContain("'nonce-abc-xyz-123'");
  });
});
