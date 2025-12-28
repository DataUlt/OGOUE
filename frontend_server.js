import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const server = http.createServer((req, res) => {
  // Headers CORS pour éviter les problèmes
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  let filePath;
  const urlPath = req.url.split('?')[0]; // Remove query params
  
  // Root route
  if (urlPath === '/') {
    filePath = path.join(__dirname, 'frontend_marketing', 'homepage', 'login.html');
  }
  // Marketing routes (with or without .html)
  else if (urlPath.startsWith('/login') || urlPath.startsWith('/signin') || urlPath.startsWith('/apropos')) {
    let fileName = urlPath.replace(/^\//, ''); // Remove leading /
    if (!fileName.endsWith('.html')) {
      fileName += '.html'; // Add .html only if not present
    }
    filePath = path.join(__dirname, 'frontend_marketing', 'homepage', fileName);
  }
  // App routes
  else if (urlPath === '/app') {
    filePath = path.join(__dirname, 'frontend_app', 'module_tableau_bord.html');
  }
  else if (urlPath.startsWith('/app/')) {
    const appFile = urlPath.replace(/^\/app\//, '');
    filePath = path.join(__dirname, 'frontend_app', appFile);
  }
  // Assets (JS, CSS from frontend_app)
  else if (urlPath.startsWith('/js/') || urlPath.startsWith('/css/') || urlPath.startsWith('/assets/')) {
    filePath = path.join(__dirname, 'frontend_app', urlPath);
  }
  // Default: look in frontend_marketing
  else {
    filePath = path.join(__dirname, 'frontend_marketing', 'homepage', urlPath.replace(/^\//, ''));
  }
  
  // Security: prevent directory traversal
  const normalizedPath = path.normalize(filePath);
  if (!normalizedPath.startsWith(path.normalize(__dirname))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Try with .html extension if not found (for routes without extension)
      if (!filePath.endsWith('.html') && !filePath.includes('.')) {
        const htmlPath = filePath + '.html';
        fs.readFile(htmlPath, (err2, data2) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not found: ' + filePath);
            return;
          }
          serveFile(res, data2, htmlPath);
        });
        return;
      }
      
      res.writeHead(404);
      res.end('Not found: ' + filePath);
      return;
    }
    serveFile(res, data, filePath);
  });

  function serveFile(res, data, filePath) {
    const ext = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.mjs': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
    };

    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
    res.end(data);
  }
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 Frontend Local Server STARTED`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`📍 Login: http://localhost:${PORT}/login.html`);
  console.log(`📍 App: http://localhost:${PORT}/app`);
  console.log(`\n⚙️  Backend (Render): https://ogoue.onrender.com`);
  console.log(`💾 Database: Supabase (production)\n`);
  console.log(`Press Ctrl+C to stop server`);
});
