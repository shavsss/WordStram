# Quick setup script for WordStram2 with GitHub and daily backup
Write-Host "Setting up WordStram2 with GitHub and daily backup..." -ForegroundColor Green

# Setup Git repository
Write-Host "Configuring Git repository..." -ForegroundColor Yellow
git remote remove origin
git remote add origin https://github.com/shavsss/WordStram2.git

# Change branch to main and push
Write-Host "Pushing code to GitHub..." -ForegroundColor Yellow
git branch -m master main
git push -u origin main --force

# Ensure daily backup is configured
Write-Host "Setting up daily backup task..." -ForegroundColor Yellow
$scriptDir = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
$backupScriptPath = Join-Path -Path $scriptDir -ChildPath "backup-git.ps1"
$taskName = "WordStream2-Daily-Backup"

# Register the task
$taskAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$backupScriptPath`""
$taskTrigger = New-ScheduledTaskTrigger -Daily -At "22:00"
Register-ScheduledTask -TaskName $taskName -Action $taskAction -Trigger $taskTrigger -Force

Write-Host "Setup completed successfully!" -ForegroundColor Green
Write-Host "Your project has been pushed to GitHub and will be backed up daily at 22:00." -ForegroundColor Green 