// index.html must stay tag-balanced: the Menu sheet restructuring once
// duplicated a <dialog> opening and lost a closing </div> by hand. This test
// catches that without any dependency: a stack over the tags, ignoring void
// elements, comments and the contents of <script>/<style>. Attribute values
// containing ">" (Alpine bindings) are handled by the tag regex below.
import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

function balancedTags(html) {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');

  const stack = [];
  for (const match of cleaned.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g)) {
    const [, close, rawName, attrs] = match;
    const tag = rawName.toLowerCase();
    if (VOID.has(tag) || /\/\s*$/.test(attrs)) continue; // void or self-closing
    if (close) {
      const open = stack.pop();
      if (open !== tag) return `</${tag}> closes <${open ?? 'nothing'}>`;
    } else {
      stack.push(tag);
    }
  }
  return stack.length ? `<${stack[stack.length - 1]}> never closed` : null;
}

export { balancedTags };

test('index.html tags are balanced', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal(balancedTags(html), null);
});
