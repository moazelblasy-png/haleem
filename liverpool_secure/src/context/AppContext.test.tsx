import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { AppProvider } from './AppContext';

test('AppProvider renders without startup initialization errors', () => {
  assert.doesNotThrow(() => {
    const html = renderToString(
      createElement(AppProvider, null, createElement('div', null, 'Liverpool Gaming ready')),
    );
    assert.match(html, /Liverpool Gaming ready/);
  });
});
