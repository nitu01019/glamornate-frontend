import { create } from 'zustand'
import { isFirebaseConfigured } from '@/lib/firebase-config'
import {
  getOrCreateChat,
  sendChatMessage,
  subscribeToChatMessages,
  markMessagesAsRead,
} from '@/lib/firebase-client/chats'
import type { ChatMessage } from '@/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BOT_AUTO_REPLY =
  'Thank you for reaching out! Our team will get back to you shortly. Meanwhile, you can browse our services or check your bookings.'

const BOT_REPLY_DELAY_MS = 1000

export const QUICK_REPLIES = [
  { label: 'Book a Service', action: 'navigate', path: '/services' },
  { label: 'View Offers', action: 'navigate', path: '/offers' },
  { label: 'Track Booking', action: 'navigate', path: '/customer/bookings' },
  { label: 'Contact Us', action: 'message', text: "I'd like to speak with someone" },
] as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

interface ChatState {
  // UI state
  messages: ChatMessage[]
  isOpen: boolean
  isLoading: boolean
  unreadCount: number
  connectionStatus: ConnectionStatus
  error: string | null

  // Firebase state (internal)
  _chatId: string | null
  _userId: string | null
  _userName: string | null
  _unsubscribe: (() => void) | null
  _isFirebaseMode: boolean

  // Public actions
  toggleChat: () => void
  openChat: () => void
  closeChat: () => void
  sendMessage: (text: string) => Promise<void>
  addMessage: (msg: ChatMessage) => void
  clearMessages: () => void
  markAllRead: () => void
  setMessages: (msgs: ChatMessage[]) => void

