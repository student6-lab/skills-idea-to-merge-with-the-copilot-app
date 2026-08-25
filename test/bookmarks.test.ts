import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeUrl,
  generateSlug,
  formatBookmark,
  parseStoredBookmarks,
  serializeBookmarks,
  STORAGE_KEY,
} from '../src/lib/bookmarks.ts';

test('normalizeUrl: adds https:// when missing so both forms match', () => {
  const withScheme = normalizeUrl('https://example.com');
  const withoutScheme = normalizeUrl('example.com');
  assert.equal(withScheme, withoutScheme);
  assert.equal(withoutScheme, 'https://example.com/');
});

test('normalizeUrl: preserves an existing non-https scheme', () => {
  assert.equal(normalizeUrl('http://example.com'), 'http://example.com/');
});

test('normalizeUrl: trims surrounding whitespace', () => {
  assert.equal(normalizeUrl('  example.com  '), 'https://example.com/');
});

test('normalizeUrl: returns null for empty or unparsable input', () => {
  assert.equal(normalizeUrl(''), null);
  assert.equal(normalizeUrl('   '), null);
  assert.equal(normalizeUrl('not a url at all'), null);
});

test('generateSlug: uses the mona- prefix and base62 characters', () => {
  const slug = generateSlug();
  assert.match(slug, /^mona-[0-9a-zA-Z]{4}$/);
});

test('generateSlug: avoids collisions with existing slugs', () => {
  // Force the pool of "random" outcomes to be tiny by checking many times;
  // the generator must never return an excluded slug.
  const existing = new Set<string>();
  for (let i = 0; i < 25; i++) {
    const slug = generateSlug(existing);
    assert.ok(!existing.has(slug), `slug ${slug} should not collide`);
    existing.add(slug);
  }
});

test('formatBookmark: uses the exact " :: " separator', () => {
  const bookmark = { url: 'https://www.example.com/', slug: 'mona-7fk2' };
  assert.equal(formatBookmark(bookmark), 'https://www.example.com/ :: mona-7fk2');
});

test('parseStoredBookmarks: recovers from an empty value', () => {
  assert.deepEqual(parseStoredBookmarks(null), []);
  assert.deepEqual(parseStoredBookmarks(undefined), []);
  assert.deepEqual(parseStoredBookmarks(''), []);
});

test('parseStoredBookmarks: recovers from corrupted (unparsable) JSON', () => {
  assert.deepEqual(parseStoredBookmarks('{not valid json'), []);
});

test('parseStoredBookmarks: recovers from a legacy / non-array value', () => {
  assert.deepEqual(parseStoredBookmarks('{"url":"https://example.com/"}'), []);
  assert.deepEqual(parseStoredBookmarks('"just a string"'), []);
  assert.deepEqual(parseStoredBookmarks('42'), []);
});

test('parseStoredBookmarks: drops malformed entries but keeps valid ones', () => {
  const raw = JSON.stringify([
    { url: 'https://example.com/', slug: 'mona-abcd' },
    { url: 'https://missing-slug.com/' },
    { slug: 'mona-xyz1' },
    null,
    'not-an-object',
    42,
    { url: 123, slug: 'mona-9999' },
    { url: 'https://valid.com/', slug: '' },
  ]);
  assert.deepEqual(parseStoredBookmarks(raw), [
    { url: 'https://example.com/', slug: 'mona-abcd' },
  ]);
});

test('serializeBookmarks + parseStoredBookmarks round-trip', () => {
  const bookmarks = [
    { url: 'https://example.com/', slug: 'mona-abcd' },
    { url: 'https://example.org/', slug: 'mona-efgh' },
  ];
  assert.deepEqual(parseStoredBookmarks(serializeBookmarks(bookmarks)), bookmarks);
});

test('STORAGE_KEY is the documented localStorage key', () => {
  assert.equal(STORAGE_KEY, 'mona-bookmarks');
});
