import assert from 'node:assert';
import { describe, test } from 'node:test';
import { stringify } from '../../src/utils/json.js';

describe('JSON Utilities', () => {
  describe('stringify', () => {
    test('should stringify simple objects', () => {
      const obj = { name: 'John', age: 30 };
      const result = stringify(obj);
      assert.strictEqual(result, '{"name":"John","age":30}');
    });

    test('should stringify arrays', () => {
      const arr = [1, 2, 3];
      const result = stringify(arr);
      assert.strictEqual(result, '[1,2,3]');
    });

    test('should stringify null', () => {
      const result = stringify(null);
      assert.strictEqual(result, 'null');
    });

    test('should stringify booleans', () => {
      assert.strictEqual(stringify(true), 'true');
      assert.strictEqual(stringify(false), 'false');
    });

    test('should stringify numbers', () => {
      assert.strictEqual(stringify(42), '42');
      assert.strictEqual(stringify(3.14), '3.14');
    });

    test('should stringify strings', () => {
      assert.strictEqual(stringify('hello'), '"hello"');
    });

    test('should format with space option', () => {
      const obj = { a: 1, b: 2 };
      const result = stringify(obj, { space: 2 });
      assert.ok(result.includes('\n'));
      assert.ok(result.includes('  '));
    });

    test('should use custom replacer function', () => {
      const obj = { a: 1, b: 2, c: 3 };
      const result = stringify(obj, {
        replacer: (key, value) => {
          if (key === 'b') return undefined;
          return value;
        },
      });
      const parsed = JSON.parse(result);
      assert.strictEqual(parsed.a, 1);
      assert.strictEqual(parsed.b, undefined);
      assert.strictEqual(parsed.c, 3);
    });

    test('should escape HTML characters when escapeHtml is true', () => {
      const obj = { script: '<script>alert("xss")</script>' };
      const result = stringify(obj, { escapeHtml: true });
      assert.ok(result.includes('\\u003c'));
      assert.ok(result.includes('\\u003e'));
      assert.ok(!result.includes('<'));
      assert.ok(!result.includes('>'));
    });

    test('should escape < character', () => {
      const obj = { html: 'a < b' };
      const result = stringify(obj, { escapeHtml: true });
      assert.ok(result.includes('\\u003c'));
      assert.ok(!result.includes('a < b'));
    });

    test('should escape > character', () => {
      const obj = { html: 'a > b' };
      const result = stringify(obj, { escapeHtml: true });
      assert.ok(result.includes('\\u003e'));
      assert.ok(!result.includes('a > b'));
    });

    test('should escape & character', () => {
      const obj = { html: 'a & b' };
      const result = stringify(obj, { escapeHtml: true });
      assert.ok(result.includes('\\u0026'));
      assert.ok(!result.includes('a & b'));
    });

    test('should escape all HTML characters together', () => {
      const obj = { xss: '<script>alert("xss");</script> & more' };
      const result = stringify(obj, { escapeHtml: true });
      assert.ok(result.includes('\\u003c'));
      assert.ok(result.includes('\\u003e'));
      assert.ok(result.includes('\\u0026'));
    });

    test('should not escape when escapeHtml is false', () => {
      const obj = { html: '<div>content</div>' };
      const result = stringify(obj, { escapeHtml: false });
      assert.ok(result.includes('<'));
      assert.ok(result.includes('>'));
    });

    test('should not escape by default', () => {
      const obj = { html: '<div>content</div>' };
      const result = stringify(obj);
      assert.ok(result.includes('<'));
      assert.ok(result.includes('>'));
    });

    test('should work with nested objects', () => {
      const obj = {
        user: {
          name: 'John',
          details: {
            age: 30,
            city: 'NYC',
          },
        },
      };
      const result = stringify(obj);
      const parsed = JSON.parse(result);
      assert.deepStrictEqual(parsed, obj);
    });

    test('should escape HTML in nested objects', () => {
      const obj = {
        level1: {
          level2: {
            html: '<script>alert("nested")</script>',
          },
        },
      };
      const result = stringify(obj, { escapeHtml: true });
      assert.ok(result.includes('\\u003c'));
      assert.ok(result.includes('\\u003e'));
      assert.ok(!result.includes('<script>'));
    });

    test('should work with replacer and escapeHtml together', () => {
      const obj = { a: '<div>', b: 'keep', c: 'remove' };
      const result = stringify(obj, {
        replacer: (key, value) => {
          if (key === 'c') return undefined;
          return value;
        },
        escapeHtml: true,
      });
      assert.ok(result.includes('\\u003c'));
      assert.ok(result.includes('keep'));
      assert.ok(!result.includes('remove'));
    });

    test('should work with space and escapeHtml together', () => {
      const obj = { html: '<div>test</div>' };
      const result = stringify(obj, { space: 2, escapeHtml: true });
      assert.ok(result.includes('\n'));
      assert.ok(result.includes('\\u003c'));
      assert.ok(result.includes('\\u003e'));
    });

    test('should handle empty objects', () => {
      const result = stringify({});
      assert.strictEqual(result, '{}');
    });

    test('should handle empty arrays', () => {
      const result = stringify([]);
      assert.strictEqual(result, '[]');
    });

    test('should handle undefined properties in objects', () => {
      const obj = { a: 1, b: undefined, c: 3 };
      const result = stringify(obj);
      const parsed = JSON.parse(result);
      assert.strictEqual(parsed.a, 1);
      assert.strictEqual(parsed.b, undefined);
      assert.strictEqual(parsed.c, 3);
    });

    test('should prevent XSS attack vectors', () => {
      const dangerousData = {
        xss1: '<img src=x onerror=alert(1)>',
        xss2: '<svg/onload=alert(2)>',
        xss3: '</script><script>alert(3)</script>',
      };
      const result = stringify(dangerousData, { escapeHtml: true });

      // Ensure no dangerous characters remain unescaped
      assert.ok(!result.includes('<img'));
      assert.ok(!result.includes('<svg'));
      assert.ok(!result.includes('</script>'));
      assert.ok(!result.includes('<script>'));

      // All should be escaped
      assert.ok(result.includes('\\u003c'));
      assert.ok(result.includes('\\u003e'));
    });
  });
});
