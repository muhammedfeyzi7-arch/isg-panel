// Web dışa aktarımını (dist/) SPA olarak sunar — yalnızca uçtan uca testler için.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "dist");
const port = Number(process.argv[3] ?? 8081);
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon", ".ttf": "font/ttf" };

http
  .createServer((req, res) => {
    let file = path.join(root, decodeURIComponent((req.url ?? "/").split("?")[0]));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, "index.html");
    res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`http://localhost:${port}`));
