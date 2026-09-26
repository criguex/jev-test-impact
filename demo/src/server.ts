import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { currentUser, login, logout } from './auth.js';
import { Cart } from './cart.js';
import { findBook, listBooks } from './catalog.js';
import { OutOfStockError } from './inventory.js';
import { formatMoney } from './money.js';
import { isKnownCode } from './pricing.js';
import { searchBooks } from './search.js';
import { isShippingMethod, type ShippingMethod } from './shipping.js';
import { cartPage } from './views/cart.js';
import { bookDetail, bookList } from './views/catalog.js';
import { checkoutPage, confirmationPage } from './views/checkout.js';
import { layout } from './views/layout.js';
import { loginPage } from './views/login.js';

const carts = new Map<string, Cart>();
const stylesheet = new URL('../public/styles.css', import.meta.url);

interface Context {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  cookies: Record<string, string>;
  cart: Cart;
  sessionId: string;
}

function parseCookies(header: string | undefined): Record<string, string> {
  return Object.fromEntries(
    (header ?? '')
      .split(';')
      .map((part) => part.trim().split('='))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key, decodeURIComponent(value!)]),
  );
}

async function readForm(req: IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

function redirect(ctx: Context, location: string): void {
  ctx.res.writeHead(303, { location });
  ctx.res.end();
}

function page(ctx: Context, title: string, body: string, status = 200): void {
  const user = currentUser(ctx.cookies.auth);
  const html = layout({ title, userName: user?.name, cartCount: ctx.cart.summary().itemCount }, body);
  ctx.res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
  ctx.res.end(html);
}

function shippingMethod(value: string | null): ShippingMethod {
  return value && isShippingMethod(value) ? value : 'standard';
}

async function route(ctx: Context): Promise<void> {
  const { req, url } = ctx;
  const key = `${req.method} ${url.pathname}`;

  if (key === 'GET /health') {
    ctx.res.writeHead(200, { 'content-type': 'application/json' });
    ctx.res.end(JSON.stringify({ status: 'ok', books: listBooks().length }));
    return;
  }
  if (key === 'GET /styles.css') {
    ctx.res.writeHead(200, { 'content-type': 'text/css' });
    ctx.res.end(await readFile(stylesheet));
    return;
  }
  if (key === 'GET /') {
    page(ctx, 'Catalog', bookList(listBooks()));
    return;
  }
  if (key === 'GET /search') {
    const query = url.searchParams.get('q') ?? '';
    page(ctx, `Results for "${query}"`, bookList(searchBooks(query)));
    return;
  }
  if (req.method === 'GET' && url.pathname.startsWith('/book/')) {
    const book = findBook(url.pathname.slice('/book/'.length));
    if (!book) {
      page(ctx, 'Not found', '<p>That book does not exist.</p>', 404);
      return;
    }
    page(ctx, book.title, bookDetail(book));
    return;
  }
  if (key === 'POST /cart/add') {
    const form = await readForm(req);
    try {
      ctx.cart.add(form.get('bookId') ?? '', Number(form.get('quantity') ?? 1));
      redirect(ctx, '/cart');
    } catch (error) {
      const message = error instanceof OutOfStockError ? 'Not enough stock' : 'Could not add book';
      page(ctx, 'Cart', cartPage(ctx.cart.summary(), message), 409);
    }
    return;
  }
  if (key === 'POST /cart/quantity') {
    const form = await readForm(req);
    try {
      ctx.cart.setQuantity(form.get('bookId') ?? '', Number(form.get('quantity') ?? 0));
      redirect(ctx, '/cart');
    } catch {
      page(ctx, 'Cart', cartPage(ctx.cart.summary(), 'Not enough stock'), 409);
    }
    return;
  }
  if (key === 'POST /cart/remove') {
    const form = await readForm(req);
    ctx.cart.remove(form.get('bookId') ?? '');
    redirect(ctx, '/cart');
    return;
  }
  if (key === 'POST /cart/discount') {
    const code = (await readForm(req)).get('code') ?? '';
    if (!isKnownCode(code)) {
      page(ctx, 'Cart', cartPage(ctx.cart.summary(), `Code ${code} is not valid`), 422);
      return;
    }
    ctx.cart.useDiscount(code);
    redirect(ctx, '/cart');
    return;
  }
  if (key === 'GET /cart') {
    page(ctx, 'Cart', cartPage(ctx.cart.summary()));
    return;
  }
  if (key === 'GET /checkout') {
    const method = shippingMethod(url.searchParams.get('method'));
    page(ctx, 'Checkout', checkoutPage(ctx.cart.summary('US', method), method));
    return;
  }
  if (key === 'POST /checkout') {
    const method = shippingMethod((await readForm(req)).get('method'));
    const summary = ctx.cart.summary('US', method);
    if (summary.itemCount === 0) {
      redirect(ctx, '/cart');
      return;
    }
    const orderId = `PL-${ctx.sessionId.slice(0, 8).toUpperCase()}`;
    ctx.cart.clear();
    page(ctx, 'Thank you', confirmationPage(orderId, formatMoney(summary.totalCents)));
    return;
  }
  if (key === 'GET /login') {
    page(ctx, 'Log in', loginPage());
    return;
  }
  if (key === 'POST /login') {
    const form = await readForm(req);
    const token = login(form.get('email') ?? '', form.get('password') ?? '');
    if (!token) {
      page(ctx, 'Log in', loginPage('Email or password is incorrect'), 401);
      return;
    }
    ctx.res.setHeader('set-cookie', `auth=${token}; Path=/; HttpOnly; SameSite=Lax`);
    redirect(ctx, '/');
    return;
  }
  if (key === 'POST /logout') {
    logout(ctx.cookies.auth);
    ctx.res.setHeader('set-cookie', 'auth=; Path=/; Max-Age=0');
    redirect(ctx, '/');
    return;
  }
  page(ctx, 'Not found', '<p>Nothing here.</p>', 404);
}

export function createApp(): Server {
  return createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const cookies = parseCookies(req.headers.cookie);
    let sessionId = cookies.sid;
    if (!sessionId || !carts.has(sessionId)) {
      sessionId = randomUUID();
      carts.set(sessionId, new Cart());
      res.setHeader('set-cookie', `sid=${sessionId}; Path=/; HttpOnly; SameSite=Lax`);
    }
    const ctx: Context = { req, res, url, cookies, cart: carts.get(sessionId)!, sessionId };
    route(ctx).catch((error: unknown) => {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end(String(error));
    });
  });
}
