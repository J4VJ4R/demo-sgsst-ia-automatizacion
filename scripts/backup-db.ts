
import { exec } from 'child_process';
import { uploadToS3 } from '../lib/s3';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

async function backupDatabase() {
  const date = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `backup-${date}.sql`;
  const backupPath = path.join(process.cwd(), 'backups', backupFileName);

  // Ensure backups directory exists
  if (!fs.existsSync('backups')) {
    fs.mkdirSync('backups');
  }

  console.log(`Iniciando respaldo de base de datos: ${backupFileName}...`);

  try {
    // DATABASE_URL must be set in environment
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL no está definida.');
    }

    // Execute pg_dump
    // Note: pg_dump must be installed in the environment where this runs
    await execAsync(`pg_dump "${process.env.DATABASE_URL}" -F c -b -v -f "${backupPath}"`);
    console.log('Respaldo local completado.');

    // Upload to S3
    const fileContent = fs.readFileSync(backupPath);
    const s3Key = `db-backups/${backupFileName}`;
    
    console.log('Subiendo a S3...');
    // We reuse the existing uploadToS3 function, assuming it handles buffers correctly
    // Content-Type for binary pg_dump is application/octet-stream
    await uploadToS3(s3Key, fileContent, 'application/octet-stream');
    
    console.log(`Respaldo subido exitosamente a S3: ${s3Key}`);

    // Cleanup local file
    fs.unlinkSync(backupPath);
    console.log('Archivo local eliminado.');

  } catch (error) {
    console.error('Error durante el proceso de respaldo:', error);
    process.exit(1);
  }
}

backupDatabase();
