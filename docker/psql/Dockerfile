FROM postgres:13-alpine
COPY ./schema/ /docker-entrypoint-initdb.d/
COPY ./psql_test_init.sh /docker-entrypoint-initdb.d/