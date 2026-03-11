# Use Node.js 20 lightweight image
FROM node:20-alpine

# Set working directory inside the container
WORKDIR /app

# Copy package.json first (for caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all source files
COPY . .

# Expose frontend port (CRA default)
EXPOSE 3000

# Enable polling for hot-reload inside Docker
ENV CHOKIDAR_USEPOLLING=true
ENV CI=false

# Start the React dev server
CMD ["npm", "start"]
