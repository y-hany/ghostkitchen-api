// api/index.js — Vercel serverless function entrypoint for Express
'use strict';
const app = require('../server');

module.exports = (req, res) => {
  return app(req, res);
};
