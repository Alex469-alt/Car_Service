@echo off
chcp 65001 >nul
cd /d "D:\Клиенты\2025\Автосервис Лодзь\site"
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/Alex469-alt/Car_Service.git 2>nul
git push -u origin main

