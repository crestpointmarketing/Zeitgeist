import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
function load(file, mocks = {}) {
  const filename = path.resolve(root, file), exports = {};
  const source = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports, URL, URLSearchParams, require(name) {
    if (name in mocks) return mocks[name];
    return load(name.startsWith('@/') ? 'src/' + name.slice(2) + '.ts' : path.resolve(path.dirname(filename), name + '.ts'), mocks);
  } });
  return exports;
}
const links = load('src/lib/auth-link.ts');
const callback = createClient => load('src/app/auth/callback/route.ts', {
  '@/lib/supabase/server': { createClient },
  'next/server': { NextResponse: { redirect: url => new Response(null, { status: 307, headers: { Location: String(url) } }) } },
}).GET;
const request = query => new Request('https://zeitgeiststocks.com/auth/callback' + query);
const destination = response => new URL(response.headers.get('location'));

test('PKCE uses the exact flow slot and preserves a local return path', async () => {
  let captured;
  const get = callback(async () => ({ auth: { exchangeCodeForSession: async (...args) => { captured = args; return { data: { session: {}, redirectType: null }, error: null }; } } }));
  const response = await get(request('?code=single-use-code&sb_flow_id=correct-slot&next=%2Fresearch'));
  assert.equal(captured[0], 'single-use-code');
  assert.equal(captured[1].flowId, 'correct-slot');
  assert.equal(destination(response).pathname, '/research');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
});

test('a callback without code hands fragments to the browser without claiming authentication', async () => {
  const get = callback(() => { throw Error('must not exchange'); });
  const url = destination(await get(request('?next=%2Freset-password')));
  assert.equal(url.pathname, '/auth/complete');
  assert.equal(url.searchParams.get('next'), '/reset-password');
});

test('expired and missing-verifier errors have distinct recovery instructions', async () => {
  for (const [code, expected] of [['otp_expired', 'email_expired'], ['pkce_code_verifier_not_found', 'email_browser'], ['bad_code_verifier', 'email_browser']]) {
    const get = callback(async () => ({ auth: { exchangeCodeForSession: async () => ({ data: {}, error: { code } }) } }));
    const url = destination(await get(request('?code=secret&next=%2Fresearch')));
    assert.equal(url.searchParams.get('error'), expected);
    assert.equal(url.searchParams.get('next'), '/research');
    assert.equal(url.href.includes('secret'), false);
  }
});

test('upstream errors are not reflected and cannot provide an external return URL', async () => {
  const get = callback(() => { throw Error('must not exchange'); });
  const url = destination(await get(request('?error=access_denied&error_code=otp_expired&error_description=INJECTED&next=https%3A%2F%2Fevil.test')));
  assert.equal(url.origin, 'https://zeitgeiststocks.com');
  assert.equal(url.searchParams.get('error'), 'email_expired');
  assert.equal(url.searchParams.get('next'), '/cfo');
  assert.equal(url.href.includes('INJECTED'), false);
});

test('missing service and thrown exchange failures produce a retryable service notice', async () => {
  for (const create of [async () => null, async () => { throw Error('provider offline'); }]) {
    const url = destination(await callback(create)(request('?code=secret')));
    assert.equal(url.searchParams.get('error'), 'auth_unavailable');
  }
});

test('successful code response without a session is not authenticated', async () => {
  const get = callback(async () => ({ auth: { exchangeCodeForSession: async () => ({ data: { session: null }, error: null }) } }));
  assert.equal(destination(await get(request('?code=empty'))).pathname, '/login');
});

test('a verified PKCE recovery flow opens password recovery', async () => {
  const get = callback(async () => ({ auth: { exchangeCodeForSession: async () => ({ data: { session: {}, redirectType: 'recovery' }, error: null }) } }));
  assert.equal(destination(await get(request('?code=recovery&next=%2Fresearch'))).pathname, '/reset-password');
});

function fragmentClient({ setError = null, user = { id: 'verified-user' } } = {}) {
  const calls = [];
  return { calls, auth: {
    setSession: async tokens => { calls.push(['setSession', tokens]); return { error: setError }; },
    getUser: async () => { calls.push(['getUser']); return { data: { user }, error: null }; },
  } };
}
const validFragment = '#access_token=test-access&refresh_token=test-refresh&type=signup';

test('legacy fragments establish and verify the supplied session before navigating', async () => {
  const client = fragmentClient();
  assert.equal(await links.completeEmailFragment(validFragment, '/research', () => client), '/research');
  assert.equal(client.calls.length, 2);
  assert.equal(client.calls[0][1].refresh_token, 'test-refresh');
  assert.equal(client.calls[1][0], 'getUser');
});

test('empty and incomplete fragments never reuse an existing signed-in session', async () => {
  for (const hash of ['', '#type=recovery', '#access_token=only-access']) {
    const url = await links.completeEmailFragment(hash, '/reset-password', () => { throw Error('must not initialize'); });
    assert.match(url, /^\/login\?/);
  }
});

test('rejected fragment tokens cannot open recovery, even with an existing user', async () => {
  const client = fragmentClient({ setError: { code: 'otp_expired' } });
  const path = await links.completeEmailFragment(validFragment + '&type=recovery', '/reset-password', () => client);
  assert.match(path, /error=email_expired/);
  assert.equal(client.calls.length, 1);
});

test('recovery fragments require a verified user and ignore external return targets', async () => {
  assert.equal(await links.completeEmailFragment(validFragment.replace('signup', 'recovery'), '//evil.test', () => fragmentClient()), '/reset-password');
  assert.equal(await links.completeEmailFragment(validFragment, '//evil.test', () => fragmentClient()), '/stock-analysis');
  assert.match(await links.completeEmailFragment(validFragment, '/research', () => fragmentClient({ user: null })), /^\/login\?/);
});

test('fragment provider errors and service failures remain bounded and private', async () => {
  assert.match(await links.completeEmailFragment('#error=denied&error_code=otp_expired&error_description=PRIVATE', '/research', () => null), /error=email_expired/);
  const path = await links.completeEmailFragment(validFragment, '/research', () => { throw Error('PRIVATE'); });
  assert.match(path, /error=auth_unavailable/);
  assert.equal(path.includes('PRIVATE'), false);
});

test('email notices explain password sign-in without reflecting arbitrary errors', () => {
  assert.match(links.authLinkNotice('auth_callback'), /still sign in below with your email and password/);
  assert.match(links.authLinkNotice('email_browser'), /browser where you requested/);
  assert.equal(links.authLinkNotice('<script>untrusted</script>'), null);
});
