# Set connection string for Railway
$env:DATABASE_URL = "postgresql://postgres:cfrhMBasVbbSXxAoiZroGbXQdBrdBewn@yamanote.proxy.rlwy.net:22171/railway"

Write-Host "1. Generando cliente Prisma para PostgreSQL (Railway)..." -ForegroundColor Green
cmd /c "npx prisma generate --schema=prisma/schema.prod.prisma"

Write-Host "2. Subiendo esquema de base de datos a Railway..." -ForegroundColor Green
cmd /c "npx prisma db push --schema=prisma/schema.prod.prisma"

if ($LASTEXITCODE -eq 0) {
    Write-Host "3. Ejecutando semillas (seeds) en Railway..." -ForegroundColor Green
    cmd /c "npx prisma db seed"
} else {
    Write-Host "Error al subir el esquema. Verifique la conexión." -ForegroundColor Red
}

Write-Host "4. Restaurando entorno local (SQLite)..." -ForegroundColor Green
$env:DATABASE_URL = "file:./dev.db"
cmd /c "npx prisma generate --schema=prisma/schema.prisma"

Write-Host "Despliegue completado." -ForegroundColor Green
