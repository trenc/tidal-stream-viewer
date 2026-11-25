// A fetch of atlas data that could not reach the network. Thrown by the frame
// store, so callers can tell unavailability apart from HTTP status errors and
// malformed data, both of which stay plain errors.
export class UnavailableError extends Error {
  constructor(url, cause) {
    super(`Could not fetch ${url}.`);
    this.name = 'UnavailableError';
    this.url = url;
    this.cause = cause;
  }
}
