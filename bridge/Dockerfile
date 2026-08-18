FROM node:22-alpine
WORKDIR /app
RUN npm init -y && npm install ws@8.21.3 --omit=dev
COPY server.mjs ./server.mjs
ENV BRIDGE_PORT=3001
EXPOSE 3001
CMD ["node", "server.mjs"]
