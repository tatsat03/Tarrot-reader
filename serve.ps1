# Local server for The Oracle's Chamber (no Python/Node needed).
#  - Serves the game's static files.
#  - Proxies Seraphine's conversations to the Claude API so the API key never reaches the browser.
#
# Usage:  powershell -ExecutionPolicy Bypass -File serve.ps1 [-Port 5173]
# API key: set ANTHROPIC_API_KEY in your environment, or put   ANTHROPIC_API_KEY=sk-ant-...   in a .env file
#          next to this script. Without a key, Seraphine still works with her scripted lines.
# Voice:   optionally ELEVENLABS_API_KEY (and ELEVENLABS_VOICE_ID) the same way, for a character voice.
param([int]$Port = 5173)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root = $PSScriptRoot
$Model = 'claude-opus-5-5'

# Reads a setting from the environment, or from a .env file next to this script.
function Get-Setting([string]$name) {
  $v = [Environment]::GetEnvironmentVariable($name)
  if ($v) { return $v.Trim() }
  $envFile = Join-Path $root '.env'
  if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile) {
      if ($line -match "^\s*$name\s*=\s*[""']?([^""'\s]+)[""']?\s*$") { return $Matches[1] }
    }
  }
  return $null
}
function Get-ApiKey { Get-Setting 'ANTHROPIC_API_KEY' }

# Seraphine's premium voice: ElevenLabs text-to-speech. Returns MP3 bytes, or $null on failure.
function Invoke-Tts([string]$bodyText) {
  $key = Get-Setting 'ELEVENLABS_API_KEY'
  if (-not $key) { return $null }
  $voiceId = Get-Setting 'ELEVENLABS_VOICE_ID'; if (-not $voiceId) { $voiceId = '21m00Tcm4TlvDq8ikWAM' }
  $modelId = Get-Setting 'ELEVENLABS_MODEL'; if (-not $modelId) { $modelId = 'eleven_multilingual_v2' }
  $text = [string]($bodyText | ConvertFrom-Json).text
  if (-not $text) { return $null }
  if ($text.Length -gt 1500) { $text = $text.Substring(0, 1500) }
  $payload = [ordered]@{
    text           = $text
    model_id       = $modelId
    voice_settings = @{ stability = 0.45; similarity_boost = 0.8; style = 0.35; use_speaker_boost = $true }
  }
  $bytes = [Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json -Depth 4 -Compress))
  $wr = [Net.HttpWebRequest]::Create("https://api.elevenlabs.io/v1/text-to-speech/$voiceId`?output_format=mp3_44100_128")
  $wr.Method = 'POST'
  $wr.ContentType = 'application/json'
  $wr.Accept = 'audio/mpeg'
  $wr.Timeout = 60000
  $wr.Headers.Add('xi-api-key', $key)
  $s = $wr.GetRequestStream(); $s.Write($bytes, 0, $bytes.Length); $s.Close()
  try { $resp = $wr.GetResponse() }
  catch [Net.WebException] {
    $r = $_.Exception.Response
    if ($r) { $msg = (New-Object IO.StreamReader($r.GetResponseStream())).ReadToEnd(); Write-Host "ElevenLabs error $([int]$r.StatusCode): $msg" }
    return $null
  }
  $ms = New-Object IO.MemoryStream
  $resp.GetResponseStream().CopyTo($ms); $resp.Close()
  return $ms.ToArray()
}

function Send-Bytes($res, [int]$status, [string]$type, [byte[]]$bytes) {
  $res.StatusCode = $status
  $res.ContentType = $type
  $res.Headers.Add('Cache-Control', 'no-store')
  if ($script:isHead) { $res.ContentLength64 = $bytes.Length; return }
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
}
function Send-Json($res, [int]$status, $obj) {
  $json = $obj | ConvertTo-Json -Depth 6 -Compress
  Send-Bytes $res $status 'application/json; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes($json))
}