  // Firebase lifecycle
  initializeFirebase: (userId: string, userName: string) => Promise<void>
  subscribe: () => () => void
  disconnect: () => void
  retry: () => Promise<void>
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useChatStore = create<ChatState>()((set, get) => ({
  // Initial state
  messages: [],
  isOpen: false,
  isLoading: false,
  unreadCount: 0,
  connectionStatus: 'disconnected',
  error: null,

  _chatId: null,
  _userId: null,
  _userName: null,
  _unsubscribe: null,
  _isFirebaseMode: isFirebaseConfigured(),

  // -------------------------------------------------------------------------
  // UI actions
  // -------------------------------------------------------------------------

  toggleChat: () => {
    const { isOpen } = get()
    if (!isOpen) {
      set({ isOpen: true, unreadCount: 0 })
    } else {
      set({ isOpen: false })
    }
  },

  openChat: () => set({ isOpen: true, unreadCount: 0 }),

  closeChat: () => set({ isOpen: false }),

  // -------------------------------------------------------------------------
  // Send message — dispatches to Firebase or falls back to demo mode
  // -------------------------------------------------------------------------

  sendMessage: async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return

    const { _isFirebaseMode, _chatId, _userId } = get()

    if (_isFirebaseMode && _chatId && _userId) {
      // ------ Firebase mode ------
      // Optimistic local insert so the UI feels instant
      const optimisticMsg: ChatMessage = {
        id: `optimistic-${Date.now()}`,
        chatId: _chatId,
        sender: 'user',
        text: trimmed,
        timestamp: new Date().toISOString(),
        read: true,
      }

      set((state) => ({
        messages: [...state.messages, optimisticMsg],
        isLoading: true,
      }))

      try {
        await sendChatMessage(_chatId, {
          chatId: _chatId,
          sender: 'user',
          text: trimmed,
          timestamp: new Date().toISOString(),
          read: true,
        })
        // The real-time listener will replace the optimistic message
        // with the Firestore version once it arrives.
        set({ isLoading: false })
      } catch {
        set((state) => ({
          isLoading: false,
          error: 'Failed to send message. Please try again.',
          // Keep the optimistic message so the user can see what they typed
          messages: state.messages,
        }))
      }
    } else {
      // ------ Demo (local-only) mode ------
      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        chatId: 'default',
        sender: 'user',
        text: trimmed,
        timestamp: new Date().toISOString(),
        read: true,
      }

      set((state) => ({
        messages: [...state.messages, userMessage],
        isLoading: true,
      }))

      // Simulate a bot reply after a short delay
      setTimeout(() => {
        const botMessage: ChatMessage = {
          id: `msg-${Date.now()}`,
          chatId: 'default',
          sender: 'bot',
          text: BOT_AUTO_REPLY,
          timestamp: new Date().toISOString(),
          read: false,
        }

        set((state) => {
          const nextUnread = state.isOpen
            ? state.unreadCount
            : state.unreadCount + 1

          return {
            messages: [...state.messages, botMessage],
            isLoading: false,
            unreadCount: nextUnread,
          }
        })
      }, BOT_REPLY_DELAY_MS)
    }
  },

  addMessage: (msg) => {
    set((state) => ({
      messages: [...state.messages, msg],
    }))
  },

  clearMessages: () => set({ messages: [], unreadCount: 0 }),

  markAllRead: () => {
    const { _isFirebaseMode, _chatId, unreadCount, messages } = get()

    // Skip if nothing to mark — prevents unnecessary state updates and re-renders
    if (unreadCount === 0 && messages.every((msg) => msg.read)) return

    set((state) => ({
      unreadCount: 0,
      messages: state.messages.map((msg) =>
        msg.read ? msg : { ...msg, read: true }
      ),
    }))

    // Also update Firestore
    if (_isFirebaseMode && _chatId) {
      markMessagesAsRead(_chatId).catch(() => {
        // Silently ignore — local state is already updated
      })
    }
  },

  setMessages: (msgs) => set({ messages: msgs }),

  // -------------------------------------------------------------------------
  // Firebase lifecycle
  // -------------------------------------------------------------------------

  initializeFirebase: async (userId: string, userName: string) => {
    if (!isFirebaseConfigured()) {
      set({ _isFirebaseMode: false })
      return
    }

    set({
      connectionStatus: 'connecting',
      isLoading: true,
      error: null,
      _userId: userId,
      _userName: userName,
      _isFirebaseMode: true,
    })

    try {
      const thread = await getOrCreateChat(userId, userName)
      set({
        _chatId: thread.id,
        unreadCount: thread.unreadCount,
        connectionStatus: 'connected',
        isLoading: false,
      })
    } catch {
      set({
        connectionStatus: 'error',
        isLoading: false,
        error: 'Could not connect to chat. Please try again.',
        // Fall back to local mode so the user can still interact
        _isFirebaseMode: false,
      })
    }
  },

  subscribe: () => {
    const { _chatId, _isFirebaseMode, _unsubscribe: existingUnsub } = get()

    // Clean up any prior subscription
    if (existingUnsub) {
      existingUnsub()
    }

    if (!_isFirebaseMode || !_chatId) {
      // Nothing to subscribe to — return a no-op unsubscribe
      return () => {}
    }

    const unsubscribe = subscribeToChatMessages(
      _chatId,
      (firebaseMessages: ChatMessage[]) => {
        const { isOpen } = get()

        if (firebaseMessages.length > 0) {
          const unreadFromOthers = firebaseMessages.filter(
            (m) => !m.read && m.sender !== 'user'
          ).length

          set({
            messages: firebaseMessages,
            unreadCount: isOpen ? 0 : unreadFromOthers,
          })
        }
      }
    )

    set({ _unsubscribe: unsubscribe })

    return () => {
      unsubscribe()
      set({ _unsubscribe: null })
    }
  },

  disconnect: () => {
    const { _unsubscribe } = get()
    if (_unsubscribe) {
      _unsubscribe()
    }
    set({
      // Firebase lifecycle
      _unsubscribe: null,
      _chatId: null,
      _userId: null,
      _userName: null,
      connectionStatus: 'disconnected',
      // Clear message state so stale data is not shown after logout
      messages: [],
      unreadCount: 0,
      error: null,
    })
  },

  retry: async () => {
    const { _userId, _userName } = get()
    if (_userId && _userName) {
      await get().initializeFirebase(_userId, _userName)
    }
  },
}))
