# ---- Stage 1: build the React app ----
# Uses Node to install packages and run "npm run build", which creates the dist/ folder.
FROM node:22-alpine AS build
WORKDIR /app

# Copy only the package files first. Docker caches this step, so packages are only
# reinstalled when package.json changes, not on every code change.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Stage 2: serve it ----
# The final image only contains nginx + the built files (no Node, no source code),
# so it's small (~50 MB) and fast.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
