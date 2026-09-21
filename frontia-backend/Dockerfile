FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*
RUN npm install -g @openai/codex
WORKDIR /app
COPY package.json server.mjs ./
RUN mkdir -p /data/codex /data/workspace
ENV PORT=8000
ENV CODEX_HOME=/data/codex
ENV FRONTIA_WORKSPACE=/data/workspace
EXPOSE 8000
CMD ["node","server.mjs"]
