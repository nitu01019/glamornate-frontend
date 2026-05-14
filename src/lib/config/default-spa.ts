/**
 * Single-salon app helper.
 *
 * Glamornate is one salon's own app, not a marketplace — there is exactly
 * one active spa in Firestore at any time. Every customer booking stamps the
 * id of that spa onto the booking document so the BE schema (still requires
 * `spaId`) and Firestore rules (still branch on `spaId`) keep working without
 * any customer-facing spa picker.
 *
 * No hardcoded spa id. Use `useActiveSpa()` from `frontend/src/hooks/useSpas.ts`
 * to resolve it at runtime: the hook fetches the first active spa from the
 * `spas` collection (`where status == 'active' orderBy createdAt desc limit 1`)
 * and caches it in TanStack Query.
 */
export {};