# Forward one conversation turn to Claude. The browser supplies only the system prompt and the
# messages; the model, limits and key are fixed here.
function Invoke-Oracle([string]$bodyText) {
  $key = Get-ApiKey
  if (-not $key) { return @{ status = 503; body = @{ error = 'no-key' } } }

  $req = $bodyText | ConvertFrom-Json
  $messages = @()
  foreach ($m in @($req.messages | Select-Object -Last 24)) {
    $role = [string]$m.role
    if ($role -ne 'user' -and $role -ne 'assistant') { continue }
    $text = [string]$m.content
    if ($text.Length -gt 6000) { $text = $text.Substring(0, 6000) }
    $messages += @{ role = $role; content = $text }
  }
  if ($messages.Count -eq 0 -or $messages[0].role -ne 'user') { return @{ status = 400; body = @{ error = 'bad-messages' } } }
  $system = [string]$req.system
  if ($system.Length -gt 20000) { $system = $system.Substring(0, 20000) }

  $payload = [ordered]@{
    model         = $Model
    max_tokens    = 8000
    output_config = @{ effort = 'low' }   # conversational replies: keep latency low
    fallbacks     = 'default'             # server-side retry on another model if a safety classifier declines
    system        = $system
    messages      = $messages
  }
  $json = $payload | ConvertTo-Json -Depth 8 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)

  $wr = [Net.HttpWebRequest]::Create('https://api.anthropic.com/v1/messages')
  $wr.Method = 'POST'
  $wr.ContentType = 'application/json'
  $wr.Timeout = 120000
  $wr.Headers.Add('x-api-key', $key)
  $wr.Headers.Add('anthropic-version', '2023-06-01')
  $wr.Headers.Add('anthropic-beta', 'server-side-fallback-2026-07-01')
  $stream = $wr.GetRequestStream(); $stream.Write($bytes, 0, $bytes.Length); $stream.Close()

  try { $resp = $wr.GetResponse() }
  catch [Net.WebException] { $resp = $_.Exception.Response; if (-not $resp) { return @{ status = 502; body = @{ error = 'network' } } } }
  $reader = New-Object IO.StreamReader($resp.GetResponseStream(), [Text.Encoding]::UTF8)
  $raw = $reader.ReadToEnd(); $reader.Close()
  $code = [int]$resp.StatusCode
  $data = $raw | ConvertFrom-Json

  if ($code -ne 200) {
    $msg = if ($data.error) { [string]$data.error.message } else { 'api-error' }
    Write-Host "Claude API error $code`: $msg"
    return @{ status = 502; body = @{ error = 'api'; detail = $msg; code = $code } }
  }
  if ($data.stop_reason -eq 'refusal') { return @{ status = 200; body = @{ text = ''; stop_reason = 'refusal' } } }
  $text = (@($data.content | Where-Object { $_.type -eq 'text' } | ForEach-Object { $_.text }) -join "`n").Trim()
  return @{ status = 200; body = @{ text = $text; stop_reason = [string]$data.stop_reason } }
}

$types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json'; '.png' = 'image/png'
  '.jpg' = 'image/jpeg'; '.svg' = 'image/svg+xml'; '.glb' = 'model/gltf-binary'
  '.mp3' = 'audio/mpeg'; '.wav' = 'audio/wav'; '.woff2' = 'font/woff2'; '.ico' = 'image/x-icon'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "The Oracle's Chamber is open at http://localhost:$Port/"
if (Get-ApiKey) { Write-Host "Claude: API key found - Seraphine can converse ($Model)." }
else { Write-Host "Claude: no API key found - Seraphine will use her scripted lines. See README.md to connect." }
if (Get-Setting 'ELEVENLABS_API_KEY') { Write-Host "Voice: ElevenLabs key found - Seraphine speaks with a character voice." }
else { Write-Host "Voice: using the browser's built-in voices (best in Microsoft Edge)." }

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    $script:isHead = $req.HttpMethod -eq 'HEAD'
    try {
      $path = $req.Url.AbsolutePath
      if ($path -eq '/api/status') {
        $hasKey = [bool](Get-ApiKey)
        Send-Json $res 200 @{ agent = $hasKey; model = $Model; reason = $(if ($hasKey) { '' } else { 'no-key' }); tts = [bool](Get-Setting 'ELEVENLABS_API_KEY') }
      }
      elseif ($path -eq '/api/tts' -and $req.HttpMethod -eq 'POST') {
        $reader = New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
        $audio = Invoke-Tts $reader.ReadToEnd(); $reader.Close()
        if ($audio) { Send-Bytes $res 200 'audio/mpeg' $audio } else { Send-Json $res 503 @{ error = 'tts' } }
      }
      elseif ($path -eq '/api/oracle' -and $req.HttpMethod -eq 'POST') {
        $reader = New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
        $body = $reader.ReadToEnd(); $reader.Close()
        $result = Invoke-Oracle $body
        Send-Json $res $result.status $result.body
      }
      else {
        $rel = [Uri]::UnescapeDataString($path.TrimStart('/'))
        if ($rel -eq '') { $rel = 'index.html' }
        $file = [IO.Path]::GetFullPath((Join-Path $root $rel))
        $name = [IO.Path]::GetFileName($file)
        if ($file.StartsWith($root) -and $name -ne '.env' -and (Test-Path $file -PathType Leaf)) {
          $ext = [IO.Path]::GetExtension($file).ToLower()
          $type = if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' }
          Send-Bytes $res 200 $type ([IO.File]::ReadAllBytes($file))
        } else {
          $res.StatusCode = 404
        }
      }
    } catch {
      Write-Host "Request failed: $($_.Exception.Message)"
      try { Send-Json $res 500 @{ error = 'server' } } catch {}
    }
    $res.Close()
  }
} finally { $listener.Stop() }
