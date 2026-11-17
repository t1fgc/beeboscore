# BeeboScore — cloud image. No npm install needed (zero runtime dependencies).
FROM node:22-alpine
WORKDIR /app
COPY server.js package.json ./
COPY lib ./lib
COPY public ./public
COPY overlays ./overlays
ENV NODE_ENV=production \
    DATA_DIR=/data \
    CLOUD_MODE=1 \
    NO_OPEN=1
RUN mkdir -p /data
EXPOSE 3000
CMD ["node", "server.js"]
