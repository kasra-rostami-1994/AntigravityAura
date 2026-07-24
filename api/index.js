// Vercel serverless entry point.
// Vercel runs files inside /api as individual serverless functions.
// This just re-exports the Express app defined in server.js so all
// /api/* requests are handled by the same Express routing logic.
module.exports = require('../server.js');