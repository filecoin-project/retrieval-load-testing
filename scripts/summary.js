import http from 'k6/http';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.3/index.js'
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1/dayjs.min.js'

export default function () {
  http.get('https://test.k6.io');
}

const OUT_DIR = "/out";
const TEST_NAME = "summary";

export function handleSummary(data) {
  const timeStr = dayjs().format("YYYY-MM-DDTHH:mm:ss")
  const filepath = `/${OUT_DIR}/${TEST_NAME}-${timeStr}.json`;

  return {
    'stdout': textSummary(data, { indent: "  ", enableColors: true }),
    [filepath]: JSON.stringify(data, null, 2),
  };
}