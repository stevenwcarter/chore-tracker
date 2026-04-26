import createFetchMock from 'vitest-fetch-mock';
import { vi, beforeAll, afterAll } from 'vitest';

// Apollo 3.14 has a CJS/ESM module-boundary bug where MockedProvider's
// muteDeprecations() call doesn't suppress InMemoryCache/cache.diff warnings.
// Suppress those specific internal warnings until Apollo fixes this.
const _warn = console.warn;
beforeAll(() => {
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('go.apollo.dev')) return;
    _warn(...args);
  };
});
afterAll(() => {
  console.warn = _warn;
});

const fetchMocker = createFetchMock(vi);

fetchMocker.enableMocks();
beforeEach(() => {
  fetchMocker.mockIf(/\/api\/v1\/search.*/, (_req) => {
    const mockBody = {
      limit: 10,
      offset: 0,
      total: 20,
      data: [{ a: 'a' }, { a: 'b' }],
    };

    return {
      body: JSON.stringify(mockBody),
    };
  });
});
