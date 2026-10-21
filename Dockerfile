# Uma imagem para coleta e API (#4). Na slice roda o supercronic com coleta/crontab (compose.prod.yaml).
FROM node:24-bookworm-slim

# Cliente do Postgres da mesma versão do servidor (#5), do repositório PGDG.
ARG PG_MAJOR=17
ARG SUPERCRONIC_VERSION=v0.2.49
ARG SUPERCRONIC_SHA256=a53ae236602c7338aba3fbaff40bda6300eae3b9fedb8261eb06cfe3724430c1

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl gdal-bin tzdata \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client-$PG_MAJOR \
 && curl -fsSL -o /usr/local/bin/supercronic https://github.com/aptible/supercronic/releases/download/$SUPERCRONIC_VERSION/supercronic-linux-amd64 \
 && echo "$SUPERCRONIC_SHA256  /usr/local/bin/supercronic" | sha256sum -c - \
 && chmod +x /usr/local/bin/supercronic \
 && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY . .
# Volumes nomeados herdam o dono destas pastas na primeira montagem.
RUN install -d -o node -g node /dados/buffer /dados/logs

USER node
ENV NODE_ENV=production MANAUS_BUFFER=/dados/buffer MANAUS_LOGS=/dados/logs
LABEL org.opencontainers.image.source=https://github.com/leonardomenezes8500/manaus
# supercronic é o PID 1: vivo = container saudável. O deploy espera este healthcheck e volta a tag anterior se falhar.
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 CMD kill -0 1
CMD ["supercronic", "coleta/crontab"]

# Por último: muda a cada commit e não invalida as camadas de cima. baixar() grava no meta.
ARG GIT_COMMIT=desconhecido
ENV GIT_COMMIT=$GIT_COMMIT
