FROM node:22-alpine

WORKDIR /app

# Install system dependencies for systeminformation
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    linux-headers

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy source code
COPY server.js ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
