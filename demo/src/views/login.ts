import { escapeHtml } from './html.js';

export function loginPage(error?: string): string {
  const alert = error ? `<p role="alert" data-testid="login-error">${escapeHtml(error)}</p>` : '';
  return `${alert}
<form method="post" action="/login" data-testid="login-form">
  <label>Email <input name="email" type="email" autocomplete="username"></label>
  <label>Password <input name="password" type="password" autocomplete="current-password"></label>
  <button data-testid="login-submit">Log in</button>
</form>`;
}
