# Base image for Node.js
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Build the TypeScript files
RUN npm run build

# Expose the port the app will run on
EXPOSE 3000

# Define environment variable for production
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]