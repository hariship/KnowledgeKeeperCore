# Use Node.js as the base image
FROM node:16-alpine

# Set the working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

RUN rm -rf node_modules && npm install

# Copy the entire project
COPY . .

# Build the TypeScript code
RUN npm run build

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]