// Pure, framework-free helpers for Mona's Bookmark Manager.
//
// Nothing in this file touches the DOM or localStorage directly, so it can be
// unit tested with a plain Node test runner (no browser required) and safely
// imported from the client-side <script> in Bookmarks.astro.

export interface Bookmark {
  url: string;
  slug: string;
}

/** localStorage key bookmarks are persisted under. */
export const STORAGE_KEY = 'mona-bookmarks';

/** Alphabet used to generate short, URL-friendly slugs. */
const BASE62_ALPHABET =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

const SLUG_PREFIX = 'mona-';
const SLUG_RANDOM_LENGTH = 4;
/** Separator used when rendering a bookmark as a single line of text. */
export const DISPLAY_SEPARATOR = ' :: ';

/**
 * Normalise user-typed input into a saveable URL.
 *
 * Accepts input with or without a scheme (e.g. "example.com" or
 * "https://example.com") and returns the canonical `href` so both forms
 * resolve to the same saved value. Returns `null` when the input can't be
 * parsed as a URL at all.
 */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Only treat it as "already has a scheme" if it looks like scheme://...
  // (e.g. "https://example.com"), not things like "mailto:" or bare colons.
  const hasScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;

  try {
    return new URL(candidate).href;
  } catch {
    return null;
  }
}

/**
 * Generate a random base62 string of the given length using a
 * cryptographically strong source when available, falling back to
 * Math.random otherwise (e.g. very old browsers).
 */
function randomBase62(length: number): string {
  let out = '';
  const cryptoObj: Crypto | undefined =
    typeof crypto !== 'undefined' ? crypto : undefined;

  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint32Array(length);
    cryptoObj.getRandomValues(bytes);
    for (let i = 0; i < length; i++) {
      out += BASE62_ALPHABET[bytes[i] % BASE62_ALPHABET.length];
    }
    return out;
  }

  for (let i = 0; i < length; i++) {
    out += BASE62_ALPHABET[Math.floor(Math.random() * BASE62_ALPHABET.length)];
  }
  return out;
}

/**
 * Generate a short "mona-" prefixed base62 slug (e.g. "mona-7fk2") that does
 * not collide with any slug in `existingSlugs`.
 */
export function generateSlug(existingSlugs: Iterable<string> = []): string {
  const seen = new Set(existingSlugs);
  let slug: string;
  do {
    slug = `${SLUG_PREFIX}${randomBase62(SLUG_RANDOM_LENGTH)}`;
  } while (seen.has(slug));
  return slug;
}

/** Format a bookmark for display, e.g. "https://example.com/ :: mona-7fk2". */
export function formatBookmark(bookmark: Bookmark): string {
  return `${bookmark.url}${DISPLAY_SEPARATOR}${bookmark.slug}`;
}

function isValidBookmark(value: unknown): value is Bookmark {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).url === 'string' &&
    (value as Record<string, unknown>).url !== '' &&
    typeof (value as Record<string, unknown>).slug === 'string' &&
    (value as Record<string, unknown>).slug !== ''
  );
}

/**
 * Parse a raw localStorage value into a validated list of bookmarks.
 *
 * Treats the stored value as untrusted: empty, missing, corrupted
 * (unparsable JSON), legacy (non-array), or partially malformed values are
 * all recovered from by dropping anything that doesn't look like a
 * `{ url, slug }` bookmark. Never throws.
 */
export function parseStoredBookmarks(raw: string | null | undefined): Bookmark[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return parsed.filter(isValidBookmark).map(({ url, slug }) => ({ url, slug }));
}

/** Serialise a list of bookmarks for storage. */
export function serializeBookmarks(bookmarks: Bookmark[]): string {
  return JSON.stringify(bookmarks);
}
