import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sourceImageUrl, fullSizeImageUrl } from '../src/content/hangar-image.ts';

test('verified RSI heap thumbnail resolves to its full-size source; other hosts and paths stay unchanged', () => {
  const url = 'https://robertsspaceindustries.com/media/hyofyr9qja82wr/heap_infobox/WD_3119_V02_Aurora_Turbu.jpg';
  assert.equal(fullSizeImageUrl(url), url.replace('/heap_infobox/', '/source/'));
  for (const other of ['https://example.com/media/id/heap_infobox/image.jpg', 'https://media.robertsspaceindustries.com/id/source.jpg', 'https://robertsspaceindustries.com/media/id/source/image.jpg']) assert.equal(fullSizeImageUrl(other), other);
});

test('expanded-item media thumbnails resolve generically for every asset ID', () => {
  for (const id of ['opav0sd99n3kp', 'm6hv5hk35tzf7', 'another-item-id']) {
    assert.equal(fullSizeImageUrl(`https://media.robertsspaceindustries.com/${id}/subscribers_vault_thumbnail.jpg`), `https://media.robertsspaceindustries.com/${id}/source.jpg`);
  }
  const external = 'https://example.com/id/subscribers_vault_thumbnail.jpg';
  assert.equal(fullSizeImageUrl(external), external);
});

test('media-host heap thumbnails use source.jpg for every asset and preserve query parameters', () => {
  for (const id of ['61m3eb9bir225', 'another-armor', 'another-ship']) {
    assert.equal(fullSizeImageUrl(`https://media.robertsspaceindustries.com/${id}/heap_infobox.jpg?x=1`), `https://media.robertsspaceindustries.com/${id}/source.jpg?x=1`);
  }
  const external = 'https://example.com/id/heap_infobox.jpg';
  assert.equal(fullSizeImageUrl(external), external);
});

test('preview uses the existing source URL without guessing a larger asset', () => {
  const base = 'https://robertsspaceindustries.com/en/account/pledges?page=22';
  assert.equal(sourceImageUrl('https://cdn.example.com/ship.png?size=100', 'none', base), 'https://cdn.example.com/ship.png?size=100');
  assert.equal(sourceImageUrl('', 'url("/images/ship.webp?x=1")', base), 'https://robertsspaceindustries.com/images/ship.webp?x=1');
  assert.equal(sourceImageUrl('', "url('https://cdn.example.com/image.jpg')", base), 'https://cdn.example.com/image.jpg');
  for (const src of ['', 'javascript:alert(1)', 'file:///secret', 'data:text/html,hello']) assert.equal(sourceImageUrl(src, 'none', base), null);
});
