// server.js
const { createServer: createHttpServer } = require('http');
const { createServer: createHttpsServer } = require('https');
const { readFileSync } = require('fs');
const next = require('next');
const { parse } = require('url');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = 3000;

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const requestHandler = (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  };

  let server;
  
  if (!dev && process.env.SSL_PATH_CERT && process.env.SSL_PATH_KEY) {
    // Production with HTTPS
    const httpsOptions = {
      key: readFileSync(process.env.SSL_PATH_KEY),
      cert: readFileSync(process.env.SSL_PATH_CERT)
    };
    server = createHttpsServer(httpsOptions, requestHandler);
  } else {
    // Development or production without SSL
    server = createHttpServer(requestHandler);
  }

  server.listen(port, hostname, (err) => {
    if (err) throw err;
    const protocol = (!dev && process.env.SSL_PATH_CERT && process.env.SSL_PATH_KEY) ? 'https' : 'http';
    console.log(`> Ready on ${protocol}://${hostname}:${port}`);
  });
});
