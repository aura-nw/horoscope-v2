FROM postgres:13-alpine
COPY ./01_schema.sql /docker-entrypoint-initdb.d/
COPY ./02_psql_test_init.sh /docker-entrypoint-initdb.d/