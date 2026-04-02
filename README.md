# AI HTML Extractor

This repo has been refactored into a single fullstack Next.js + TypeScript application.

## Stack

- Next.js App Router
- React 19
- TypeScript
- Puppeteer for remote page sessions

## Scripts

- `npm run dev` starts the fullstack app locally
- `npm run build` creates a production build
- `npm run start` serves the production build
- `npm run typecheck` generates Next.js route types and runs TypeScript checks

## App Structure

- `app/` contains the UI shell and API route handlers
- `components/` contains the client workbench UI
- `lib/server/` contains session, selector, and script generation logic
- `lib/types.ts` contains shared application types

## Notes

- The previous `backend/` and `frontend/` folders are still present in the repo as legacy references and can be removed once you no longer need them.
