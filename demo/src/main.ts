import { createApp } from './server.js';

const port = Number(process.env.PORT ?? 4173);
createApp().listen(port, () => {
  console.log(`Paper Lantern Books on http://localhost:${port}`);
});
