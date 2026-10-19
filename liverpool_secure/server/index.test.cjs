const test = require('node:test');
const assert = require('node:assert/strict');

// Keep the backend import deterministic: the test verifies routing without requiring
// production database credentials or a live Supabase project.
delete process.env.DATABASE_URL;
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_PUBLISHABLE_KEY;

const app = require('./index.cjs');

test('Express app can be imported and serves the API health route without DB configuration', async (t) => {
  assert.equal(typeof app, 'function');
  assert.equal(typeof app.listen, 'function');

  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object' && 'port' in address);

  const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: {
      code: 'DATABASE_UNAVAILABLE',
      message: 'Database unavailable.',
    },
  });
});
