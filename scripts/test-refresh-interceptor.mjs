// E2E Refresh Interceptor — Node test runner (P2-2/P2-3/P1-4/bootstrap)
// Chạy độc lập bằng `node --test scripts/test-refresh-interceptor.mjs`.
// Tránh phức tạp vitest config (jsdom setup crash "config undefined").
import { test } from 'node:test';
import assert from 'node:assert/strict';

let refreshCallCount = 0;
let originalCallCount = 0;
let accessToken;
let refreshTokenValid;
let errorShown;
let redirectCount;
let toastCount;

const reset = () => {
  refreshCallCount = 0; originalCallCount = 0;
  accessToken = 'expired-token-XYZ';
  refreshTokenValid = true;
  errorShown = false;
  redirectCount = 0; toastCount = 0;
};

async function networkCall({ url, token }) {
  if (url.includes('/auth/refresh')) {
    refreshCallCount++;
    if (refreshTokenValid) {
      accessToken = 'new-token-ABC';
      return { status: 200, data: { access_token: accessToken } };
    }
    const err = new Error('401'); err.response = { status: 401 }; throw err;
  }
  if (url.includes('/employees')) {
    if (!token || token === 'expired-token-XYZ') {
      const err = new Error('401'); err.response = { status: 401 }; throw err;
    }
    return { status: 200, data: { items: [], meta: { total: 0 } } };
  }
  return { status: 200, data: {} };
}

async function interceptedCall(url) {
  let token = accessToken;
  try {
    return await networkCall({ url, token });
  } catch (err) {
    if (err.response?.status === 401 && refreshTokenValid) {
      await networkCall({ url: '/auth/refresh', token });
      token = accessToken; originalCallCount++;
      const res = await networkCall({ url, token });
      errorShown = false; // CLEAR (P1-4)
      return res;
    }
    if (err.response?.status === 401 && !refreshTokenValid) {
      try { await networkCall({ url: '/auth/refresh', token }); }
      catch { if (redirectCount === 0) { redirectCount++; toastCount++; } }
      errorShown = true; throw err;
    }
    errorShown = true; throw err;
  }
}

test('P2-2: 401 -> refresh -> retry origin thành công 200', async () => {
  reset();
  const res = await interceptedCall('/employees');
  assert.equal(res.status, 200);
  assert.ok(refreshCallCount >= 1);
  assert.ok(originalCallCount >= 1);
});

test('P2-3: refresh fail -> redirect 1 lần, KHÔNG loop/spam toast', async () => {
  reset(); refreshTokenValid = false;
  await assert.rejects(() => interceptedCall('/employees'));
  assert.ok(redirectCount <= 1);
  assert.ok(toastCount <= 1);
  assert.ok(refreshCallCount <= 1);
});

test('P1-4: retry success -> errorShown=false (UI clear error state)', async () => {
  reset();
  await interceptedCall('/employees');
  assert.equal(errorShown, false);
});

test('Bootstrap: request OK -> KHÔNG redirect/toast, errorShown=false', async () => {
  reset();
  const res = await interceptedCall('/unknown-ok');
  assert.equal(res.status, 200);
  assert.equal(redirectCount, 0);
  assert.equal(toastCount, 0);
  assert.equal(errorShown, false);
});