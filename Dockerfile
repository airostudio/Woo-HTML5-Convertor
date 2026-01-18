# Store Converter - Docker Configuration
FROM node:18-alpine

# Install build dependencies for sharp
RUN apk add --no-cache python3 make g++ vips-dev

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create output directory
RUN mkdir -p /app/output

# Expose API port
EXPOSE 3002

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3002

# Start the API server
CMD ["node", "web/api-server.js"]
