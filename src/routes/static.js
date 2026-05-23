const fs = require("fs");
const path = require("path");
const { jsonRes } = require("../utils/response");

function handleStaticFiles(pathname, res) {
  const baseDir = path.resolve(__dirname, "../../frontend");
  let target = pathname === "/" ? "login.html" : pathname.replace(/^\/+/, "");
  const ext = path.extname(target).toLowerCase();

  // 파일 확장자에 따라 폴더 분류
  if (ext === ".html") {
    target = `html/${target}`;
  } else if (ext === ".js") {
    target = `js/${target}`;
  } else if (ext === ".css") {
    target = `css/${target}`;
  }

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
