# Use Node.js as the base image
FROM node:16-alpine

# Set the working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Copy the entire project
COPY . .

RUN rm -rf node_modules && npm install

# Build the TypeScript code
RUN npm run build

# Expose the application port
EXPOSE 5000

# Start the application
CMD ["npm", "start"]