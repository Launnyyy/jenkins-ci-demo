const express = require('express');
const app = express();

app.get('/', (_req, res) => res.send('Hello from CI/CD pipeline'));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

module.exports = app;
