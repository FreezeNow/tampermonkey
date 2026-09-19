<#
.SYNOPSIS
    一键提交 GitHub 并辅助发布至 GreasyFork
.DESCRIPTION
    自动执行 git add、commit、push，并输出 GreasyFork 同步指引
#>

param(
    [string]$CommitMessage = "feat: 新增/更新 B站黑流量与水军检测 脚本"
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Tampermonkey 脚本一键发布与同步工具   " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. 检查 safe.directory
git config --global --add safe.directory C:/development/tampermonkey 2>$null

# 2. 检查 git 状态
Write-Host "`n[1/3] 检查 Git 变更..." -ForegroundColor Yellow
$status = git status --porcelain
if (-not $status) {
    Write-Host "工作区干净，暂无需要提交的变更。" -ForegroundColor Green
} else {
    Write-Host "检测到以下变更文件:" -ForegroundColor Gray
    git status -s

    Write-Host "`n[2/3] 正在暂存并提交..." -ForegroundColor Yellow
    git add .
    git commit -m $CommitMessage

    Write-Host "`n[3/3] 正在推送到 GitHub 远程仓库 (origin/master)..." -ForegroundColor Yellow
    git push origin master
    Write-Host "GitHub 推送完成！" -ForegroundColor Green
}

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "      GreasyFork 发布 / 自动同步指南      " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "GreasyFork 支持两种发布方式：`n"

Write-Host "【方式 A：一劳永逸的 GitHub 自动同步 (推荐)】" -ForegroundColor Green
Write-Host "1. 打开 GreasyFork: https://greasyfork.org/zh-CN/scripts/new"
Write-Host "2. 选择页面下方的 '从 GitHub 导入并保持同步' (或者脚本管理页面的 '同步')"
Write-Host "3. 填入你的脚本 raw 链接："
Write-Host "   https://raw.githubusercontent.com/FreezeNow/tampermonkey/master/B%E7%AB%99%E9%BB%91%E6%B5%81%E9%87%8F%E4%B8%8E%E6%B0%B4%E5%86%9B%E6%A3%80%E6%B5%8B.user.js" -ForegroundColor Yellow
Write-Host "4. 在 GitHub 仓库设置 Webhook（按 GreasyFork 提示操作），以后只要运行此脚本 git push，GreasyFork 就会全自动更新！`n"

Write-Host "【方式 B：手动快速创建】" -ForegroundColor Cyan
Write-Host "1. 访问 https://greasyfork.org/zh-CN/scripts/new"
Write-Host "2. 直接复制 'B站黑流量与水军检测.user.js' 的全部代码粘贴并点击发布即可。"
Write-Host "==========================================`n"
