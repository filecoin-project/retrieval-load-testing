#!/bin/bash

mkdir -p out
docker compose up -d influxdb grafana

TEST_CONCURRENCIES=(1 8 16 32 64)

for CONCURRENCY in "${TEST_CONCURRENCIES[@]}"
do
  if [[ -z "${USE_DOCKER_K6}" ]]; then
    source .env
    K6_OUT=influxdb=http://127.0.0.1:8086/k6 BOOST_FETCH_URL=${BOOST_FETCH_URL} RAW_FETCH_URL=${RAW_FETCH_URL} SIMULTANEOUS_DOWNLOADS=$CONCURRENCY OUT_DIR="./out" k6 run ./scripts/script.js
  else
    SIMULTANEOUS_DOWNLOADS=$CONCURRENCY OUT_DIR="/out" docker compose run k6 run /scripts/script.js
  fi
done

TEST_RANGE_CONCURRENCIES=(10 100 1000)
RANGE_SIZES=(1024 10240 102400)

for CONCURRENCY in "${TEST_RANGE_CONCURRENCIES[@]}"
do
  for RANGE_SIZE in "${RANGE_SIZES[@]}"
  do
    if [[ -z "${USE_DOCKER_K6}" ]]; then
      source .env
      K6_OUT=influxdb=http://127.0.0.1:8086/k6 BOOST_FETCH_URL=${BOOST_FETCH_URL} RAW_FETCH_URL=${RAW_FETCH_URL} SIMULTANEOUS_DOWNLOADS=$CONCURRENCY RANGE_SIZE=$RANGE_SIZE OUT_DIR="./out" k6 run ./scripts/script.js
    else
      SIMULTANEOUS_DOWNLOADS=$CONCURRENCY RANGE_SIZE=$RANGE_SIZE OUT_DIR="/out" docker compose run k6 run /scripts/script.js
    fi
  done
done