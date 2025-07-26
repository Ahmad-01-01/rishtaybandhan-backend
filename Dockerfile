# ---- Build Stage ----
FROM node:18-alpine AS builder

WORKDIR /workspace

# Install only prod dependencies (no devDependencies)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source code (all except node_modules)
COPY . .

# ---- Release (Runtime) Stage ----
FROM node:18-alpine

WORKDIR /workspace

# Copy dependencies and source from builder
COPY --from=builder /workspace /workspace

# Use non-root user for security (node user = UID 1000)
RUN addgroup -g 1001 nodeapp && adduser -S -u 1001 -G nodeapp nodeapp
USER nodeapp

ENV NODE_ENV=production

# Cloud Run forwards to this port by default
EXPOSE 8080

# Run your server
CMD ["node", "index.js"]