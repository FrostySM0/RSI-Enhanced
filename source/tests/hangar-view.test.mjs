import assert from 'node:assert/strict';
import {test} from 'node:test';
import { HANGAR_PAGE_SIZE_KEY, HANGAR_VIEW_KEY, normalizeHangarSort, readHangarPageSize, readHangarView, saveHangarPageSize, saveHangarView } from '../src/content/hangar-view.ts';

test('Hangar view defaults to list and saves only its own preference', async () => {
  const previous = globalThis.chrome, values = {settings:'keep',hiddenUser:'keep'};
  globalThis.chrome = {storage:{local:{get:async key=>({[key]:values[key]}),set:async update=>Object.assign(values,update)}}};
  try {
    assert.equal(await readHangarView(),'list');
    await saveHangarView('grid'); assert.equal(await readHangarView(),'grid');
    await saveHangarView('list'); assert.equal(await readHangarView(),'list');
    values[HANGAR_VIEW_KEY]='invalid'; assert.equal(await readHangarView(),'list');
    assert.equal(values.settings,'keep'); assert.equal(values.hiddenUser,'keep');
  } finally {globalThis.chrome=previous;}
});

test('Hangar page size defaults to nine and saves only the independent display preference', async () => {
  const previous = globalThis.chrome, values = {settings:'keep',hiddenUser:'keep'};
  globalThis.chrome = {storage:{local:{get:async key=>({[key]:values[key]}),set:async update=>Object.assign(values,update)}}};
  try {
    assert.equal(await readHangarPageSize(),'9');
    await saveHangarPageSize('18'); assert.equal(await readHangarPageSize(),'18');
    await saveHangarPageSize('36'); assert.equal(await readHangarPageSize(),'36');
    await saveHangarPageSize('all'); assert.equal(await readHangarPageSize(),'all');
    values[HANGAR_PAGE_SIZE_KEY]='unexpected'; assert.equal(await readHangarPageSize(),'9');
    assert.equal(values[HANGAR_VIEW_KEY],undefined);
    assert.equal(values.settings,'keep'); assert.equal(values.hiddenUser,'keep');
  } finally {globalThis.chrome=previous;}
});

test('Hangar sort choices normalize to the supported page presentation modes', () => {
  assert.equal(normalizeHangarSort('newest'), 'newest');
  assert.equal(normalizeHangarSort('name'), 'name');
  assert.equal(normalizeHangarSort('value'), 'value');
  assert.equal(normalizeHangarSort('unexpected'), 'default');
});
