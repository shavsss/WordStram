# Script to push WordStram2 to GitHub
Write-Host "Pushing WordStram2 to GitHub..." -ForegroundColor Green

# Check current branch
$currentBranch = git rev-parse --abbrev-ref HEAD 2>&1
Write-Host "Current branch: $currentBranch" -ForegroundColor Cyan

# Check remote configuration
Write-Host "Remote configuration:" -ForegroundColor Cyan
git remote -v | Out-String

# Try changing branch to main if we're on master
if ($currentBranch -eq "master") {
    Write-Host "Attempting to rename master branch to main..." -ForegroundColor Yellow
    git branch -m master main
    Write-Host "Branch renamed to main" -ForegroundColor Green
} else {
    Write-Host "Current branch is not master, skipping rename" -ForegroundColor Yellow
}

# Set Git to not use a pager for any command
$env:GIT_PAGER = "cat"

# Push to GitHub with force option
Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
git push -u origin main --force

Write-Host "Push operation complete" -ForegroundColor Green 