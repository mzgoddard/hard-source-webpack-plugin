module.exports = data => {
  let result;
  // Use standard json for performance.
  try {
    result = JSON.parse(data);
  } catch (_) {
    // Use jsonlint for clear errors. An error will rethrow with more
    // information.
    result = require('jsonlint').parse(data);
  }
  return result;
};
