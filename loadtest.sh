#!/bin/bash

TEST_CONCURRENCIES=(1 8 16 32 64)

mkdir -p out

docker compose up -d influxdb grafana
for CONCURRENCY in "${TEST_CONCURRENCIES[@]}"
do
   if [[ -z "${RAW_LOAD_TEST}" ]]; then
      SIMULTANEOUS_DOWNLOADS=$CONCURRENCY docker compose run k6 run --verbose /scripts/script.js
   else
      source .env
      K6_OUT=influxdb=http://127.0.0.1:8086/k6 BOOST_FETCH_URL=${BOOST_FETCH_URL} RAW_FETCH_URL=${RAW_FETCH_URL} SIMULTANEOUS_DOWNLOADS=$CONCURRENCY k6 run --verbose ./scripts/script.js
   fi
done