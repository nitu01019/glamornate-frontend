/**
 * Firestore helpers for chat threads and messages.
 *
 * Data layout:
 *   chats/{userId}               – ChatThread document
 *   chats/{userId}/messages/{id} – ChatMessage documents
 *
 * Every public function guards on isFirebaseConfigured() so the app
 * works in demo mode without real Firebase credentials.
 */

import {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  onSnapshot,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { isFirebaseConfigured } from '@/lib/firebase-config';
import { getFirebaseFirestore } from './index';
import { parseChatThread, parseChatMessage } from './parsers';
import type { ChatThread, ChatMessage } from '@/types';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the existing chat thread for the user, or create one if it doesn't exist.
 * The document ID equals the userId so there is at most one thread per user.
 */
export async function getOrCreateChat(
  userId: string,
  userName: string
): Promise<ChatThread> {
  if (!isFirebaseConfigured()) {
    return {
      id: userId,
      userId,
      userName,
      lastMessage: '',
      lastMessageTime: new Date().toISOString(),
      unreadCount: 0,
      status: 'active',
    };
  }

  const db = getFirebaseFirestore();
  const chatRef = doc(db, 'chats', userId);
  const snap = await getDoc(chatRef);

  if (snap.exists()) {
    return parseChatThread(snap);
  }

  const thread: ChatThread = {
    id: userId,
    userId,
    userName,
    lastMessage: '',
    lastMessageTime: new Date().toISOString(),
    unreadCount: 0,
    status: 'active',
  };

  await setDoc(chatRef, thread);
  return thread;
}

/**
 * Add a message to the messages subcollection of a chat thread.
 * Also updates the parent chat document with lastMessage / lastMessageTime.
 *
 * @returns The Firestore-generated message document ID.
 */
export async function sendChatMessage(
  chatId: string,
  message: Omit<ChatMessage, 'id'>
): Promise<string> {
  if (!isFirebaseConfigured()) {
    return `demo-msg-${Date.now()}`;
  }

  const db = getFirebaseFirestore();
  const messagesCol = collection(db, 'chats', chatId, 'messages');
  const msgRef = await addDoc(messagesCol, message);

  const chatRef = doc(db, 'chats', chatId);
  await updateDoc(chatRef, {
    lastMessage: message.text,
    lastMessageTime: message.timestamp,
    unreadCount: message.sender === 'user' ? 0 : 1,
  });

  return msgRef.id;
}

const MESSAGES_PAGE_SIZE = 50;

/**
 * Subscribe to real-time updates for the most recent messages on a chat thread.
 * Fetches the latest {@link MESSAGES_PAGE_SIZE} messages ordered for display
 * (ascending by timestamp). Use {@link loadMoreMessages} to page back through
 * older history.
 *
 * @returns An unsubscribe function.
 */
export function subscribeToChatMessages(
  chatId: string,
  callback: (messages: ChatMessage[]) => void
): () => void {
  if (!isFirebaseConfigured()) {
    callback([]);
    return () => {};
  }

  const db = getFirebaseFirestore();
  const messagesCol = collection(db, 'chats', chatId, 'messages');
  // Fetch newest 50 via desc ordering, then reverse for chronological display.
  const q = query(
    messagesCol,
    orderBy('timestamp', 'desc'),
    limit(MESSAGES_PAGE_SIZE)
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs
      .map((d) => parseChatMessage(d))
      .reverse();
    callback(messages);
  });
}

/**
 * Load a batch of messages older than the provided cursor document.
 * Intended for "load more" / infinite-scroll pagination.
 *
 * @param chatId  - The chat thread ID.
 * @param before  - The earliest known Firestore document snapshot (the oldest
 *                  message currently displayed). Pass `null` on the first call
 *                  if you want the most-recent page without a live listener.
 * @returns An object containing the fetched messages (oldest-first) and the
 *          new cursor to pass on the next call, or `null` when no more pages exist.
 */
export async function loadMoreMessages(
  chatId: string,
  before: QueryDocumentSnapshot<DocumentData> | null
): Promise<{
  messages: ChatMessage[];
  cursor: QueryDocumentSnapshot<DocumentData> | null;
}> {
  if (!isFirebaseConfigured()) {
    return { messages: [], cursor: null };
  }

  const db = getFirebaseFirestore();
  const messagesCol = collection(db, 'chats', chatId, 'messages');

  const constraints = before
    ? [
        orderBy('timestamp', 'desc'),
        startAfter(before),
        limit(MESSAGES_PAGE_SIZE),
      ]
    : [orderBy('timestamp', 'desc'), limit(MESSAGES_PAGE_SIZE)];

  const q = query(messagesCol, ...constraints);
  const snapshot = await getDocs(q);

  const messages = snapshot.docs.map((d) => parseChatMessage(d)).reverse();

  const cursor =
    snapshot.docs.length === MESSAGES_PAGE_SIZE
      ? snapshot.docs[snapshot.docs.length - 1]
      : null;

  return { messages, cursor };
}

/**
 * Mark all messages in a chat thread as read by resetting unreadCount to 0.
 */
export async function markMessagesAsRead(chatId: string): Promise<void> {
  if (!isFirebaseConfigured()) {
    return;
  }

  const db = getFirebaseFirestore();
  const chatRef = doc(db, 'chats', chatId);
  await updateDoc(chatRef, { unreadCount: 0 });
}
