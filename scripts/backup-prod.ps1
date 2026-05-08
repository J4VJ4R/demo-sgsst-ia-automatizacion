param(
  [int]$Keep = 7,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir

Push-Location $rootDir
try {
  $args = @(
    "-ExecutionPolicy", "Bypass",
    "-File", ".\scripts\backup-db.ps1",
    "-Keep", $Keep,
    "-S3Bucket", "pmd-servicios-files-prod",
    "-S3Prefix", "db-backups/",
    "-DotEnvPath", ".\.env"
  )
  if ($DryRun) { $args += "-DryRun" }

  powershell @args
} finally {
  Pop-Location
}

