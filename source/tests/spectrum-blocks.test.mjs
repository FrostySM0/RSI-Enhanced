import assert from 'node:assert/strict';
import {test} from 'node:test';
import {normalizeHandle, hiddenUsersFromStorage, HIDDEN_USER_PREFIX, initializeHiddenUsers, setUserHidden, readHiddenUsers} from '../src/shared/hidden-users.ts';

test('enhanced block identities use exact normalized handles, not display names', () => {
  assert.equal(normalizeHandle(' @J3PT '),'j3pt');
  assert.equal(normalizeHandle('Someone Else'),null);
  assert.equal(normalizeHandle('javascript:alert(1)'),null);
  assert.equal(normalizeHandle(''),null);
});

test('J3PT preset is undoable and restoring never reseeds it or clears other users', async () => {
  const saved = {}, previous = globalThis.chrome;
  globalThis.chrome = {storage:{local:{get:async keys => keys === null ? {...saved} : Object.fromEntries(keys.map(key=>[key,saved[key]])),set:async values=>Object.assign(saved,values)}}};
  try {
    await initializeHiddenUsers(); assert.equal((await readHiddenUsers())[0].handle,'j3pt');
    await setUserHidden('AnotherPilot','Another pilot',true);
    await setUserHidden('J3PT','J3PT',false);
    await initializeHiddenUsers();
    assert.deepEqual(await readHiddenUsers(),[{handle:'anotherpilot',name:'Another pilot'}]);
  } finally { globalThis.chrome = previous; }
});

test('hidden users restore independently and ignore unrelated or malformed storage', () => {
  const result = hiddenUsersFromStorage({
    [HIDDEN_USER_PREFIX+'j3pt']:{handle:'J3PT',name:'J3PT'},
    [HIDDEN_USER_PREFIX+'restored']:null,
    [HIDDEN_USER_PREFIX+'wrong']:{handle:'different',name:'Bad'},
    'rsiEnhanced.settings':{theme:'oled'},
  });
  assert.deepEqual(result,[{handle:'j3pt',name:'J3PT'}]);
});
