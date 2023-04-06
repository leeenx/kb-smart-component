module.exports = function (source) {
  return `var window={},document={};function init(windowObject){window = windowObject};if ("object"===typeof exports&&"undefined"!==typeof module) {Object.assign(exports, { init: init });};${source}`;
};