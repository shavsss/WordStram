# WordStream2 - Automatic Daily Git Backup Script
# This script commits all changes and pushes them to the remote repository

# Get current date for commit message
$date = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
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
    git push origin master
    Write-Host "Push completed!" -ForegroundColor Green
} else {
    Write-Host "No remote repository configured. Skipping push." -ForegroundColor Red
    Write-Host "To add a remote repository, use: git remote add origin <repository-url>" -ForegroundColor Cyan
}

Write-Host "Backup completed at $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")" -ForegroundColor Green 