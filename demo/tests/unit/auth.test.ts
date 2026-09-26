import { describe, expect, it } from 'vitest';
import { currentUser, login, logout, validatePassword } from '../../src/auth.js';

describe('auth', () => {
  it('accepts a long password with a digit', () => {
    expect(validatePassword('lantern42')).toEqual([]);
  });

  it('explains short passwords', () => {
    expect(validatePassword('ab1')).toContain('at least 8 characters');
  });

  it('requires a digit', () => {
    expect(validatePassword('lanternlight')).toEqual(['at least one digit']);
  });

  it('logs in with the right credentials', () => {
    expect(login('Reader@example.com ', 'open-sesame1')).toMatch(/[0-9a-f-]{36}/);
  });

  it('rejects wrong passwords', () => {
    expect(login('reader@example.com', 'guess')).toBeNull();
  });

  it('ends the session on logout', () => {
    const token = login('reader@example.com', 'open-sesame1')!;
    expect(currentUser(token)?.name).toBe('Reader');
    logout(token);
    expect(currentUser(token)).toBeUndefined();
  });
});
