'use client'

import { create } from 'zustand'

const STORAGE_KEY = 'glamornate-popup-seen'
// Delay before the promo popup auto-opens. The popup is a bottom-sheet that
// covers up to 70vh and an opaque backdrop at z-[70] — while it is open every
// category card / CTA on the home page becomes untappable until the user
// finds the close (X) button. Auto-opening it 2 seconds after page load was
// actively hostile to the primary flow (see S2 baseline evidence), so we now
// require an explicit trigger via `openPopup`.
// Kept as a named constant for future engagement-based triggers.
const POPUP_DELAY_MS = 2000

interface PopupStore {
  showPopup: boolean
  hasSeenPopup: boolean
  dismissPopup: () => void
  openPopup: () => void
  checkAndShowPopup: () => void
}

export const usePopupStore = create<PopupStore>()((set) => ({
  showPopup: false,
  hasSeenPopup: false,

  dismissPopup: () => {
    set({ showPopup: false, hasSeenPopup: true })
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(STORAGE_KEY, 'true')
      } catch {
        // sessionStorage may be unavailable (e.g. private browsing quota)
      }
    }
  },

  openPopup: () => {
    if (typeof window === 'undefined') return

    let seen = false
    try {
      seen = sessionStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      // sessionStorage may be unavailable
    }

    if (seen) {
      set({ hasSeenPopup: true, showPopup: false })
      return
    }

    setTimeout(() => {
      set((state) => {
        if (state.hasSeenPopup) return state
        return { showPopup: true }
      })
    }, POPUP_DELAY_MS)
  },

  // Preserved for backwards compatibility with `PopupManager`. Intentionally a
  // no-op: the promo popup no longer auto-opens on page mount because doing so
  // blocks all primary CTAs on the home screen until the user dismisses it.
  // Callers that want to show the popup should invoke `openPopup()` explicitly.
  checkAndShowPopup: () => {
    // no-op — see comment above
  },
}))
