const app = require('./app');

// Hosting Ukraine assigns each Node.js site a local 127.x.x.x address and
// proxies HTTP traffic to it. Set HOST/PORT in the site settings in adm.tools.
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT) || 3000;

app.listen(port, host, () => {
  console.log(`uapplypal listening on http://${host}:${port}`);
});
