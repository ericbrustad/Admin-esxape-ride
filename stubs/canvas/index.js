module.exports = function createCanvasStub() {
  throw new Error(
    "The canvas stub was invoked. This environment is expected to run in the browser where native canvas is available."
  );
};
