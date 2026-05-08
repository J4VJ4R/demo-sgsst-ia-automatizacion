# Reglas del proyecto: despliegues y base de datos

## Push a main

Antes de ejecutar cualquier push a `main`, revisar si el cambio afecta base de datos:

- Cambios en `prisma/schema.prisma` o `prisma/schema.prod.prisma`.
- Cambios en `prisma/migrations/**` o `prisma/migration_lock.toml`.
- SQL manual (CREATE/ALTER/DROP) que se ejecutará en producción.

Si afecta base de datos en producción:

- No hacer push automáticamente.
- Pedir autorización explícita del usuario indicando que ya existe backup/snapshot.
- Solo proceder cuando el usuario confirme explícitamente el backup y la autorización.

Checklist recomendado:
- Snapshot/backup creado y verificado (RDS: estado Available).
- Plan de rollback definido.
- Confirmación de ventana de despliegue.

Guardarraíl adicional:
- Ver `docs/PROD_DB_PUSH_GUARDRAIL.md` y activar hook con `git config core.hooksPath .githooks`.

