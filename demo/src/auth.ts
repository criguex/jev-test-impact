import { randomUUID } from 'node:crypto';

export interface User {
  email: string;
  name: string;
  password: string;
}

const users: User[] = [{ email: 'reader@example.com', name: 'Reader', password: 'open-sesame1' }];
const sessions = new Map<string, string>();

export const MIN_PASSWORD_LENGTH = 8;

export function validatePassword(password: string): string[] {
  const problems: string[] = [];
  if (password.length < MIN_PASSWORD_LENGTH) {
    problems.push(`at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (!/\d/.test(password)) {
    problems.push('at least one digit');
  }
  return problems;
}

export function login(email: string, password: string): string | null {
  const user = users.find((candidate) => candidate.email === email.trim().toLowerCase());
  if (!user || user.password !== password) {
    return null;
  }
  const token = randomUUID();
  sessions.set(token, user.email);
  return token;
}

export function currentUser(token: string | undefined): User | undefined {
  const email = token ? sessions.get(token) : undefined;
  return users.find((user) => user.email === email);
}

export function logout(token: string | undefined): void {
  if (token) {
    sessions.delete(token);
  }
}
