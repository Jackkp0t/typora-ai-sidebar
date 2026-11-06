import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSelectedText } from '../src/lib/selection';

const cm = (sel: string) => ({ getSelection: () => sel, somethingSelected: () => !!sel });
const doc = (els: any[], active?: any) => ({
  activeElement: active ? { closest: () => active } : null,
  querySelector: () => null, querySelectorAll: () => els,
});

test('window selection wins', () => {
  assert.equal(getSelectedText({ getSelection: () => ({ toString: () => '正文' }) }, doc([])), '正文');
});
test('falls back to Typora source view CodeMirror', () => {
  assert.equal(getSelectedText({ getSelection: () => ({ toString: () => '' }), File: { editor: { sourceView: { cm: cm('源码') } } } }, doc([])), '源码');
});
test('falls back to code fence / math CodeMirror element', () => {
  assert.equal(getSelectedText({ getSelection: () => null }, doc([{ CodeMirror: cm('') }, { CodeMirror: cm('$x^2$') }])), '$x^2$');
});
test('throwing probes degrade to empty string', () => {
  const bad = { getSelection() { throw new Error('x'); }, get File() { throw new Error('y'); } };
  assert.equal(getSelectedText(bad, { get activeElement() { throw new Error('z'); } }), '');
});
