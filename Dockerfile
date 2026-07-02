FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Run node with --expose-gc to cleanly measure the drops in memory
CMD ["node", "--expose-gc", "test.js"]
