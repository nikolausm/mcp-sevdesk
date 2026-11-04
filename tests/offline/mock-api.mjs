import assert from 'node:assert/strict';

let count = 0;
// Every request is intercepted before any network access or accounting action.
globalThis.fetch = async input => {
  const request = input instanceof Request ? input : new Request(input);
  const url = new URL(request.url);
  assert.equal(url.origin, 'https://my.sevdesk.de');
  assert.ok(url.pathname.startsWith('/api/v1/'));
  assert.equal(request.headers.get('Authorization'), 'synthetic-token');
  const bodyText = await request.text();
  const data = { method: request.method, path: url.pathname.slice('/api/v1'.length), query: Object.fromEntries(url.searchParams), body: bodyText ? JSON.parse(bodyText) : null, count: ++count };
  if (url.pathname.endsWith('/Contact/999')) {
    return Response.json({ message: 'Synthetic provider error' }, { status: 400 });
  }
  return Response.json(data);
};
