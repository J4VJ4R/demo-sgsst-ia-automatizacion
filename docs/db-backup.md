# Copia de seguridad de la base de datos (PostgreSQL)

## Opción A (Recomendada en RDS): Snapshot

- Crear un snapshot manual en AWS RDS del instance/cluster correspondiente.
- Verificar que el snapshot finalice correctamente antes de aplicar migraciones.
- Mantener el snapshot hasta validar la funcionalidad en producción.

## Opción B: Backup lógico con pg_dump

### Requisitos

- Tener instalado el cliente de PostgreSQL (incluye `pg_dump`).
- Tener disponible la variable de entorno `DATABASE_URL` con la cadena de conexión.
- Para subir a S3: tener AWS CLI configurado (perfil/credenciales) con acceso al bucket.

### Comando (Windows PowerShell)

```powershell
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
New-Item -ItemType Directory -Force -Path ".\backups" | Out-Null
pg_dump --dbname="$env:DATABASE_URL" --format=custom --file ".\backups\pmd-dashboard-$ts.dump"
```

### Script del proyecto (local y S3 con retención)

Local (retiene 7 dumps en `.\backups`):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-db.ps1 -Keep 7
```

Local + S3 (retiene 7 dumps en local y en `s3://<bucket>/db-backups/`):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-db.ps1 -Keep 7 -S3Bucket "<bucket>" -S3Prefix "db-backups/"
```

### Atajo (producción)

Genera el backup y lo sube al bucket de producción (retiene 7):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-prod.ps1
```

Modo simulación:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-prod.ps1 -DryRun
```

Modo simulación (no genera dump, no sube, no borra):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-db.ps1 -Keep 7 -S3Bucket "<bucket>" -S3Prefix "db-backups/" -DryRun
```

### Restauración (referencia)

```powershell
pg_restore --dbname="$env:DATABASE_URL" --clean --if-exists ".\backups\pmd-dashboard-$ts.dump"
```

## Orden recomendado de despliegue para cambios de esquema

1) Crear backup (snapshot o `pg_dump`).
2) Aplicar la migración que agrega columnas nuevas (operación compatible hacia atrás).
3) Desplegar la aplicación (código que lee/escribe esas columnas).
