#!/bin/bash

docker compose up -d influxdb grafana
docker compose run --rm -i --volume "$(pwd)/out":/out --workdir "/out" k6 run $1