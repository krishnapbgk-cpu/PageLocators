/**
 * Centralised error handler.
 * Formats errors from Anthropic SDK, Axios, and application code consistently.
 */
module.exports = function errorHandler(err, req, res, _next) {
  console.error(`[ERROR] ${req.method} ${req.path} →`, err.message);

  // Anthropic SDK errors
  if (err?.status && err?.error) {
    return res.status(err.status).json({
      error: err.error?.error?.message || 'Anthropic API error',
      type:  'anthropic_error',
    });
  }

  // Axios / upstream HTTP errors
  if (err?.response) {
    const status = err.response.status;
    const msg    = err.response.data?.message || err.response.statusText;
    return res.status(status >= 400 && status < 600 ? status : 502).json({
      error: `Upstream error: ${msg}`,
      type:  'upstream_error',
    });
  }

  // JSON parse errors from Claude responses
  if (err instanceof SyntaxError) {
    return res.status(422).json({
      error: 'AI response could not be parsed as JSON. Try again.',
      type:  'parse_error',
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message, type: 'validation_error' });
  }

  // Generic fallback
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    error: err.message || 'Internal server error',
    type:  'server_error',
  });
};
