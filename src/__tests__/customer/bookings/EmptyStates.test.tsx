/**
 * Phase 4.5 / Patch DR-6 (Booking Flow Fix v3.1, 2026-05-02): regression
 * tests for the bookings empty-state matrix. Covers all 12 non-loading
 * cells (4 states × 3 tabs) so any council-approved copy drift is caught
 * at PR time rather than after deploy.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '../../../app/customer/bookings/_components/EmptyState';
import {
  EMPTY_UPCOMING,
  EMPTY_PAST,
  EMPTY_CANCELLED,
  APP_CHECK_HELP_TITLE,
  APP_CHECK_HELP_BODY,
  LINK_ACCOUNTS_TITLE,
  LINK_ACCOUNTS_BODY,
  SUBMIT_GENERIC_ERROR,
} from '../../../lib/booking/copy';

const TABS = ['upcoming', 'past', 'cancelled'] as const;

const EMPTY_COPY: Record<(typeof TABS)[number], string> = {
  upcoming: EMPTY_UPCOMING,
  past: EMPTY_PAST,
  cancelled: EMPTY_CANCELLED,
};

describe('EmptyState matrix (Patch DR-6)', () => {
  describe('state=empty_ok', () => {
    for (const tab of TABS) {
      it(`tab=${tab} renders the canonical empty copy`, () => {
        render(<EmptyState tab={tab} state="empty_ok" />);
        expect(screen.getByText(EMPTY_COPY[tab])).toBeInTheDocument();
      });
    }

    it('tab=upcoming renders a "Book a service" link to /spas', () => {
      render(<EmptyState tab="upcoming" state="empty_ok" />);
      const link = screen.getByRole('link', { name: /book a service/i });
      expect(link).toHaveAttribute('href', '/spas');
    });

    it('tab=past has no CTA link', () => {
      render(<EmptyState tab="past" state="empty_ok" />);
      expect(screen.queryByRole('link', { name: /book a service/i })).toBeNull();
    });

    it('tab=cancelled has no CTA link', () => {
      render(<EmptyState tab="cancelled" state="empty_ok" />);
      expect(screen.queryByRole('link', { name: /book a service/i })).toBeNull();
    });
  });

  describe('state=empty_unlinked', () => {
    for (const tab of TABS) {
      it(`tab=${tab} renders the unlinked banner ABOVE the empty copy`, () => {
        render(<EmptyState tab={tab} state="empty_unlinked" />);
        expect(screen.getByText(LINK_ACCOUNTS_TITLE)).toBeInTheDocument();
        expect(screen.getByText(LINK_ACCOUNTS_BODY)).toBeInTheDocument();
        expect(screen.getByText(EMPTY_COPY[tab])).toBeInTheDocument();
        const linkAccountsCta = screen.getByRole('link', { name: /link accounts/i });
        expect(linkAccountsCta).toHaveAttribute('href', '/customer/account/link');
      });
    }
  });

  describe('state=error_app_check', () => {
    for (const tab of TABS) {
      it(`tab=${tab} renders App Check help with role=alert`, () => {
        const onRetry = vi.fn();
        render(<EmptyState tab={tab} state="error_app_check" onRetry={onRetry} />);
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(screen.getByText(APP_CHECK_HELP_TITLE)).toBeInTheDocument();
        expect(screen.getByText(APP_CHECK_HELP_BODY)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /get help/i })).toHaveAttribute(
          'href',
          '/help#app-check',
        );
      });
    }
  });

  describe('state=error_other', () => {
    for (const tab of TABS) {
      it(`tab=${tab} renders generic error with role=alert + retry`, () => {
        const onRetry = vi.fn();
        render(<EmptyState tab={tab} state="error_other" onRetry={onRetry} />);
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(screen.getByText(SUBMIT_GENERIC_ERROR)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      });
    }
  });
});
