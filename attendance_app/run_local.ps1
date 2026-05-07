# Move to the script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $scriptDir

# Set PIP cache to current directory to avoid C: drive
$env:PIP_CACHE_DIR = Join-Path $scriptDir "pip_cache"

Write-Host "--- Setting up Attendance Pro ---" -ForegroundColor Cyan

# Create Virtual Environment if not exists
if (!(Test-Path "venv")) {
    Write-Host "Creating Virtual Environment on D: drive..."
    python -m venv venv
}

# Activate and install
Write-Host "Installing dependencies..."
.\venv\Scripts\pip install -r requirements.txt

Write-Host "--- Starting Application ---" -ForegroundColor Green
.\venv\Scripts\python app.py
