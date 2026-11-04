# 0001 — Web app in Docker, no Flutter

**Date:** 2026-11-03 · **Status:** accepted (owner) · **Supersedes:** the Flutter + Firebase choice of 2026-11-02

## Context

The owner wants a browser-only app, run and deployed with Docker, for students on school Chromebooks, laptops and
iPads. Release 1 is offline-only with no accounts (child-data risk stays low).

## Decision

TypeScript (strict) + React 18 + Vite, Zustand, React Router, CSS Modules with design tokens, Framer Motion outside
timed tests, KaTeX for display, `mathjs` in the question verifier, Dexie (IndexedDB) for local data, `vite-plugin-pwa`
for offline. Tests: Vitest + Testing Library, Playwright (Chromium + WebKit) + axe-core. Docker: Node 22 LTS build
stage → `nginx:alpine` runtime; `compose.yaml` services `dev`, `web`, `check`, `e2e`.

## Consequences

- One codebase, no app-store builds; iPad support comes through Safari/WebKit and the PWA.
- No server in Release 1, so no backups across devices: export/import JSON covers moving data.
- Release 2 (accounts, sync) needs a new ADR for the API and database containers.
- Every project command runs through `docker compose`, so the host needs only Docker.
