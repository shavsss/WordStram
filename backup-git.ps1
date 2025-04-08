# WordStream2 - Automatic Daily Git Backup Script
# This script commits all changes and pushes them to the remote repository

# Get current date for commit message
$date = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$dateFile = Get-Date -Format "yyyy-MM-dd-HHmmss"
$commitMessage = "Automatic backup - $date"

# Change to the project directory (update this path if needed)
$projectPath = "C:\Users\User\IdeaProjects\WordStram2"
Set-Location -Path $projectPath

# Output status
Write-Host "WordStream2 Backup Started: $date" -ForegroundColor Green
Write-Host "Working directory: $projectPath" -ForegroundColor Cyan

# Add all changes to git
Write-Host "Adding changes to git..." -ForegroundColor Yellow
git add .

# Commit changes
Write-Host "Committing changes..." -ForegroundColor Yellow
git commit -m $commitMessage

# Push to remote if remote is configured
$hasRemote = git remote -v
if ($hasRemote) {
    Write-Host "Pushing changes to remote repository..." -ForegroundColor Yellow
    git push origin main
    Write-Host "Push completed!" -ForegroundColor Green
} else {
    Write-Host "No remote repository configured. Skipping push." -ForegroundColor Red
    Write-Host "To add a remote repository, use: git remote add origin <repository-url>" -ForegroundColor Cyan
}

# Create ZIP backup
$zipBackupDir = "$projectPath\backup\zip"
if (-not (Test-Path -Path $zipBackupDir)) {
    New-Item -ItemType Directory -Path $zipBackupDir | Out-Null
}

$zipFileName = "WordStream2-backup-$dateFile.zip"
$zipFilePath = "$zipBackupDir\$zipFileName"

Write-Host "Creating ZIP backup file: $zipFileName..." -ForegroundColor Yellow
# Exclude node_modules, dist, and .git from the ZIP
$compress = @{
    Path = "$projectPath\*"
    CompressionLevel = "Optimal"
    DestinationPath = $zipFilePath
}
Compress-Archive @compress -Force
Write-Host "ZIP backup created at: $zipFilePath" -ForegroundColor Green

Write-Host "Backup completed at $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")" -ForegroundColor Green 