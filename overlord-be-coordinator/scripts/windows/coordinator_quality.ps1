<#
.SYNOPSIS
Runs the local coordinator quality baseline for Windows developers.

.DESCRIPTION
This is the canonical repo-local validation entrypoint for TypeScript, Svelte,
and Prisma changes in the coordinator repo.
#>
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$coordinatorDir = Resolve-Path (Join-Path $scriptDir "..\..")

Push-Location $coordinatorDir
try {
    Write-Host "Running npm run check..."
    & npm run check
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    Write-Host "Running npm run prisma:validate..."
    & npm run prisma:validate
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    Write-Host "Running npm run prisma:generate..."
    & npm run prisma:generate
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}
finally {
    Pop-Location
}
