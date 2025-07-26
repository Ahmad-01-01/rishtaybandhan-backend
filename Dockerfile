FROM node:18-alpine

WORKDIR /workspace

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 8080

CMD ["node", "index.js"]