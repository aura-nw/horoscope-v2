/* eslint-disable */
// fetch-polyfill.js
// TODO: required by viem: https://viem.sh/docs/compatibility will be removed after upgrading node to v18
import fetch, {
  Blob,
  blobFrom,
  blobFromSync,
  File,
  fileFrom,
  fileFromSync,
  FormData,
  Headers,
  Request,
  Response,
} from 'node-fetch';

if (!globalThis.fetch) {
  globalThis.fetch = fetch;
  globalThis.Headers = Headers;
  globalThis.Request = Request;
  globalThis.Response = Response;
}
