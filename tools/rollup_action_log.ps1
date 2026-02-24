param(
  [string]$Path = "ACTION_LOG.md",
  [int]$KeepLinesPerDate = 30
)

if (-not (Test-Path $Path)) {
  Write-Error "Missing log file: $Path"
  exit 1
}

$lines = Get-Content $Path
$out = New-Object System.Collections.Generic.List[string]
$currentDateHeader = $null
$bucket = New-Object System.Collections.Generic.List[string]

function Flush-Bucket {
  param($header, $items, $target, $keep)
  if (-not $header) { return }
  $target.Add($header) | Out-Null
  if ($items.Count -le $keep) {
    foreach ($i in $items) { $target.Add($i) | Out-Null }
    return
  }

  # Keep newest lines and add one rollup.
  $summary = "- [rollup] " + ($items.Count - $keep) + " earlier repetitive actions summarized."
  $target.Add($summary) | Out-Null
  $start = [Math]::Max(0, $items.Count - $keep)
  for ($i = $start; $i -lt $items.Count; $i++) {
    $target.Add($items[$i]) | Out-Null
  }
}

foreach ($line in $lines) {
  if ($line -match '^## \d{4}-\d{2}-\d{2}$') {
    Flush-Bucket -header $currentDateHeader -items $bucket -target $out -keep $KeepLinesPerDate
    $currentDateHeader = $line
    $bucket = New-Object System.Collections.Generic.List[string]
    continue
  }

  if ($currentDateHeader -and $line -match '^- ') {
    $bucket.Add($line) | Out-Null
    continue
  }

  if (-not $currentDateHeader) {
    $out.Add($line) | Out-Null
  } else {
    Flush-Bucket -header $currentDateHeader -items $bucket -target $out -keep $KeepLinesPerDate
    $currentDateHeader = $null
    $bucket = New-Object System.Collections.Generic.List[string]
    $out.Add($line) | Out-Null
  }
}

Flush-Bucket -header $currentDateHeader -items $bucket -target $out -keep $KeepLinesPerDate
$out | Set-Content $Path
Write-Host "Rolled up $Path"
