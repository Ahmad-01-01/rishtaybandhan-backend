FROM node:18-alpine

WORKDIR /workspace

# Only copy the files needed for install first
COPY package.json package-lock.json ./

# Install dependencies based on lockfile
RUN npm ci --omit=dev

# Now copy the rest of your code
COPY . .

EXPOSE 8080

CMD ["node", "index.js"]