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

const bytesPerMsBoost = new Trend('bytes_per_ms_boost')
const bytesPerMsRaw = new Trend('bytes_per_ms_raw')
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

function fetchFromBoost(piece) {
  let response = http.get(`${__ENV.BOOST_FETCH_URL}${piece}`, {
    tags: {
      name: 'BoostFetchURL',
    },
    timeout: `${__ENV.SIMULTANEOUS_DOWNLOADS}h`,
  })
  timeBoost.add(response.timings.duration)
  ttfbBoost.add(response.timings.waiting)
  boostSuccess.add(
    response.status >= 200 && response.status < 300
  )

  let contentLength = parseInt(response.headers['Content-Length'])
  dataReceivedBoost.add(contentLength, { url: response.url })
  bytesPerMsBoost.add(contentLength / response.timings.duration)

  return response
}

function fetchFromRawUrl(piece) {
  if (__ENV.RAW_FETCH_URL) {
    let response = http.get(`${__ENV.RAW_FETCH_URL}${piece}`, {
      tags: {
        name: 'RawFetchURL',
      },
      timeout: `${__ENV.SIMULTANEOUS_DOWNLOADS}h`,
    })
    timeRaw.add(response.timings.duration)
    ttfbRaw.add(response.timings.waiting)
    rawSuccess.add(response.status >= 200 && response.status < 300)

    let contentLength = parseInt(response.headers['Content-Length'])
    dataReceivedRaw.add(contentLength, { url: response.url })
    bytesPerMsRaw.add(contentLength / response.timings.duration)

    return response
  }
}

const TEST_NAME = "script";

export function handleSummary(data) {
  const timeStr = dayjs().format("YYYY-MM-DDTHH:mm:ss")
  const filepath = `${__ENV.OUT_DIR}/${TEST_NAME}-${timeStr}.json`;

  return {
    'stdout': textSummary(data, { indent: "  ", enableColors: true }),
    [filepath]: JSON.stringify(data, null, 2),
  };
}