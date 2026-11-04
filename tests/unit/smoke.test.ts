import { describe, expect, it } from 'vitest';

// Proves the runner works inside the check container; real tests start in task 4.
describe('test runner', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
