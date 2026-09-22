FROM node:22-bookworm-slim
ARG CODEX_VERSION=0.155.1
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates gosu && rm -rf /var/lib/apt/lists/*
RUN npm install -g @openai/codex@${CODEX_VERSION}
WORKDIR /app/frontia-backend
COPY frontia-backend/package.json frontia-backend/*.mjs frontia-backend/entrypoint.sh ./
COPY frontia/shared.mjs frontia/stories.mjs /app/frontia/
RUN mkdir -p /data/codex /data/workspace && chown -R node:node /data
ENV PORT=8000
ENV CODEX_HOME=/data/codex
ENV FRONTIA_WORKSPACE=/data/workspace
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD node -e "fetch('http://127.0.0.1:8000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["sh", "entrypoint.sh"]
CMD ["node","server.mjs"]
