
## Estrategia de Copias de Seguridad y Recuperación (Disaster Recovery)

Para garantizar la integridad y disponibilidad de los datos, implementamos la siguiente estrategia:

### 1. Copias de Seguridad (Backups)

- **Backups Automáticos (PaaS):** Utilizamos las copias de seguridad automáticas proporcionadas por nuestro proveedor de base de datos (Railway/Vercel Postgres) con Point-in-Time Recovery.
- **Backups Externos (S3):** Contamos con un script personalizado para realizar volcados completos de la base de datos y almacenarlos en AWS S3.

**Ejecutar backup manual:**
```bash
npm run backup-db
```
*Nota: Requiere tener `pg_dump` instalado y las variables de entorno AWS configuradas.*

### 2. Recuperación ante Desastres

En caso de pérdida de datos o corrupción crítica:

1.  **Restauración desde PaaS:** Utilizar la consola de Railway/Vercel para restaurar un backup automático a una fecha/hora anterior al incidente.
2.  **Restauración desde S3 (Manual):**
    *   Descargar el archivo `.sql` más reciente desde el bucket S3 (`db-backups/`).
    *   Restaurar usando `pg_restore`:
        ```bash
        pg_restore -d "DATABASE_URL" backup-fecha.sql
        ```

### 3. Protección de Datos en Producción

- **Seed Seguro:** El script `prisma/seed.ts` incluye una verificación de seguridad (`SAFEGUARD`) que impide su ejecución si detecta usuarios existentes en la base de datos, evitando el borrado accidental de datos en producción.
- **Migraciones:** En producción, utilizar siempre `prisma migrate deploy` y nunca `migrate reset`.
