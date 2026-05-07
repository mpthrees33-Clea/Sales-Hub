# Sales Hub Assistant Worker

Cloudflare Worker that proxies chat requests from the Sales Hub frontend to Gemini 2.5 Flash. Holds the API key out of the browser bundle.

## One-time setup

From this `worker/` directory:

```bash
npm install
npx wrangler login              # opens browser, signs you into Cloudflare
npx wrangler secret put GEMINI_API_KEY   # paste the key when prompted
npx wrangler deploy
```

After `deploy`, Wrangler prints the public URL — something like:
```
https://sales-hub-assistant.<your-account>.workers.dev
```

Copy that URL. The frontend reads it from a build-time env var; see `../README.md`.

## Local dev

```bash
echo "GEMINI_API_KEY=your-key-here" > .dev.vars
npx wrangler dev
```

Worker runs at `http://localhost:8787`.

## Updating

Edit `src/index.ts`, then `npx wrangler deploy` again.

## Where the system prompt lives

In `src/index.ts`, top of file. Edit + redeploy when you want to change tone or rules.

The frontend can also send a `knowledge` string with each request — that's how the planned `/knowledge/*.md` folder will plug in later.
