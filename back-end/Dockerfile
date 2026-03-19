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

# Expose backend port
EXPOSE 5000

# Start the server
CMD ["node", "src/server.js"]
