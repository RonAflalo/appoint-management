FROM node:20-slim

# Build tools needed for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install & build client
COPY client/package*.json ./client/
RUN cd client && npm install
COPY client/ ./client/
RUN cd client && npm run build

# Install server
COPY server/package*.json ./server/
RUN cd server && npm install
COPY server/ ./server/

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "server/index.js"]
