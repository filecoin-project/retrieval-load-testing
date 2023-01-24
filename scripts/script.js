/* global __ENV open */

import http from 'k6/http'
import { SharedArray } from 'k6/data'
import { Trend, Rate, Counter, Gauge } from 'k6/metrics'
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.3/index.js'

const pieces = new SharedArray('pieces', function () {
  return open('../pieces.txt').split(/\r?\n/).filter(Boolean) // f must be an array[]
})

const megabytesPerSecBoost = new Trend('megabytes_per_second_boost')
const megabytesPerSecRaw = new Trend('megabytes_per_second_raw')
const dataReceivedBoost = new Counter('data_received_boost')
const dataReceivedRaw = new Counter('data_received_raw')
const timeBoost = new Trend('time_boost', true)
const timeDelta = new Trend('time_delta', true)
const timeRaw = new Trend('time_raw', true)
const ttfbBoost = new Trend('ttfb_boost', true)
const ttfbDelta = new Trend('ttfb_delta', true)
const ttfbRaw = new Trend('ttfb_raw', true)
const boostSuccess = new Rate('success_boost')
const rawSuccess = new Rate('success_raw')
const boostCPU = new Gauge('cpu_usage_boost')
const rawCPU = new Gauge('cpu_usage_raw')
const boostMemory = new Gauge('memory_usage_boost')
const rawMemory = new Gauge('memory_usage_cpu')

export const options = {
  scenarios: {
    contacts: {
      executor: 'per-vu-iterations',
      vus: __ENV.SIMULTANEOUS_DOWNLOADS,
      iterations: 1,
      maxDuration: `${__ENV.SIMULTANEOUS_DOWNLOADS}h`
    }
  },
  thresholds: {
    // Trying to filter out teardown metrics
    // Choose a threshold which will always pass
    'http_req_duration{scenario:contacts}': ['max>=0']
  },
  discardResponseBodies: true
}

export default function () {
  // get a random piece from the list
  const piece = pieces[Math.floor(Math.random() * pieces.length)]

  // randomly fetch first from either a raw url or boost
  const fetchRawUrlFirst = Math.random() >= 0.5
  let boostResponse, rawResponse

  if (fetchRawUrlFirst) {
    rawResponse = fetchFromRawUrl(piece)
    boostResponse = fetchFromBoost(piece)
  } else {
    boostResponse = fetchFromBoost(piece)
    rawResponse = fetchFromRawUrl(piece)
  }

  if (__ENV.RAW_FETCH_URL) {
    timeDelta.add(boostResponse.timings.duration - rawResponse.timings.duration)
    ttfbDelta.add(boostResponse.timings.waiting - rawResponse.timings.waiting)
  }
}

export function teardown (data) {
  if (__ENV.BOOST_PROMETHEUS_URL) {
    // fetch cpu and memory metrics from url
    // const response = http.get(__ENV.BOOST_PROMETHEUS_URL, {
    //   responseType: 'text',
    //   tags: {
    //     name: 'teardown'
    //   }
    // })

    // boostCPU.add(5)
    // rawCPU.add(5)

    // boostMemory.add(10)
    // rawMemory.add(10)
  }
}

/**
 * Fetches a piece CID from the BOOST_FETCH_URL
 * @param {string} piece The piece CID string to fetch
 * @returns A K6 HTTP response from the BOOST_FETCH_URL (https://k6.io/docs/javascript-api/k6-http/response/)
 */
function fetchFromBoost (piece) {
  const response = get(`${__ENV.BOOST_FETCH_URL}${piece}`, {
    tags: {
      name: 'BoostFetchURL'
    }
  })
  timeBoost.add(response.timings.duration)
  ttfbBoost.add(response.timings.waiting)
  boostSuccess.add(response.status >= 200 && response.status < 300)

  if (response.headers['Content-Length'] !== undefined) {
    const contentLength = parseInt(response.headers['Content-Length'], 10)
    if (!Number.isNaN(contentLength)) {
      dataReceivedBoost.add(contentLength, { url: response.url })

      const megabytes = contentLength / 1048576
      const seconds = response.timings.duration / 1000
      megabytesPerSecBoost.add(megabytes / seconds)
    }
  }

  return response
}

/**
 * Fetches a piece CID from the RAW_FETCH_URL
 * @param {string} piece The piece CID string to fetch
 * @returns A K6 HTTP response from the RAW_FETCH_URL (https://k6.io/docs/javascript-api/k6-http/response/)
 */
function fetchFromRawUrl (piece) {
  if (__ENV.RAW_FETCH_URL) {
    const response = get(`${__ENV.RAW_FETCH_URL}${piece}`, {
      tags: {
        name: 'RawFetchURL'
      }
    })
    timeRaw.add(response.timings.duration)
    ttfbRaw.add(response.timings.waiting)
    rawSuccess.add(response.status >= 200 && response.status < 300)

    if (response.headers['Content-Length'] !== undefined) {
      const contentLength = parseInt(response.headers['Content-Length'], 10)
      if (!Number.isNaN(contentLength)) {
        dataReceivedRaw.add(contentLength, { url: response.url })

        const megabytes = contentLength / 1048576
        const seconds = response.timings.duration / 1000
        megabytesPerSecRaw.add(megabytes / seconds)
      }
    }

    return response
  }
}

/**
 * Wraps K6 http.get() to provide default and optional request parameters
 * @param {string} url The url to fetch from
 * @param {Params} [params] Default K6 request parameters to use. https://k6.io/docs/javascript-api/k6-http/params/
 * @returns A K6 HTTP response (https://k6.io/docs/javascript-api/k6-http/response/)
 */
function get (url, params = {}) {
  // Default timeout
  if (__ENV.SIMULTANEOUS_DOWNLOADS) {
    params.timeout = `${__ENV.SIMULTANEOUS_DOWNLOADS}h`
  }

  // Get random range offset and create Range header
  if (__ENV.RANGE_SIZE) {
    if (!params.headers) params.headers = {} // Ensure headers are not undefined
    params.headers.Range = getRangeHeaderValue(parseInt(__ENV.RANGE_SIZE, 10))
  }

  return http.get(`${url}`, params)
}

/**
 * Gets a random HTTP Range header byte value of size rangSize within maxContentSize
 * @param {number} rangeSize The size of the content to fetch in bytes
 * @param {number} [maxContentSize] The max size of the content in bytes. Defaults to 32GB.
 * @returns An HTTP Range header byte value
 */
function getRangeHeaderValue (rangeSize, maxContentSize = 34359738368) {
  const offset = Math.floor(Math.random() * (maxContentSize - rangeSize)) // We want to make sure the start of our range is within the max content size
  return `bytes=${offset}-${offset + rangeSize - 1}`
}

/**
 * Defines a custom K6 summary output configuration.
 * Configuration changes based on test name.
 */
export function handleSummary (data) {
  const timeStr = __ENV.FILE_TIME_STR || new Date().toISOString()
  const dir = __ENV.OUT_DIR
  const name = __ENV.TEST_NAME
  const concurrency = __ENV.SIMULTANEOUS_DOWNLOADS
  const range = __ENV.RANGE_SIZE
  const rangePart = name === 'range-requests' ? `${range}B_` : ''
  const filepath = `${dir}/${name}/${concurrency}vu_${rangePart}${timeStr}.json`

  return {
    stdout: textSummary(data, { indent: '  ', enableColors: true }) + '\n',
    [filepath]: JSON.stringify(data, null, 2)
  }
}
