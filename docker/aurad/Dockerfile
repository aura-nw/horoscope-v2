FROM auranw/local-aurad:latest
WORKDIR /root

ARG POSTGRES_USER
ARG POSTGRES_PASSWORD
ARG POSTGRES_HOST
ARG POSTGRES_PORT
ARG POSTGRES_DB

# RUN wget https://github.com/aura-nw/testnets/raw/main/euphoria-2/euphoria-2-genesis.tar.gz
# RUN tar -xzvf euphoria-2-genesis.tar.gz
# RUN cp euphoria-2-genesis.json ./.aura/config/genesis.json

RUN sed -i "s/indexer = \"kv\"/indexer = \"psql\"/" ./.aura/config/config.toml
# RUN sed -i "s/enable = false/enable = true/" ./.aura/config/config.toml
# RUN sed -i 's/seeds = \"\"/seeds = "705e3c2b2b554586976ed88bb27f68e4c4176a33@13.250.223.114:26656,b9243524f659f2ff56691a4b2919c3060b2bb824@13.214.5.1:26656"/' ./.aura/config/config.toml
# RUN sed -i "s/trust_height = 0/trust_height = 3163000/" ./.aura/config/config.toml
# RUN sed -i "s/trust_hash = \"\"/trust_hash = \"4DE8D076052F4E463189F98DED4178E4D4AAB84B580FF6AD41E524C40F87A6A6\"/" ./.aura/config/config.toml
# RUN sed -i "s~rpc_servers = \"\"~rpc_servers = \"https://snapshot-1.euphoria.aura.network:443,https://snapshot-2.euphoria.aura.network:443\"~" ./.aura/config/config.toml
RUN sed -i "s/psql-conn = \"\"/psql-conn = \"postgresql:\/\/$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST:$POSTGRES_PORT\/$POSTGRES_DB\?sslmode=disable\"/" ./.aura/config/config.toml