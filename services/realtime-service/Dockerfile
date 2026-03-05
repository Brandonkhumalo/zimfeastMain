FROM node:18-alpine

WORKDIR /app

COPY real-time-server/package*.json ./
RUN npm install --production

COPY real-time-server/ .

ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "src/index.js"]
