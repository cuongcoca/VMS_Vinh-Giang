<#
.SYNOPSIS
  Auto-setup Google Cloud for auto-fix sheet automation (idempotent).
  ASCII-only because PowerShell 5.1 mangles UTF-8 without BOM.

.STEPS (script does these automatically after user OAuth login)
  1. Verify gcloud installed
  2. gcloud auth login (browser OAuth, scopes=cloud-platform + drive)
  3. Create project wms-auto-fix-<timestamp>
  4. Enable Sheets + Drive API
  5. Create service account wms-sheet-bot
  6. Download JSON key to .secrets/google-sheet-key.json
  7. Share Google Sheet with service account email via Drive API
  8. Verify: run node scripts/sheet-ops.js inspect

.NOTES
  Run from project root: cd D:\wms-vinhgiang_repo; .\scripts\setup-gcp.ps1
#>

param(
  [string]$SheetId = "1U-8HI4JhX5MPnpdYjvE1X9kUWvT2GyZFbMm5dBaNXog",
  [string]$ProjectIdPrefix = "wms-auto-fix",
  [string]$ServiceAccountName = "wms-sheet-bot",
  [string]$KeyOutputPath = ".\.secrets\google-sheet-key.json"
)

# PowerShell 5.1 + native exe stderr quirk: 'Stop' policy throws on gcloud stderr (NativeCommandError).
# Use Continue + explicit $LASTEXITCODE checks below.
$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

# Helper: run gcloud, capture both streams, return stdout. Throws ONLY on real exit code != 0.
function Invoke-Gcloud {
  [CmdletBinding()]
  param([Parameter(ValueFromRemainingArguments=$true)] [string[]]$Args)
  $output = & gcloud @Args 2>&1
  $exitCode = $LASTEXITCODE
  # Filter ErrorRecord (stderr noise) from real stdout strings
  $stdout = @($output | Where-Object { $_ -is [string] })
  $stderr = @($output | Where-Object { $_ -isnot [string] } | ForEach-Object { $_.ToString() })
  if ($exitCode -ne 0) {
    Write-Host "  gcloud stderr:" -ForegroundColor DarkYellow
    $stderr | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkYellow }
    throw ("gcloud exit {0}: gcloud {1}" -f $exitCode, ($Args -join ' '))
  }
  return $stdout -join "`n"
}

function Write-Step($msg) {
  Write-Host ""
  Write-Host "================================================================"
  Write-Host "[STEP] $msg"
  Write-Host "================================================================"
}
function Write-Ok($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "  [FAIL] $msg" -ForegroundColor Red }

# --- 1. Verify gcloud installed -----------------------------------------
Write-Step "1/8 Verify gcloud installed"

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$gcloud = Get-Command gcloud -ErrorAction SilentlyContinue
if (-not $gcloud) {
  Write-Err "gcloud not found in PATH."
  Write-Host "   Install via: winget install Google.CloudSDK"
  Write-Host "   Then OPEN A NEW POWERSHELL and re-run this script."
  exit 1
}
Write-Ok "gcloud found at: $($gcloud.Source)"
$gcloudVersion = (gcloud --version 2>&1 | Select-Object -First 1)
Write-Host "  Version: $gcloudVersion"

# --- 2. Auth login ------------------------------------------------------
Write-Step "2/8 Google Cloud auth (login + Drive scope)"

# Check active account via auth list (more reliable than config get-value).
$accountsRaw = ""
try { $accountsRaw = Invoke-Gcloud auth list --filter=status:ACTIVE --format="value(account)" } catch { $accountsRaw = "" }
$currentAccount = ($accountsRaw -split "`n" | Where-Object { $_ } | Select-Object -First 1)

if ($currentAccount) {
  Write-Ok "Already logged in as: $currentAccount"
  Write-Warn "If wrong account, Ctrl+C then run: gcloud auth revoke --all, then re-run."
} else {
  Write-Host "  Browser will open for Google login..."
  Write-Host "  Choose the Google account you want to use (must have access to the sheet)."
  Write-Host ""
  # Google blocks custom scopes (Drive) on default gcloud client ID since 2026.
  # → Use only standard gcloud auth here; share sheet MANUALLY in Step 7.
  gcloud auth login
  if ($LASTEXITCODE -ne 0) { Write-Err "gcloud auth login failed."; exit 1 }
  try { $accountsRaw = Invoke-Gcloud auth list --filter=status:ACTIVE --format="value(account)" } catch {}
  $currentAccount = ($accountsRaw -split "`n" | Where-Object { $_ } | Select-Object -First 1)
  Write-Ok "Logged in: $currentAccount"
}

# --- 3. Create / reuse project ------------------------------------------
Write-Step "3/8 Create Google Cloud Project"

$projectsRaw = ""
try { $projectsRaw = Invoke-Gcloud projects list --filter="projectId:$ProjectIdPrefix*" --format="value(projectId)" } catch {}
$existingProjects = @($projectsRaw -split "`n" | Where-Object { $_ })

if ($existingProjects.Count -gt 0) {
  $ProjectId = $existingProjects[0]
  Write-Ok "Using existing project: $ProjectId"
} else {
  $ts = Get-Date -Format "yyyyMMddHHmm"
  $ProjectId = "$ProjectIdPrefix-$ts"
  Write-Host "  Creating new project: $ProjectId"
  try {
    Invoke-Gcloud projects create $ProjectId --name="WMS Auto Fix Automation" | Out-Host
    Write-Ok "Created project: $ProjectId"
  } catch {
    Write-Err "Project creation failed. Common reasons:"
    Write-Host "    - Free project quota exhausted (each Google account ~12 projects)"
    Write-Host "    - Account has not accepted Cloud TOS - visit https://console.cloud.google.com once"
    Write-Host "    - Error: $_"
    exit 1
  }
}

