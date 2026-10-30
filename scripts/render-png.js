const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const svgPath = path.join(__dirname, '..', 'resources', 'commitflow-isotipo-color.svg');
const svgRaw = fs.readFileSync(svgPath, 'utf8');
const base64Svg = Buffer.from(svgRaw).toString('base64');

const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 512px;
      height: 512px;
      background: transparent;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    img {
      width: 480px;
      height: 480px;
      object-fit: contain;
    }
  </style>
</head>
<body>
  <img src="data:image/svg+xml;base64,${base64Svg}" alt="CommitFlow Logo" />
</body>
</html>`;

const tempHtml = path.join(__dirname, 'render_temp.html');
const outPng = path.join(__dirname, '..', 'resources', 'commitflow-logo-color.png');

fs.writeFileSync(tempHtml, htmlContent, 'utf8');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const cmd = `"${edgePath}" --headless=new --screenshot="${outPng}" --window-size=512,512 --default-background-color=00000000 "${tempHtml}"`;

try {
  execSync(cmd, { stdio: 'inherit' });
  console.log('Successfully generated:', outPng, 'Size:', fs.statSync(outPng).size);
} catch (err) {
  console.error('Error generating screenshot:', err);
} finally {
  if (fs.existsSync(tempHtml)) {
    fs.unlinkSync(tempHtml);
  }
}
