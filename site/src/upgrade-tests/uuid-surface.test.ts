import { describe, expect, it } from 'vitest';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';

describe('uuid v4 surface used in chore-tracker site', () => {
  it('generates RFC 4122 v4 UUIDs', () => {
    const id = uuidv4();
    expect(uuidValidate(id)).toBe(true);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
