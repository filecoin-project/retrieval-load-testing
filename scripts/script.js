import http from 'k6/http'
import { SharedArray } from 'k6/data'
import { Trend, Rate, Counter } from 'k6/metrics'
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.3/index.js'
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1/dayjs.min.js'

const pieces = new SharedArray('pieces', function () {
  // here you can open files, and then do additional processing or generate the array with data dynamically
  const arr = open('../pieces.txt').split(/\r?\n/)
  if (arr[arr.length - 1] == '') {
    arr.pop()
  }
  return arr // f must be an array[]
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

export const options = {
  scenarios: {
    contacts: {
      executor: 'per-vu-iterations',
      vus: __ENV.SIMULTANEOUS_DOWNLOADS,
      iterations: 1,
      maxDuration: `${__ENV.SIMULTANEOUS_DOWNLOADS}h`,
    },
  },
  discardResponseBodies: true,
}

export default function () {
  // get a random piece from the list
  const piece = pieces[Math.floor(Math.random() * pieces.length)]

  // randomly fetch first from either a raw url or boost
  const fetchRawUrlFirst = Math.random() >= .5
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

/**
 * Fetches a piece CID from the BOOST_FETCH_URL
 * @param {string} piece The piece CID string to fetch
 * @returns A K6 HTTP response from the BOOST_FETCH_URL (https://k6.io/docs/javascript-api/k6-http/response/)
 */
function fetchFromBoost(piece) {
  let response = get(`${__ENV.BOOST_FETCH_URL}${piece}`, {
    tags: {
      name: 'BoostFetchURL',
    }
  })
  timeBoost.add(response.timings.duration)
  ttfbBoost.add(response.timings.waiting)
  boostSuccess.add(response.status >= 200 && response.status < 300)

  if (response.headers['Content-Length'] !== undefined) {
    let contentLength = parseInt(response.headers['Content-Length'], 10)
    if (!Number.isNaN(contentLength)) {
      dataReceivedBoost.add(contentLength, { url: response.url })

      let megabytes = contentLength / 1048576
      let seconds = response.timings.duration / 1000
      megabytesPerSecBoost.add(megabytes / second)
    }
  }

  return response
}

/**
 * Fetches a piece CID from the RAW_FETCH_URL
 * @param {string} piece The piece CID string to fetch
 * @returns A K6 HTTP response from the RAW_FETCH_URL (https://k6.io/docs/javascript-api/k6-http/response/)
 */
function fetchFromRawUrl(piece) {
  if (__ENV.RAW_FETCH_URL) {
    let response = get(`${__ENV.RAW_FETCH_URL}${piece}`, {
      tags: {
        name: 'RawFetchURL',
      }
    })
    timeRaw.add(response.timings.duration)
    ttfbRaw.add(response.timings.waiting)
    rawSuccess.add(response.status >= 200 && response.status < 300)

    if (response.headers['Content-Length'] !== undefined) {
      let contentLength = parseInt(response.headers['Content-Length'], 10)
      if (!Number.isNaN(contentLength)) {
        dataReceivedRaw.add(contentLength, { url: response.url })

        let megabytes = contentLength / 1048576
        let seconds = response.timings.duration / 1000
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
function get(url, params) {
  // Ensure params is not undefined
  if (params === undefined) params = {}

  // Default timeout
  if(__ENV.SIMULTANEOUS_DOWNLOADS != undefined) {
    params.timeout = `${__ENV.SIMULTANEOUS_DOWNLOADS}h`
  }

  // Get random range offset and create Range header
  if (__ENV.RANGE_SIZE !== undefined) {
    if (params.headers === undefined) params.headers = {} // Ensure headers are not undefined
    params.headers['Range'] = getRangeHeaderValue(parseInt(__ENV.RANGE_SIZE, 10))
  }

  return http.get(`${url}`, params)
}

/**
 * Gets a random HTTP Range header byte value of size rangSize within maxContentSize
 * @param {number} rangeSize The size of the content to fetch in bytes
 * @param {number} [maxContentSize] The max size of the content in bytes. Defaults to 32GB.
 * @returns An HTTP Range header byte value
 */
function getRangeHeaderValue(rangeSize, maxContentSize=34359738368) {
  let offset = Math.floor(Math.random() * (maxContentSize - rangeSize)) // We want to make sure the start of our range is within the max content size
  return `bytes=${offset}-${offset + rangeSize - 1}`
}

/**
 * Defines a custom K6 summary output configuration.
 * Configuration changes based on test name.
 */
export function handleSummary(data) {
  const timeStr = dayjs().format('YYYY-MM-DDTHH:mm:ss')
  var filepath

  if (__ENV.TEST_NAME === 'full-fetch') {
    filepath = `${__ENV.OUT_DIR}/${__ENV.TEST_NAME}/${__ENV.SIMULTANEOUS_DOWNLOADS}vu_${timeStr}.json`
  }
  else if (__ENV.TEST_NAME === 'range-requests') {
    filepath = `${__ENV.OUT_DIR}/${__ENV.TEST_NAME}/${__ENV.SIMULTANEOUS_DOWNLOADS}vu_${__ENV.RANGE_SIZE}B_${timeStr}.json`
  }

  return {
    'stdout': textSummary(data, { indent: '  ', enableColors: true }),
    [filepath]: JSON.stringify(data, null, 2),
  }
}