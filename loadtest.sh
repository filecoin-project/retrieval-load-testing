#!/bin/bash

## This script runs the load tests for Boost retrievals
##
## To modify its behavior, run this script prefixed with:
##   * USE_DOCKER_K6=1 to use the dockerized k6 instead of the local one
##   * SKIP_FULL_FETCH=1 to skip the full fetch tests
##   * SKIP_RANGE_REQUESTS=1 to skip the range requests tests
##   * TEST_FETCH_CONCURRENCIES='X,Y,Z' to override the default concurrency levels for the full fetch tests
##   * TEST_RANGE_CONCURRENCIES='X,Y,Z' to override the default concurrency levels for the range requests tests
##   * TEST_RANGE_SIZES=='X,Y,Z' to override the default range sizes for the range requests tests
##   * SKIP_CSV_OUT=1 to skip the CSV output generation
##   * CSV_OUT_FILE='path/to/file.csv' to override the default CSV output file

DEFAULT_FULL_FETCH_CONCURRENCIES=(1 8 16 32 64)
DEFAULT_RANGE_CONCURRENCIES=(10 100 1000)
DEFAULT_RANGE_SIZES=(1048576 10485760 104857600)
CSV_OUT_FILE=${CSV_OUT_FILE:-out/results.csv}

# Check that we have Node.js installed
node -v 2>/dev/null || {
    echo "'node' not found, CSV output will not be generated"
    SKIP_CSV_OUT=1
}

function run_full_fetch() {
  TEST_NAME="full-fetch"
  mkdir -p out/"${TEST_NAME}"

  if [ -z "$TEST_FETCH_CONCURRENCIES" ]; then
    TEST_FETCH_CONCURRENCIES=(${DEFAULT_FULL_FETCH_CONCURRENCIES[@]})
  else
    # turn provided comma-separated list into an array
    TEST_FETCH_CONCURRENCIES=(`echo $TEST_FETCH_CONCURRENCIES | tr ',' ' '`)
  fi

  echo "Running full fetch with concurrencies: ${TEST_FETCH_CONCURRENCIES[@]}"

  for CONCURRENCY in "${TEST_FETCH_CONCURRENCIES[@]}"; do
    if [[ -z "${USE_DOCKER_K6}" ]]; then
      source .env
      K6_OUT=influxdb=http://127.0.0.1:8086/k6 \
        BOOST_FETCH_URL=${BOOST_FETCH_URL} \
        RAW_FETCH_URL=${RAW_FETCH_URL} \
        TEST_NAME=$TEST_NAME \
        SIMULTANEOUS_DOWNLOADS=$CONCURRENCY \
        OUT_DIR="./out" \
        k6 run ./scripts/script.js
    else
      TEST_NAME=$TEST_NAME \
        SIMULTANEOUS_DOWNLOADS=$CONCURRENCY \
        OUT_DIR="/out" \
        docker compose run k6 run /scripts/script.js
    fi
  done
}

function run_range_requests() {
  TEST_NAME="range-requests"
  mkdir -p out/"${TEST_NAME}"

  if [ -z "$TEST_RANGE_CONCURRENCIES" ]; then
    TEST_RANGE_CONCURRENCIES=(${DEFAULT_RANGE_CONCURRENCIES[@]})
  else
    # turn provided comma-separated list into an array
    TEST_RANGE_CONCURRENCIES=(`echo $TEST_RANGE_CONCURRENCIES | tr ',' ' '`)
  fi

  if [ -z "$TEST_RANGE_SIZES" ]; then
    TEST_RANGE_SIZES=(${DEFAULT_RANGE_SIZES[@]})
  else
    # turn provided comma-separated list into an array
    TEST_RANGE_SIZES=(`echo $TEST_RANGE_SIZES | tr ',' ' '`)
  fi

  echo "Running range requests with"
  echo "    Concurrencies: ${TEST_RANGE_CONCURRENCIES[@]}"
  echo "    Range sizes: ${TEST_RANGE_SIZES[@]}"

  for CONCURRENCY in "${TEST_RANGE_CONCURRENCIES[@]}"; do
    for RANGE_SIZE in "${TEST_RANGE_SIZES[@]}"; do
      if [[ -z "${USE_DOCKER_K6}" ]]; then
        source .env
        K6_OUT=influxdb=http://127.0.0.1:8086/k6 \
          BOOST_FETCH_URL=${BOOST_FETCH_URL} \
          RAW_FETCH_URL=${RAW_FETCH_URL} \
          TEST_NAME=$TEST_NAME \
          SIMULTANEOUS_DOWNLOADS=$CONCURRENCY \
          RANGE_SIZE=$RANGE_SIZE \
          OUT_DIR="./out" \
          k6 run ./scripts/script.js
      else
        TEST_NAME=$TEST_NAME \
          SIMULTANEOUS_DOWNLOADS=$CONCURRENCY \
          RANGE_SIZE=$RANGE_SIZE \
          OUT_DIR="/out" \
          docker compose run k6 run /scripts/script.js
      fi
    done
  done
}

rm -rf out
mkdir -p out
docker compose up -d influxdb grafana

[[ -z "${SKIP_FULL_FETCH}" ]] && run_full_fetch
[[ -z "${SKIP_RANGE_REQUESTS}" ]] && run_range_requests

# Generate CSV output from the JSON files
[[ -z "${SKIP_CSV_OUT}" ]] && node scripts/json2csv.mjs $CSV_OUT_FILE
