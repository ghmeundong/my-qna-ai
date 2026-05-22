const fs = require("fs");
const path = require("path");
const { jsonRes } = require("../utils/response");

function handleStaticFiles(pathname, res) {
  const baseDir = path.resolve(__dirname, "../frontend");
  const target = pathname === "/" ? "login.html" : pathname.replace(/^\/+/, "");
  const resolved = path.resolve(baseDir, target);

  if (!resolved.startsWith(baseDir)) {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  fs.readFile(resolved, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    const mimeTypes = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".json": "application/json",
    };
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain" });
    res.end(content);
  });
}

module.exports = { handleStaticFiles };
