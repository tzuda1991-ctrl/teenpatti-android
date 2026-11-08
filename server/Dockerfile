FROM node:22-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm install --omit=dev
COPY server/src ./src
COPY server/public ./public
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm","start"]
