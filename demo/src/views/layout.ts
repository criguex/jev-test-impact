import { escapeHtml } from './html.js';

export interface LayoutOptions {
  title: string;
  userName?: string;
  cartCount: number;
}

export function layout(options: LayoutOptions, body: string): string {
  const account = options.userName
    ? `<span data-testid="greeting">Hi, ${escapeHtml(options.userName)}</span>
       <form method="post" action="/logout"><button data-testid="logout">Log out</button></form>`
    : `<a href="/login" data-testid="login-link">Log in</a>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(options.title)} · Paper Lantern Books</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header>
    <a href="/" class="brand">Paper Lantern Books</a>
    <form action="/search" role="search"><input name="q" aria-label="Search books" placeholder="Search"></form>
    <nav>
      <a href="/cart">Cart (<span data-testid="cart-count">${options.cartCount}</span>)</a>
      ${account}
    </nav>
  </header>
  <main>
    <h1>${escapeHtml(options.title)}</h1>
    ${body}
  </main>
</body>
</html>`;
}
