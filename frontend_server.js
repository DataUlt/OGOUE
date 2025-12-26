import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, 'frontend_marketing', 'homepage');

const server = http.createServer((req, res) => {
  let filePath = path.join(rootDir, req.url === '/' ? 'login.html' : req.url);
  
  // Security: prevent directory traversal
  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
    };

    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(3000, () => {
  console.log('Frontend (marketing) server running on http://localhost:3000');
  console.log('Backend API on http://localhost:3001');
});
