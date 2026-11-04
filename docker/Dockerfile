# Node only lives in the build stages; the shipped image is nginx serving static files.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Dev server: source is bind-mounted by compose, node_modules stays in the image.
FROM deps AS dev
EXPOSE 5173
CMD ["npm", "run", "dev"]

# Checks: git for the floor guard, gitleaks for secret scanning (copied from its official image).
FROM deps AS check
RUN apk add --no-cache git && git config --global --add safe.directory /app
COPY --from=zricethezav/gitleaks:v8.21.2 /usr/bin/gitleaks /usr/local/bin/gitleaks

# Browser tests: Playwright's own image (Ubuntu) ships Chromium and WebKit with their system libraries. Its
# version must match @playwright/test in package.json.
FROM mcr.microsoft.com/playwright:v1.64.1-noble AS e2e
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
CMD ["npm", "run", "e2e"]

FROM deps AS build
COPY . .
RUN npm run build

# alpine-slim drops njs and other modules we don't use (~76 MB → small enough for the 50 MB budget).
FROM nginx:1.27-alpine-slim AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
