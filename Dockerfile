FROM node:18

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY agent/agent.js ./agent/
COPY controller/ ./controller/

# Install dependencies
RUN npm install mineflayer mineflayer-pathfinder express

# Define environment variables with defaults
ENV MC_ONLINE=false
ENV MC_HOST=localhost
ENV MC_PORT=25565
ENV MC_USERNAME=TestBot
ENV MC_PASSWORD=
ENV MC_AUTH=
ENV MC_VERSION=1.21.4

CMD ["node", "agent/agent.js"]
