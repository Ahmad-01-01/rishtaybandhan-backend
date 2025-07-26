FROM node:18-alpine AS builder
WORKDIR /workspace
COPY package*.json .
RUN npm ci --omit=dev
COPY . .

# Copy .env and service account key
COPY .env .
COPY serviceAccountKey.json .

FROM node:18-alpine
WORKDIR /workspace
COPY --from=builder /workspace /workspace
RUN addgroup -g 1001 nodeapp && adduser -S -u 1001 -G nodeapp nodeapp
USER nodeapp
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "index.js"]