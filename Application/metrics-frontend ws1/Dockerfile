FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Install curl for healtcheck
RUN apk add --no-cache curl

# Copy source files
COPY server.js ./
COPY index.html ./
COPY dashboard.js ./
COPY styles.css ./

EXPOSE 5173

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5173/health || exit 1

CMD ["node", "server.js"]
