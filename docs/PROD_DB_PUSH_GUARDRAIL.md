# Guardarraíl: Push a main con cambios de base de datos

Este repositorio contiene cambios que pueden requerir migraciones/DDL en producción (RDS). Para evitar catástrofes, se usa un guardarraíl que bloquea el push a `main` cuando detecta cambios en:

- `prisma/schema.prisma`
- `prisma/schema.prod.prisma`
- `prisma/migrations/**`
- `prisma/migration_lock.toml`

## Activación del hook

Configura Git para usar los hooks versionados del repo:

```bash
git config core.hooksPath .githooks
```

Verifica que está activo:

```bash
git config core.hooksPath
```

## Qué hace

Si intentas `git push` a `main` y el push incluye cambios en los archivos anteriores, el hook:

- Bloquea el push.
- Muestra un mensaje con la lista de archivos.
- Te pide backup/snapshot y aprobación explícita.

## Cómo permitir el push (solo si ya hay backup y autorización)

Permitir una sola vez en esa terminal:

```bash
PMD_ALLOW_DB_PUSH=YES git push origin main
```

## Checklist recomendado antes de permitir un push con cambios de BD

- Snapshot/backup en RDS tomado y confirmado (estado Available).
- SQL/migración revisada (CREATE/ALTER/DROP, índices, constraints).
- Plan de rollback definido (restaurar snapshot o revertir migración).
- Ventana de despliegue coordinada.
- Deploy confirmado en staging/preview si aplica.

