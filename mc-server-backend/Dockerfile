# syntax=docker/dockerfile:1
FROM node:20-alpine

# Set Timezone to Asia/Bangkok
ENV TZ=Asia/Bangkok
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/$TZ /etc/localtime && \
    echo $TZ > /etc/timezone

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Ensure uploads directory exists and has correct permissions
RUN mkdir -p uploads && chmod 777 uploads

EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production

CMD ["node", "server.js"]
