# Deploy Production Stack
Write-Host "Starting Production Deployment..." -ForegroundColor Green

# 1. Start Services
docker-compose -f docker-compose.prod.yml up -d --build

# 2. Waiting for DB
Write-Host "Waiting for services to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# 3. Run Migrations
Write-Host "Running Database Migrations..." -ForegroundColor Cyan
docker-compose -f docker-compose.prod.yml run --rm api alembic upgrade head

# 4. Create Admin User
Write-Host "Launching Admin Setup Wizard..." -ForegroundColor Cyan
docker-compose -f docker-compose.prod.yml run --rm api python tools/admin_setup_wizard.py

Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "Client URL: http://localhost:3000"
Write-Host "Admin URL: http://localhost:8080"
