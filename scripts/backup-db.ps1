param(
  [string]$S3Bucket = "",
  [string]$S3Prefix = "db-backups/",
  [int]$Keep = 7,
  [string]$PgDumpPath = "",
  [string]$DotEnvPath = "",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Try-LoadDatabaseUrlFromDotEnv {
  param([string]$ProvidedPath)

  $candidates = @()
  if ($ProvidedPath) { $candidates += $ProvidedPath }
  $candidates += (Join-Path -Path (Get-Location) -ChildPath ".env")
  $candidates += (Join-Path -Path (Split-Path -Parent $PSScriptRoot) -ChildPath ".env")

  foreach ($p in $candidates | Select-Object -Unique) {
    if (-not $p) { continue }
    if (-not (Test-Path -Path $p)) { continue }

    $line = Get-Content -LiteralPath $p -ErrorAction Stop |
      Where-Object { $_ -and $_.Trim().StartsWith("DATABASE_URL=") } |
      Select-Object -First 1

    if (-not $line) { continue }

    $value = $line.Substring("DATABASE_URL=".Length).Trim()
    if ($value.StartsWith('"') -and $value.EndsWith('"')) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    if ($value.StartsWith("'") -and $value.EndsWith("'")) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    if ($value) {
      $env:DATABASE_URL = $value
      return
    }
  }
}

if (-not $env:DATABASE_URL) {
  Try-LoadDatabaseUrlFromDotEnv -ProvidedPath $DotEnvPath
}

if (-not $env:DATABASE_URL) {
  throw "DATABASE_URL no está definido."
}

function Resolve-PgDumpPath {
  param([string]$ProvidedPath)

  if ($ProvidedPath) {
    if (Test-Path -Path $ProvidedPath) {
      return $ProvidedPath
    }
    throw "No se encontró pg_dump en la ruta indicada: $ProvidedPath"
  }

  $cmd = Get-Command pg_dump -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) {
    return $cmd.Source
  }

  $root = "C:\Program Files\PostgreSQL"
  if (Test-Path -Path $root) {
    $bins = Get-ChildItem -Path $root -Directory -ErrorAction SilentlyContinue |
      ForEach-Object { Join-Path -Path $_.FullName -ChildPath "bin\pg_dump.exe" } |
      Where-Object { Test-Path -Path $_ }

    if ($bins -and $bins.Count -gt 0) {
      return ($bins | Sort-Object -Descending | Select-Object -First 1)
    }
  }

  throw "pg_dump no está disponible. Instala PostgreSQL client o define -PgDumpPath."
}

function Require-AwsCli {
  $aws = Get-Command aws -ErrorAction SilentlyContinue
  if (-not $aws) {
    throw "AWS CLI no está instalado o no está en PATH (comando 'aws')."
  }
}

$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path -Path (Get-Location) -ChildPath "backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$outFile = Join-Path -Path $backupDir -ChildPath ("pmd-dashboard-{0}.dump" -f $ts)
$pgDump = Resolve-PgDumpPath -ProvidedPath $PgDumpPath

if (-not $DryRun) {
  & $pgDump --dbname="$env:DATABASE_URL" --format=custom --file "$outFile"
}

Write-Output $outFile

if ($Keep -lt 1) {
  throw "El parámetro -Keep debe ser >= 1."
}

$localDumps = Get-ChildItem -Path $backupDir -File -Filter "pmd-dashboard-*.dump" -ErrorAction SilentlyContinue |
  Sort-Object -Property LastWriteTime -Descending

$localToDelete = @()
if ($localDumps -and $localDumps.Count -gt $Keep) {
  $localToDelete = $localDumps | Select-Object -Skip $Keep
}

foreach ($f in $localToDelete) {
  if (-not $DryRun) {
    Remove-Item -LiteralPath $f.FullName -Force
  }
}

if ($S3Bucket) {
  if (-not $DryRun) {
    Require-AwsCli
  }

  $prefix = $S3Prefix
  if ($prefix -and -not $prefix.EndsWith("/")) {
    $prefix = "$prefix/"
  }

  $s3Key = "$prefix$(Split-Path -Leaf $outFile)"
  $s3Uri = "s3://$S3Bucket/$s3Key"

  if (-not $DryRun) {
    aws s3 cp "$outFile" "$s3Uri" | Out-Null

    $listJson = aws s3api list-objects-v2 --bucket "$S3Bucket" --prefix "$prefix" --output json
    $list = $listJson | ConvertFrom-Json
    $contents = @()
    if ($list -and $list.Contents) {
      $contents = @($list.Contents) |
        Where-Object { $_.Key -like "$prefix*.dump" } |
        Sort-Object -Property LastModified -Descending
    }

    $toDelete = @()
    if ($contents.Count -gt $Keep) {
      $toDelete = $contents | Select-Object -Skip $Keep
    }

    foreach ($obj in $toDelete) {
      $key = $obj.Key
      aws s3 rm ("s3://{0}/{1}" -f $S3Bucket, $key) | Out-Null
    }
  }
}
