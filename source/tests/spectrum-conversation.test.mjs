import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { conversationRoute, devTrackerReplyRequested, loadConversation, loadReplyAndParent, loadReplyParent, openNativeReplyControl, replyText, lexicalText, conversationAuthor, safeConversationAssetUrl, placeConversationControls } from '../src/content/spectrum-conversation.ts';

test('conversation action stays inline in the native notice and context stays below it', () => {
  const placements = [];
  const banner = {
    append: node => placements.push(['inside-notice', node]),
    after: node => placements.push(['after-notice', node]),
  };
  const action = {}, panel = {};
  placeConversationControls(banner, action, panel);
  assert.deepEqual(placements, [['inside-notice', action], ['after-notice', panel]]);
});

test('conversation action uses inline native-link styling without a separate bar', async () => {
  const css = await readFile(new URL('../src/styles/spectrum-forums.css', import.meta.url), 'utf8');
  assert.match(css, /#react #page\.forum-thread h3 \.rsi-extend-conversation\s*\{[^}]*display:\s*inline-flex;/);
  assert.match(css, /#react #page\.forum-thread h3 \.rsi-extend-conversation\s*\{[^}]*background:\s*transparent;/);
  assert.doesNotMatch(css, /#react #page \.rsi-extend-conversation\s*\{[^}]*display:\s*block;/);
});

test('extended parent posts provide exact-post Reply actions and reveal the highlighted linked reply', async () => {
  const classes = new Set();
  const makeNode = () => {
    const nodeClasses = new Set();
    return {
      children:[], attributes:new Map(), dataset:{}, listeners:new Map(), hidden:false, isConnected:true,
      className:'', textContent:'', style:{ getPropertyValue:() => '', setProperty() {}, removeProperty() {} },
      classList:{ add:(...names) => names.forEach(name => nodeClasses.add(name)), remove:(...names) => names.forEach(name => nodeClasses.delete(name)), toggle:(name,force) => force ? nodeClasses.add(name) : nodeClasses.delete(name), contains:name => nodeClasses.has(name) },
      setAttribute(name,value) { this.attributes.set(name,value); }, getAttribute(name) { return this.attributes.get(name) ?? null; },
      append(...nodes) { this.children.push(...nodes); nodes.forEach(child => { child.parentNode=this; child.isConnected=true; }); },
      after(node) { this.afterNode=node; node.isConnected=true; }, replaceChildren(...nodes) { this.children=[]; this.append(...nodes); },
      addEventListener(name,listener) { this.listeners.set(name,listener); }, remove() { this.isConnected=false; },
      scrollIntoView(options) { this.scrollOptions=options; },
    };
  };
  const reply = makeNode();
  reply.classList = {
    add:(...names) => names.forEach(name => classes.add(name)),
    remove:(...names) => names.forEach(name => classes.delete(name)),
    toggle:(name,force) => force ? classes.add(name) : classes.delete(name),
    contains:name => classes.has(name),
  };
  const banner = Object.assign(makeNode(), { textContent:'You are viewing a single reply’s thread.' });
  const document = { readyState:'complete', body:{}, createElement:() => makeNode(), querySelectorAll:() => [banner], querySelector:() => reply };
  const window = {
    location:{ pathname:'/spectrum/community/SC/forum/3/thread/example/42', search:'', href:'https://robertsspaceindustries.com/spectrum/community/SC/forum/3/thread/example/42' },
    setTimeout:() => 1, clearTimeout() {},
    fetch:async (url,options) => {
      const request=JSON.parse(options.body);
      const data=url.endsWith('/nested')
        ? { id:'10', content_reply_id:'1', member:{displayname:'Thread author'} }
        : request.reply_id === '42'
          ? { id:'42', thread_id:'10', parent_reply_id:'41' }
          : { id:'41', thread_id:'10', parent_reply_id:'1', member:{displayname:'Parent author'} };
      return { ok:true, json:async () => ({success:1,data}) };
    },
  };
  const refresh=(await import('../src/content/spectrum-conversation.ts')).installConversation(() => true,window,document);
  refresh();
  const extend=banner.children.find(node => node.className === 'rsi-extend-conversation');
  await extend.listeners.get('click')();

  const descendants=[];
  const visit=node => { descendants.push(node); (node.children || []).forEach(visit); };
  visit(banner.afterNode);
  const replyActions=descendants.filter(node => node.className === 'rsi-conversation-reply-action');
  assert.deepEqual(replyActions.map(node => node.href), [
    '/spectrum/community/SC/forum/3/thread/example/1?rsi-enhanced-reply=1&rsi-enhanced-reply-id=1',
    '/spectrum/community/SC/forum/3/thread/example/41?rsi-enhanced-reply=1&rsi-enhanced-reply-id=41',
  ]);
  assert.deepEqual(replyActions.map(node => node.textContent), ['REPLY TO Thread author','REPLY TO Parent author']);
  assert.equal(reply.scrollOptions.block,'center');
  assert.equal(reply.scrollOptions.behavior,'smooth');
});

test('reply action uses Spectrum conversation navigation then opens the native Reply control for that exact post', async () => {
  const classes = new Set();
  const makeNode = () => ({
    children:[], attributes:new Map(), dataset:{}, listeners:new Map(), hidden:false, isConnected:true,
    className:'', textContent:'', style:{ getPropertyValue:() => '', setProperty() {}, removeProperty() {} },
    classList:{ add:(...names) => names.forEach(name => classes.add(name)), remove:(...names) => names.forEach(name => classes.delete(name)), toggle:(name,force) => force ? classes.add(name) : classes.delete(name), contains:name => classes.has(name) },
    setAttribute(name,value) { this.attributes.set(name,value); }, getAttribute(name) { return this.attributes.get(name) ?? null; },
    append(...nodes) { this.children.push(...nodes); nodes.forEach(child => { child.parentNode=this; child.isConnected=true; }); },
    after(node) { this.afterNode=node; node.isConnected=true; }, replaceChildren(...nodes) { this.children=[]; this.append(...nodes); },
    addEventListener(name,listener) { this.listeners.set(name,listener); }, remove() { this.isConnected=false; }, scrollIntoView() {},
  });
  let nativeConversationOpens=0, nativeReplyOpens=0;
  const nativeConversationLink={ textContent:'View the rest of the replies', click() { nativeConversationOpens+=1; } };
  const banner=Object.assign(makeNode(), { textContent:'You are viewing a single reply’s thread.', querySelectorAll:selector => selector === 'a' ? [nativeConversationLink] : [] });
  const linkedReply=makeNode(); linkedReply.classList={ add() {}, remove() {}, toggle() {}, contains() { return false; } };
  const parentReply=Object.assign(makeNode(), { querySelectorAll:() => [{textContent:'Reply', disabled:false, hidden:false, getAttribute:() => null, click() { nativeReplyOpens+=1; }}] });
  const document={ readyState:'complete', body:{}, createElement:() => makeNode(), querySelectorAll:() => [banner], querySelector:selector => selector.includes('"42"') ? linkedReply : selector.includes('"41"') ? parentReply : null };
  const stored=new Map();
  const window={
    location:{ pathname:'/spectrum/community/SC/forum/3/thread/example/42', search:'', href:'https://robertsspaceindustries.com/spectrum/community/SC/forum/3/thread/example/42' },
    sessionStorage:{ getItem:key => stored.get(key) ?? null, setItem:(key,value) => stored.set(key,value), removeItem:key => stored.delete(key) },
    setTimeout:() => 1, clearTimeout() {},
    fetch:async (url,options) => {
      const request=JSON.parse(options.body);
      const data=url.endsWith('/nested') ? { id:'10', content_reply_id:'1', member:{displayname:'Thread author'} }
        : request.reply_id === '42' ? { id:'42', thread_id:'10', parent_reply_id:'41' }
          : { id:'41', thread_id:'10', parent_reply_id:'1', member:{displayname:'Parent author'} };
      return { ok:true, json:async () => ({success:1,data}) };
    },
  };
  const refresh=(await import('../src/content/spectrum-conversation.ts')).installConversation(() => true,window,document);
  refresh();
  const extend=banner.children.find(node => node.className === 'rsi-extend-conversation');
  await extend.listeners.get('click')();
  const descendants=[];
  const visit=node => { descendants.push(node); (node.children || []).forEach(visit); };
  visit(banner.afterNode);
  const action=descendants.find(node => node.className === 'rsi-conversation-reply-action' && node.textContent === 'REPLY TO Parent author');
  let prevented=false;
  action.listeners.get('click')({ preventDefault() { prevented=true; } });
  assert.equal(prevented,true);
  assert.equal(nativeConversationOpens,1);
  assert.equal(nativeReplyOpens,0);

  window.location.pathname='/spectrum/community/SC/forum/3/thread/example';
  window.location.search='';
  refresh();
  assert.equal(nativeReplyOpens,1);
  assert.equal(stored.size,0);

  stored.set('rsiEnhanced.pendingSpectrumReply', JSON.stringify({ threadPath:'/spectrum/community/SC/forum/3/thread/different', replyId:'99', createdAt:Date.now() }));
  window.location.pathname='/spectrum/community/SC/forum/3/thread/elsewhere';
  refresh();
  assert.equal(nativeReplyOpens,1, 'a pending reply intent must never open a post from a different thread');
  assert.equal(stored.size,0, 'discard the intent when navigation leaves its thread');
});

test('linked reply highlight remains a strong yellow outline above native reply states', async () => {
  const css = await readFile(new URL('../src/styles/spectrum-forums.css', import.meta.url), 'utf8');
  assert.match(css, /#react #page\.forum-thread \.forum-thread-replies \.forum-thread-item\.rsi-conversation-target\s*\{[^}]*outline:\s*3px solid #ffd84d !important;/);
  assert.match(css, /#react #page\.forum-thread \.forum-thread-replies \.forum-thread-item\.rsi-conversation-target\s*\{[^}]*box-shadow:[^}]*!important;/);
});

test('conversation authors always have a name and safe avatar, including null native avatars', () => {
  const base = 'https://robertsspaceindustries.com/spectrum/';
  const missing = conversationAuthor({displayname:'TommeeGunn',avatar:null},base);
  assert.equal(missing.name,'TommeeGunn');
  assert.match(missing.avatar,/avatar_default_big\.jpg$/);
  assert.equal(conversationAuthor({nickname:'Pilot',avatar:'javascript:alert(1)'},base).avatar,missing.avatar);
  assert.equal(conversationAuthor({nickname:'Pilot',avatar:'https://images.example.test/avatar.png'},base).avatar,missing.avatar);
  assert.equal(conversationAuthor(undefined,base).name,'Unavailable author');
  assert.equal(conversationAuthor({displayname:'Pilot',avatar:'/media/avatar.jpg'},base).avatar,'https://robertsspaceindustries.com/media/avatar.jpg');
});

test('conversation images accept only HTTPS URLs on RSI-owned hosts', () => {
  const base = 'https://robertsspaceindustries.com/spectrum/';
  assert.equal(safeConversationAssetUrl('/media/attachment.jpg',base),'https://robertsspaceindustries.com/media/attachment.jpg');
  assert.equal(safeConversationAssetUrl('https://cdn.robertsspaceindustries.com/attachment.jpg',base),'https://cdn.robertsspaceindustries.com/attachment.jpg');
  assert.equal(safeConversationAssetUrl('https://cdn.robertsspaceindustries.com:8443/attachment.jpg',base),null);
  assert.equal(safeConversationAssetUrl('http://cdn.robertsspaceindustries.com/attachment.jpg',base),null);
  assert.equal(safeConversationAssetUrl('https://robertsspaceindustries.com.example.test/attachment.jpg',base),null);
  assert.equal(safeConversationAssetUrl('https://images.example.test/attachment.jpg',base),null);
});

test('single reply routes preserve the native thread URL and reject unrelated paths', () => {
  assert.deepEqual(conversationRoute('/spectrum/community/SC/forum/3/thread/sq42-play-test/9176422'), { threadPath: '/spectrum/community/SC/forum/3/thread/sq42-play-test', slug: 'sq42-play-test', replyId: '9176422' });
  for (const path of ['/spectrum/community/SC/forum/3/thread/test','/account/pledges','/spectrum/community/SC/forum/3/thread/test/edit']) assert.equal(conversationRoute(path), null);
});

test('Dev Tracker reply intent is explicit and opens only the target post native Reply control', () => {
  assert.equal(devTrackerReplyRequested('?rsi-enhanced-reply=1'), true);
  assert.equal(devTrackerReplyRequested('?rsi-enhanced-reply=0'), false);
  assert.equal(devTrackerReplyRequested('?unrelated=1'), false);

  let clicks = 0;
  const edit = { textContent:'Edit', getAttribute:() => null, disabled:false, hidden:false, click:() => { clicks += 10; } };
  const reply = { textContent:'', getAttribute:name => name === 'aria-label' ? 'Reply to this post' : null, disabled:false, hidden:false, click:() => { clicks += 1; } };
  const nestedReply = { ...reply, closest:() => ({}), click:() => { clicks += 100; } };
  const target = { querySelectorAll:selector => { assert.equal(selector, 'button,[role="button"]'); return [edit, reply]; } };
  reply.closest = () => target;
  target.querySelectorAll = selector => { assert.equal(selector, 'button,[role="button"]'); return [edit, nestedReply, reply]; };
  assert.equal(openNativeReplyControl(target), true);
  assert.equal(clicks, 1);

  const unrelated = { querySelectorAll:() => [edit] };
  assert.equal(openNativeReplyControl(unrelated), false);
  assert.equal(clicks, 1);
});

test('single-reply Spectrum route activates the native Reply control when Dev Tracker requested it', async () => {
  let replyClicks = 0;
  const replyButton = { textContent:'', disabled:false, hidden:false, getAttribute:name => name === 'aria-label' ? 'Reply' : null, click:() => { replyClicks += 1; } };
  const classes = new Set();
  const target = {
    isConnected:true,
    style:{ getPropertyValue:() => '', setProperty:() => {}, removeProperty:() => {} },
    classList:{ add:name => classes.add(name), remove:name => classes.delete(name) },
    querySelectorAll:() => [replyButton],
    scrollIntoView() {},
  };
  const makeNode = () => ({
    children:[], attributes:new Map(), hidden:false,
    setAttribute(name,value) { this.attributes.set(name,value); },
    append(node) { this.children.push(node); node.isConnected = true; },
    after(node) { this.afterNode = node; node.isConnected = true; },
    addEventListener() {}, remove() { this.isConnected = false; },
  });
  const banner = Object.assign(makeNode(), { textContent:'You are viewing a single reply’s thread.' });
  const document = {
    readyState:'complete', body:{},
    createElement:() => makeNode(),
    querySelectorAll:() => [banner],
    querySelector:() => target,
  };
  const window = {
    location:{ pathname:'/spectrum/community/SC/forum/3/thread/example/42', search:'?rsi-enhanced-reply=1' },
    setTimeout:() => 1, clearTimeout() {},
  };

  const refresh = (await import('../src/content/spectrum-conversation.ts')).installConversation(() => false, window, document);
  refresh();
  assert.equal(replyClicks, 1);
  assert.equal(classes.has('rsi-conversation-target'), false);
});

test('reply intent falls back to the exact parent when Spectrum normalizes to the thread route', async () => {
  let replyClicks=0;
  const replyButton={ textContent:'Reply', disabled:false, hidden:false, getAttribute:() => null, click:() => { replyClicks += 1; } };
  const target={ querySelectorAll:() => [replyButton], scrollIntoView() {} };
  const document={
    readyState:'complete', body:{}, querySelectorAll:() => [],
    querySelector:selector => { assert.equal(selector,'#react .forum-thread-item[data-reply-id="41"]'); return target; },
  };
  const window={
    location:{ pathname:'/spectrum/community/SC/forum/3/thread/example', search:'?rsi-enhanced-reply=1&rsi-enhanced-reply-id=41', href:'https://robertsspaceindustries.com/spectrum/community/SC/forum/3/thread/example' },
    setTimeout:() => 1, clearTimeout() {},
  };
  const refresh=(await import('../src/content/spectrum-conversation.ts')).installConversation(() => false,window,document);
  refresh();
  assert.equal(replyClicks,1);
});

test('conversation orders original post and every parent before the linked reply', async () => {
  const rows = { '4': { id:'4', thread_id:'10', parent_reply_id:'3' }, '3': { id:'3', thread_id:'10', parent_reply_reference:{id:'2'} }, '2': { id:'2', thread_id:'10', parent_reply_id:'' } };
  const result = await loadConversation('topic', '4', async (endpoint, body) => endpoint.endsWith('/nested') ? { id:'10', content_reply_id:'1', subject:'Original' } : rows[body.reply_id]);
  assert.deepEqual(result.map(row=>row.id), ['1','2','3']);
  assert.equal(result[0].is_thread_content, true);
});

test('conversation refuses cycles, unrelated threads and unavailable ancestors', async () => {
  for (const row of [{id:'4',thread_id:'10',parent_reply_id:'4'}, {id:'4',thread_id:'99'}, null]) {
    await assert.rejects(loadConversation('topic','4',async endpoint => endpoint.endsWith('/nested') ? {id:'10',content_reply_id:'1'} : row));
  }
});

test('Dev Tracker context resolves the exact immediate Spectrum parent with its real author', async () => {
  const calls = [];
  const target = { id:'42', thread_id:'10', parent_reply_id:'41' };
  const parent = { id:'41', thread_id:'10', member:{ displayname:'Wendigo', nickname:'Wendigo', avatar:'/media/wendigo.jpg' }, lexical_content:JSON.stringify({root:{type:'root',children:[{type:'paragraph',children:[{text:'This is the actual parent post.'}]}]}}) };
  const result = await loadReplyParent('topic','42',async (endpoint, body) => {
    calls.push([endpoint, body]);
    return body.reply_id === '42' ? target : parent;
  });
  assert.equal(result.id,'41');
  assert.equal(result.member.displayname,'Wendigo');
  assert.equal(replyText(result),'This is the actual parent post.');
  assert.deepEqual(calls,[['/forum/thread/reply',{reply_id:'42'}],['/forum/thread/reply',{reply_id:'41'}]]);
});

test('Dev Tracker loads the complete developer response with its exact parent', async () => {
  const calls = [];
  const fullResponse = 'Complete developer response text. '.repeat(18).trim();
  const parentText = 'The parent message.';
  const result = await loadReplyAndParent('topic', '42', async (endpoint, body) => {
    calls.push([endpoint, body]);
    if (body.reply_id === '42') return {
      id:'42', thread_id:'10', parent_reply_id:'41',
      lexical_content:JSON.stringify({root:{type:'root',children:[{type:'paragraph',children:[{text:fullResponse}]}]}}),
    };
    return {
      id:'41', thread_id:'10', member:{displayname:'Wendigo'},
      lexical_content:JSON.stringify({root:{type:'root',children:[{type:'paragraph',children:[{text:parentText}]}]}}),
    };
  });
  assert.equal(result.target.id, '42');
  assert.equal(replyText(result.target), fullResponse);
  assert.equal(replyText(result.parent), parentText);
  assert.deepEqual(calls,[['/forum/thread/reply',{reply_id:'42'}],['/forum/thread/reply',{reply_id:'41'}]]);
});

test('Dev Tracker context uses the original Spectrum post when the target replies to the thread', async () => {
  const result = await loadReplyParent('topic','42',async (endpoint, body) => endpoint.endsWith('/reply')
    ? { id:'42', thread_id:'10', parent_reply_id:'' }
    : { id:'10', content_reply_id:'1', member:{displayname:'Thread author'}, lexical_content:JSON.stringify({root:{type:'root',children:[{type:'paragraph',children:[{text:'Opening post text'}]}]}}) });
  assert.equal(result.id,'1');
  assert.equal(result.is_thread_content,true);
  assert.equal(result.member.displayname,'Thread author');
  assert.equal(replyText(result),'Opening post text');
});

test('Dev Tracker context rejects cross-thread parents and reports erased source posts honestly', async () => {
  await assert.rejects(loadReplyParent('topic','42',async (_endpoint, body) => body.reply_id === '42'
    ? { id:'42', thread_id:'10', parent_reply_id:'41' }
    : { id:'41', thread_id:'99' }));
  assert.equal(replyText({ id:'41', is_erased:true }), 'This post has been deleted.');
});

test('Lexical text preserves paragraphs and line breaks without interpreting markup', () => {
  assert.equal(lexicalText({ type: 'root', children: [ { type: 'paragraph', children: [{text:'<script>literal</script>'},{type:'linebreak'},{text:'Next line'}] }, {type:'paragraph',children:[{text:'Next paragraph'}]} ] }), '<script>literal</script>\nNext line\n\nNext paragraph');
});
