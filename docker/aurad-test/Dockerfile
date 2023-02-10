FROM auranw/local-aurad:latest
WORKDIR /root

ARG POSTGRES_USER
ARG POSTGRES_PASSWORD
ARG POSTGRES_HOST
ARG POSTGRES_PORT
ARG POSTGRES_DB_TEST

RUN sed -i "s/indexer = \"kv\"/indexer = \"psql\"/" ./.aura/config/config.toml
RUN sed -i "s/psql-conn = \"\"/psql-conn = \"postgresql:\/\/$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST:$POSTGRES_PORT\/$POSTGRES_DB_TEST\?sslmode=disable\"/" ./.aura/config/config.toml
