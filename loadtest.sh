#!/bin/bash

TEST_CONCURRENCIES=(1 8 16 32 64)

docker compose up -d influxdb grafana
for CONCURRENCY in "${TEST_CONCURRENCIES[@]}"
do
   SIMULTANEOUS_DOWNLOADS=$CONCURRENCY docker compose run k6 run --verbose /scripts/script.js
done