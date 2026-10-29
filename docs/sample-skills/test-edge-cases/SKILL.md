---
name: test-edge-cases
description: ALWAYS flag when tests added in a PR only exercise typical inputs and skip the edge cases of the changed code (empty, null/undefined, zero, negative, limits, error paths).
---

# Test edge cases

ALWAYS apply this when a PR adds or changes tests.

## Rule
For every function under test, check that the tests include, where the input
type allows it:

- **Empty**: `""`, `[]`, `{}`, a list with exactly one item.
- **Missing**: `null` / `undefined` / an absent optional field.
- **Numbers**: `0`, a negative value, the maximum or limit value, and one past
  the limit (off-by-one).
- **Error paths**: every `throw`, rejected promise, or error status the code
  can produce.

If the tests use only "normal" inputs, report a **WARNING** that names the
missing edge case and gives the exact test to add (input → expected result).

## Bad
```ts
it('paginates', () => {
  expect(page([1, 2, 3, 4], 1, 2)).toEqual([1, 2]);
});
```
No test for an empty list, page 0, a page past the end, or `size <= 0`.

## Good
```ts
it.each([
  [[], 1, 2, []],
  [[1, 2, 3], 2, 2, [3]],
  [[1, 2, 3], 3, 2, []],
])('page(%j, %i, %i) = %j', (xs, p, size, out) => expect(page(xs, p, size)).toEqual(out));
it('rejects size <= 0', () => expect(() => page([1], 1, 0)).toThrow());
```
