import http from 'k6/http'
import { SharedArray } from 'k6/data'
import encoding from 'k6/encoding'
import { Trend, Rate } from 'k6/metrics'

const pieces = new SharedArray('pieces', function () {
  // here you can open files, and then do additional processing or generate the array with data dynamically
  const arr = open('/pieces.txt').split(/\r?\n/)
  return arr // f must be an array[]
})

const timeBoost = new Trend('time-boost')
const ttfbBoost = new Trend('ttfb-boost')
const timeRaw = new Trend('time-raw')
const ttfbRaw = new Trend('ttfb-raw')
const timeDelta = new Trend('time-delta')
const ttfbDelta = new Trend('ttfb-delta')
const boostSuccess = new Rate('success-boost')
const rawSuccess = new Rate('success-raw')

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
  const piece = pieces[Math.floor(Math.random() * (pieces.length - 1))]
  // run raw vs boost randomly first
  const runRawFirst = Math.round(Math.random())
  let boostResponse, rawResponse
  for (let i = 0; i < 2; i++) {
    if ((i + runRawFirst) % 2 === 0) {
      boostResponse = http.get(`${__ENV.BOOST_FETCH_URL}${piece}`, {
        tags: {
          name: 'BoostFetchURL',
        },
        timeout: `${__ENV.SIMULTANEOUS_DOWNLOADS}h`,
      })
      timeBoost.add(boostResponse.timings.duration)
      ttfbBoost.add(boostResponse.timings.waiting)
      boostSuccess.add(
        boostResponse.status >= 200 && boostResponse.status < 300
      )
    } else {
      if (__ENV.RAW_FETCH_URL) {
        rawResponse = http.get(`${__ENV.RAW_FETCH_URL}${piece}`, {
          tags: {
            name: 'RawFetchURL',
          },
          timeout: `${__ENV.SIMULTANEOUS_DOWNLOADS}h`,
        })
        timeRaw.add(rawResponse.timings.duration)
        ttfbRaw.add(rawResponse.timings.waiting)
        rawSuccess.add(rawResponse.status >= 200 && rawResponse.status < 300)
      }
    }
  }
  if (__ENV.RAW_FETCH_URL) {
    timeDelta.add(boostResponse.timings.duration - rawResponse.timings.duration)
    ttfbDelta.add(boostResponse.timings.waiting - rawResponse.timings.waiting)
  }
}