try { Invoke-Gcloud config set project $ProjectId | Out-Null } catch { Write-Err "Set project failed: $_"; exit 1 }
Write-Ok "Active project set: $ProjectId"

# --- 4. Enable APIs -----------------------------------------------------
Write-Step "4/8 Enable Google Sheets + Drive API"

$apis = @("sheets.googleapis.com", "drive.googleapis.com")
foreach ($api in $apis) {
  Write-Host "  Enabling $api ..."
  try {
    Invoke-Gcloud services enable $api --project=$ProjectId | Out-Null
    Write-Ok "$api enabled"
  } catch {
    Write-Err "Enable $api failed: $_"
    Write-Host "    Project may need billing. Sheets API usually does NOT need billing,"
    Write-Host "    but if error says it does - visit https://console.cloud.google.com/billing"
    exit 1
  }
}

# --- 5. Create service account ------------------------------------------
Write-Step "5/8 Create Service Account"

$saEmail = "$ServiceAccountName@$ProjectId.iam.gserviceaccount.com"
$existingSa = ""
try { $existingSa = Invoke-Gcloud iam service-accounts list --filter="email:$saEmail" --format="value(email)" --project=$ProjectId } catch {}

if ($existingSa.Trim()) {
  Write-Ok "Service account exists: $saEmail"
} else {
  try {
    Invoke-Gcloud iam service-accounts create $ServiceAccountName --display-name="WMS Auto Fix Bot" --description="Auto-fix automation for WMS Vinh Giang test sheet" --project=$ProjectId | Out-Host
    Write-Ok "Created service account: $saEmail"
  } catch {
    Write-Err "SA creation failed: $_"; exit 1
  }
}

# --- 6. Download JSON key -----------------------------------------------
Write-Step "6/8 Download JSON key to .secrets/"

$secretsDir = Split-Path -Parent $KeyOutputPath
if (-not (Test-Path $secretsDir)) {
  New-Item -ItemType Directory -Force -Path $secretsDir | Out-Null
  Write-Ok "Created directory $secretsDir"
}

if (Test-Path $KeyOutputPath) {
  Write-Warn "Key already exists at $KeyOutputPath - creating NEW key (old key still valid on Google, revoke manually if needed)."
  $backup = "$KeyOutputPath.bak.$(Get-Date -Format 'yyyyMMddHHmmss')"
  Move-Item $KeyOutputPath $backup
  Write-Host "  Backed up old key to $backup"
}

try {
  Invoke-Gcloud iam service-accounts keys create $KeyOutputPath --iam-account=$saEmail --project=$ProjectId | Out-Host
  Write-Ok "Key saved: $KeyOutputPath ($((Get-Item $KeyOutputPath).Length) bytes)"
} catch {
  Write-Err "Key creation failed: $_"; exit 1
}

# --- 7. Share sheet with service account (MANUAL - Google blocks auto) --
Write-Step "7/8 Share Google Sheet with service account"

Write-Host ""
Write-Host "  Google blocks the Drive scope for the gcloud default OAuth client"
Write-Host "  (security policy since 2026), so auto-share is not possible."
Write-Host "  Please do this 30-second manual step:"
Write-Host ""
Write-Host "  -------------------------------------------------------------"
Write-Host "  1. Open the sheet:"
Write-Host "     https://docs.google.com/spreadsheets/d/$SheetId/edit"
Write-Host "  2. Click 'Share' (top-right blue button)"
Write-Host "  3. Paste this email in the 'Add people' field:"
Write-Host ""
Write-Host "        $saEmail" -ForegroundColor Cyan
Write-Host ""
Write-Host "  4. Set role: Editor"
Write-Host "  5. UNTICK 'Notify people' (service account cannot receive email)"
Write-Host "  6. Click 'Share' / 'Send'"
Write-Host "  -------------------------------------------------------------"
Write-Host ""

# Copy email to clipboard for convenience
try {
  $saEmail | Set-Clipboard
  Write-Ok "Service account email copied to clipboard. Just Ctrl+V in Share dialog."
} catch {
  Write-Warn "Could not copy to clipboard. Email above: $saEmail"
}

Write-Host ""
$null = Read-Host "Press Enter AFTER you have shared the sheet (or Ctrl+C to abort)"

# --- 8. Verify ----------------------------------------------------------
Write-Step "8/8 Verify: test reading sheet"

Write-Host "  Running: node scripts/sheet-ops.js inspect"
Write-Host ""
node scripts/sheet-ops.js inspect 2>&1 | Out-Host
$rc = $LASTEXITCODE

# --- Summary ------------------------------------------------------------
Write-Step "DONE"
Write-Host "Project ID:        $ProjectId"
Write-Host "Service Account:   $saEmail"
Write-Host "Key file:          $KeyOutputPath"
Write-Host "Sheet ID:          $SheetId"
Write-Host ""
if ($rc -eq 0) {
  Write-Host "[SUCCESS] Setup complete! Sheet is readable."
  Write-Host ""
  Write-Host "Next: paste the 'inspect' output above to Claude to:"
  Write-Host "   1. Tune CONFIG.columns in scripts/sheet-ops.js"
  Write-Host "   2. Pilot 2-3 first failures"
  Write-Host "   3. Run /loop /fix-next-sheet-fail for the whole sheet"
} else {
  Write-Warn "Setup done but verify failed. May be:"
  Write-Host "   - Sheet not yet shared (do it manually as noted in Step 7)"
  Write-Host "   - Wrong sheet ID"
  Write-Host "   - Network issue - retry later"
}
