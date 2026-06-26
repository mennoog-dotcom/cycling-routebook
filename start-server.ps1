$port = 9000
$root = $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Cycling Routebook draait op http://localhost:$port/"
Write-Host "Druk Ctrl+C om te stoppen."
Start-Process "http://localhost:$port/"

$mime = @{ '.html'='text/html'; '.js'='application/javascript'; '.css'='text/css'; '.gpx'='application/xml'; '.json'='application/json' }

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $path = $ctx.Request.Url.LocalPath.TrimStart('/')
    if ($path -eq '') { $path = 'index.html' }
    $file = Join-Path $root $path
    if (Test-Path $file -PathType Leaf) {
      $ext = [IO.Path]::GetExtension($file)
      $ctx.Response.ContentType = if ($mime[$ext]) { $mime[$ext] } else { 'application/octet-stream' }
      $bytes = [IO.File]::ReadAllBytes($file)
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
    }
    $ctx.Response.Close()
  }
} finally {
  $listener.Stop()
}
