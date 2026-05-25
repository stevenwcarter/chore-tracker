import { describe, expect, it } from 'vitest';

// Characterization for TS features in active use in this codebase. The real
// type-checking gate is `tsc --noEmit` via `yarn build`; these runtime checks
// just confirm the patterns still behave as expected.
describe('TypeScript surface used in chore-tracker site', () => {
  it('optional chaining and nullish coalescing work', () => {
    const obj: { a?: { b?: number } } = { a: {} };
    expect(obj.a?.b ?? 0).toBe(0);
  });

  it('discriminated unions narrow correctly', () => {
    type Shape = { kind: 'circle'; r: number } | { kind: 'square'; side: number };
    function area(s: Shape): number {
      return s.kind === 'circle' ? Math.PI * s.r * s.r : s.side * s.side;
    }
    expect(area({ kind: 'circle', r: 5 })).toBeCloseTo(Math.PI * 25);
    expect(area({ kind: 'square', side: 4 })).toBe(16);
  });

  it('generics with extends bounds infer correctly', () => {
    function first<T extends ReadonlyArray<unknown>>(arr: T): T[0] | undefined {
      return arr[0];
    }
    expect(first([1, 2, 3] as const)).toBe(1);
    expect(first([] as const)).toBeUndefined();
  });
});
