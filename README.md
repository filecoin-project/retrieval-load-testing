# retrieval-load-testing

> A simple load tester for booster-http

## Table of Contents

- [Overview](#overview)
- [Setup](#setup)
- [Usage](#usage)
- [Contribute](#contribute)
- [License](#license)

## Overview

This is a simple docker setup that uses [K6](k6.io) to run a series of load tests of piece downloading against a booster-http instance.

Optionally, it can also run the same tests against a static file service serving
the same pieces as flat files, for comparison purposes

## Setup

### Prequisites

Docker Engine must be installed on the machine running load tests, along with the Docker Compose plugin. See [Docker Engine installation overview](https://docs.docker.com/engine/install/)

### Configuration

#### Piece list

The load test needs a list of pieces from which to attempt downloads against. Create a file in this directory called `pieces.txt`, and enter the Piece CIDs you want to test against, one per line.

#### (Optional) Data Onboarding Script

If you don't already have pieces you can test downloads against, `generateDeals.sh` is a utility script you can run on your own SP to generate self-deals of random data quickly, using offline imports to avoid data transfer. To use this
command run:

```
$ ./generateDeals.sh [number of deals] [folder to store car files] [minerID]
```

Storage deals are a sensitive process and this script may require additional configuration on your miner

#### Docker .env

The load test reads configuration from environment variables in the .env file used by `docker compose`.

Before you run the load test for the first time, you should run:

```
$ cp .env.example .env
```

You will need to edit .env to set at least one of the config options -- the BOOST_FETCH_URL which is the base URL which piece IDs are appended to fetch pieces from Boost

## Load Testing

To run a load test using the host machine's local k6 runner, run:

```
$ ./loadtest.sh
```

optionally, if you'd like to run your load test using the docker image, you can run

```
$ USE_DOCKER_K6=1 ./loadtest.sh
```

Your load test will display output as it runs. Once it's complete, you can view
performance data in grafana, which will remain running after the load test shuts down.

Visit: `http://localhost:3000/` and navigate to the `k6 performance test` dashboard.

Alternatively, a load test summary JSON file will also be created in the `/out` directory of the project.

## Developing Scripts

During development, it might be easier to run scripts without the load testing setup that `loadtest.sh` provides. In this case, you can use the `runscript.sh` command to run any k6 script.

To run a k6 script, run:

```
$ ./runscript.sh <absolute-path-of-script-on-container>
```

The scripts in the local `./scripts` directory are loaded onto the k6 container in the root directory `/scripts` when the image is started. To run the local script `./scripts/example.js`, the argument would be `/scripts/example.js`. Notice the lack of the period (.) at the start of the path since we're referencing the absolute path to the script on the k6 container.

```
$ ./runscript.sh /scripts/example.js
```

## Contribute

Early days PRs are welcome!

## License

This library is dual-licensed under Apache 2.0 and MIT terms.

Copyright 2022. Protocol Labs, Inc.
