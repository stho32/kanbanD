// Unit-Tests des Markdowns (node --test)
const test = require('node:test');
const assert = require('node:assert');
const { markdownHtml } = require('../../web/markdown.js');

test('Elemente', () => {
  assert.strictEqual(markdownHtml('# T\n\n**a** *b* `c`\n- x\n- y'), '<h3>T</h3><p><strong>a</strong> <em>b</em> <code>c</code></p><ul><li>x</li><li>y</li></ul>');
  assert.strictEqual(markdownHtml('1. a\n2. b'), '<ol><li>a</li><li>b</li></ol>');
  assert.strictEqual(markdownHtml('a\nb\n\nc'), '<p>a<br>b</p><p>c</p>');
  assert.strictEqual(markdownHtml('> z'), '<blockquote>z</blockquote>');
  assert.strictEqual(markdownHtml('```\nlet a = 1 < 2;\n```'), '<pre><code>let a = 1 &lt; 2;</code></pre>');
  assert.strictEqual(markdownHtml('## H', 0), '<h2>H</h2>');
  assert.strictEqual(markdownHtml(''), '');
});

test('Links und Sicherheit', () => {
  assert.strictEqual(markdownHtml('[Doku](https://x.de/a?b=1&c=2)'), '<p><a href="https://x.de/a?b=1&amp;c=2" target="_blank" rel="noopener">Doku</a></p>');
  assert.strictEqual(markdownHtml('siehe https://x.de'), '<p>siehe <a href="https://x.de" target="_blank" rel="noopener">https://x.de</a></p>');
  assert.ok(!markdownHtml('[x](javascript:alert(1))').includes('<a'), 'kein Link für javascript:');
  assert.strictEqual(markdownHtml('<script>alert(1)</script>'), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  assert.strictEqual(markdownHtml('[a"b](x" onmouseover="y)'), '<p>a&quot;b</p>'.replace('a&quot;b', '[a&quot;b](x&quot; onmouseover=&quot;y)'));
  assert.strictEqual(markdownHtml('`**kein fett**`'), '<p><code>**kein fett**</code></p>');
});
