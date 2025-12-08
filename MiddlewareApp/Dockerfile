FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Expose port
EXPOSE 3402

# Set production environment
ENV NODE_ENV=production

# Run dev server with production settings
CMD ["npm", "run", "start:prod"]
