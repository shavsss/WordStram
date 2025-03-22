# WordStream2 - Setup Daily Backup Task
# This script sets up a scheduled task to run the backup script daily

# Get the current directory and construct the path to the backup script
$scriptDir = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
$backupScriptPath = Join-Path -Path $scriptDir -ChildPath "backup-git.ps1"

# Define the time to run the backup (default: 10:00 PM)
$backupTime = "22:00"

# Convert the path to absolute path
$backupScriptPath = Resolve-Path $backupScriptPath

Write-Host "Setting up daily backup for WordStream2" -ForegroundColor Green
Write-Host "Backup script: $backupScriptPath" -ForegroundColor Cyan
Write-Host "Scheduled time: $backupTime daily" -ForegroundColor Cyan

# Create a scheduled task
$taskName = "WordStream2-Daily-Backup"
$taskAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$backupScriptPath`""
$taskTrigger = New-ScheduledTaskTrigger -Daily -At $backupTime

# Register the task
try {
    Register-ScheduledTask -TaskName $taskName -Action $taskAction -Trigger $taskTrigger -Force
    Write-Host "Scheduled task '$taskName' created successfully!" -ForegroundColor Green
    Write-Host "The backup will run daily at $backupTime" -ForegroundColor Green
}
catch {
    Write-Host "Error creating scheduled task: $_" -ForegroundColor Red
    Write-Host "You may need to run this script as administrator" -ForegroundColor Yellow
}

Write-Host "To run the task manually, use: Start-ScheduledTask -TaskName `"$taskName`"" -ForegroundColor Cyan
Write-Host "To view all scheduled tasks, use: Get-ScheduledTask" -ForegroundColor Cyan

# Remind about remote repository
$hasRemote = git remote -v
if (-not $hasRemote) {
    Write-Host "`nNOTE: No remote repository is configured yet!" -ForegroundColor Red
    Write-Host "To add a remote repository, use:" -ForegroundColor Yellow
    Write-Host "git remote add origin https://github.com/yourusername/WordStram2.git" -ForegroundColor Cyan
    Write-Host "Example for GitHub: git remote add origin https://github.com/yourusername/WordStram2.git" -ForegroundColor Cyan
} 