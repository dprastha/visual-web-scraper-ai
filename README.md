# AI HTML Extractor

This repo has been refactored into a single fullstack Next.js + TypeScript application.

## Stack

- Next.js App Router
- React 19
- TypeScript
- Puppeteer for remote page sessions
- OpenAI-compatible chat completions for structured scraping strategy generation
- AJV for strategy JSON validation

## Scripts

- `npm run dev` starts the fullstack app locally
- `npm run build` creates a production build
- `npm run start` serves the production build
- `npm run typecheck` generates Next.js route types and runs TypeScript checks

## App Structure

- `app/` contains the UI shell and API route handlers
- `components/` contains the client workbench UI
- `lib/server/` contains session, selector, strategy, validation, and script generation logic
- `lib/types.ts` contains shared application types

## Notes

- The strategy layer calls an OpenAI-compatible endpoint at `OPENAI_COMPATIBLE_BASE_URL` and defaults to `http://127.0.0.1:1234/v1`.
- The strategy model is fixed to `mistralai/ministral-3-3b`.
- Set `OPENAI_COMPATIBLE_API_KEY` if your endpoint requires bearer auth.
- The LLM never writes executable scraper code directly. It returns structured JSON that is validated before the backend generates the final Puppeteer script from templates.
- The previous `backend/` and `frontend/` folders are still present in the repo as legacy references and can be removed once you no longer need them.
