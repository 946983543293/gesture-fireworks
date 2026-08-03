import { build } from 'esbuild';
import { readFile, writeFile, mkdir, rm, copyFile, readdir, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, sep } from 'node:path';
import https from 'node:https';
import { Buffer } from 'node:buffer';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = join(root, 'dist', 'build');
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const INDEX_HTML = `<!doctype html><html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>手势烟花</title>
<link rel="stylesheet" href="style.css"></head>
<body><div id="stage">
<video id="cam" autoplay muted playsinline></video>
<canvas id="scene-canvas"></canvas>
<div id="overlay"><button id="start">✨ 开始(请允许摄像头)</button><div id="status">点击开始</div></div>
<div class="hint">☝ 食指=写字 &nbsp; ✊ 握拳=停笔 &nbsp; 🖐 张掌=烟花 &nbsp; 👌 OK手势=爱心彩蛋</div>
<div class="credit">Built by 聆风语</div>
</div><script src="app.js"></script></body></html>`;

function dl(url, dest) {
  return new Promise((res, rej) => {
    const get = (u) => https.get(u, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); return get(r.headers.location); }
      if (r.statusCode !== 200) return rej(new Error('下载失败 ' + u + ' ' + r.statusCode));
      const f = createWriteStream(dest);
      r.pipe(f); f.on('finish', () => f.close(res));
    }).on('error', rej);
    get(url);
  });
}

async function readAllFiles(dir, acc = []) {
  for (const e of await readdir(dir)) {
    const p = join(dir, e);
    if ((await stat(p)).isDirectory()) await readAllFiles(p, acc);
    else acc.push(p);
  }
  return acc;
}

// 单文件 .bat:cmd 头用 -EncodedCommand 传 PowerShell(UTF-16LE base64,无引号问题);
// 路径经 set "SELF=%~f0" → $env:SELF;脚本读自身 ::DATA:: 后的内嵌 base64 清单解压 + 起本地服务。
// 端口被占自动换;出错不闪退(停在控制台)。
function makeBat(files) {
  const manifest = files.map((f) => `${f.rel}|${Buffer.from(f.data).toString('base64')}`).join('\n');
  const ps = `try {
$ErrorActionPreference='Stop'
$dir = Join-Path $env:TEMP 'gesture-fireworks'
Remove-Item -Recurse -Force $dir -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $dir | Out-Null
$self = Get-Content -LiteralPath $env:SELF -Raw
$data = ($self -split '::DATA::')[1]
foreach($raw in $data -split [char]10){
  $line = $raw.Trim()
  if(-not $line){ continue }
  $i = $line.IndexOf('|')
  $name = $line.Substring(0,$i).Replace('/', '\\')
  $bytes = [Convert]::FromBase64String($line.Substring($i+1))
  $rel = Join-Path $dir $name
  $parent = Split-Path $rel
  if(-not (Test-Path $parent)){ New-Item -ItemType Directory -Force -Path $parent | Out-Null }
  [IO.File]::WriteAllBytes($rel,$bytes)
}
$listener = $null
$port = 0
foreach($p in 8731,8732,8733,8734,8735,8800,9000,9090){
  try { $l = New-Object System.Net.HttpListener; $l.Prefixes.Add("http://localhost:$p/"); $l.Start(); $listener = $l; $port = $p; break } catch {}
}
if(-not $listener){ throw 'no available port' }
Write-Host "手势烟花运行中,端口 $port — 关闭此窗口退出。"
Start-Process "http://localhost:$port/index.html"
$mime = @{ '.html'='text/html'; '.js'='text/javascript'; '.mjs'='text/javascript'; '.css'='text/css'; '.wasm'='application/wasm'; '.task'='application/octet-stream' }
while($listener.IsListening){
  $ctx = $listener.GetContext()
  $rel = $ctx.Request.Url.AbsolutePath.Trim('/').Replace('/', '\\')
  if($rel -eq ''){ $rel = 'index.html' }
  $f = Join-Path $dir $rel
  if(Test-Path $f -PathType Leaf){
    $ext = [IO.Path]::GetExtension($f)
    if($mime.ContainsKey($ext)){ $ctx.Response.ContentType = $mime[$ext] }
    $b = [IO.File]::ReadAllBytes($f)
    $ctx.Response.OutputStream.Write($b,0,$b.Length)
  } else { $ctx.Response.StatusCode = 404 }
  $ctx.Response.Close()
}
} catch {
  Write-Host ''
  Write-Host '运行出错:' $_.Exception.Message -ForegroundColor Red
  Write-Host ''
  Write-Host '请截图此窗口发给开发者,然后按任意键关闭...'
  [void][Console]::ReadKey($true)
}`;
  const enc = Buffer.from(ps, 'utf16le').toString('base64');
  const header = [
    '@echo off',
    'chcp 65001 >nul',
    'set "SELF=%~f0"',
    `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${enc}`,
    'exit /b',
  ].join('\r\n');
  return header + '\r\n::DATA::\r\n' + manifest + '\r\n';
}

async function main() {
  await rm(join(root, 'dist'), { recursive: true, force: true });
  await mkdir(join(buildDir, 'wasm'), { recursive: true });

  await build({
    entryPoints: [join(root, 'src', 'js', 'main.js')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    define: { '__PACKAGED__': 'true' },
    alias: { 'three/addons': 'three/examples/jsm' },
    outfile: join(buildDir, 'app.js'),
    minify: false,
    logLevel: 'info',
  });

  const wasmSrc = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
  for (const f of await readdir(wasmSrc)) await copyFile(join(wasmSrc, f), join(buildDir, 'wasm', f));

  await dl(MODEL_URL, join(buildDir, 'hand_landmarker.task'));

  await copyFile(join(root, 'src', 'style.css'), join(buildDir, 'style.css'));
  await writeFile(join(buildDir, 'index.html'), INDEX_HTML);

  const abs = await readAllFiles(buildDir);
  const files = await Promise.all(abs.map(async (p) => ({
    rel: p.replace(buildDir + sep, '').replace(/\\/g, '/'),
    data: await readFile(p),
  })));
  const bat = makeBat(files);
  await writeFile(join(root, 'dist', '手势烟花.bat'), bat, 'utf8');
  const sizeMB = (Buffer.byteLength(bat) / 1048576).toFixed(1);
  console.log(`✓ 生成 dist/手势烟花.bat (${files.length} 个文件, 约 ${sizeMB} MB)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
