FROM auranw/local-aurad:latest
WORKDIR /root
RUN sed -i "s/indexer = \"kv\"/indexer = \"psql\"/" ./.aura/config/config.toml
RUN sed -i "s/psql-conn = \"\"/psql-conn = \"postgresql:\/\/phamphong:phamphong9981@psql:5432\/test\?sslmode=disable\"/" ./.aura/config/config.toml