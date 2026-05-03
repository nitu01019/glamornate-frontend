/**
 * Asserts that cart/validate is a true alias of cart/preview.
 * If they ever diverge, this test fails — file a follow-up ticket
 * to either re-converge or formally split semantics.
 */
import { describe, it, expect } from 'vitest';

describe('cart routes dedup', () => {
  it('cart/validate re-exports POST from cart/preview', async () => {
    const previewMod = await import('../preview/route');
    const validateMod = await import('../validate/route');
    expect(validateMod.POST).toBe(previewMod.POST);
  });
});
