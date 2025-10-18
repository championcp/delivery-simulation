import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'locker.db');

let dbInstance: Database.Database | null = null;

function createDefaultLockers() {
  const lockerLayout: { label: string; size: 'small' | 'medium' | 'large' }[] =
    [
      { label: 'A01', size: 'medium' },
      { label: 'A02', size: 'medium' },
      { label: 'A03', size: 'medium' },
      { label: 'A04', size: 'large' },
      { label: 'B01', size: 'small' },
      { label: 'B02', size: 'small' },
      { label: 'B03', size: 'small' },
      { label: 'B04', size: 'small' },
      { label: 'B05', size: 'small' },
      { label: 'B06', size: 'small' },
      { label: 'C01', size: 'medium' },
      { label: 'C02', size: 'medium' },
      { label: 'C03', size: 'medium' },
      { label: 'C04', size: 'large' },
      { label: 'D01', size: 'small' },
      { label: 'D02', size: 'small' },
      { label: 'D03', size: 'small' },
      { label: 'D04', size: 'small' },
      { label: 'D05', size: 'small' },
      { label: 'D06', size: 'small' },
      { label: 'E01', size: 'medium' },
      { label: 'E02', size: 'medium' },
      { label: 'E03', size: 'medium' },
      { label: 'E04', size: 'large' },
    ];

  const db = getDb();
  const existing = db
    .prepare('SELECT COUNT(*) as count FROM lockers')
    .get() as { count: number } | undefined;
  if ((existing?.count ?? 0) > 0) {
    return;
  }

  const insert = db.prepare(
    'INSERT INTO lockers (label, size) VALUES (@label, @size)',
  );
  const transaction = db.transaction(() => {
    lockerLayout.forEach((locker) => insert.run(locker));
  });
  transaction();
}

function initialiseDatabase(database: Database.Database) {
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS lockers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL UNIQUE,
      size TEXT NOT NULL CHECK (size IN ('small', 'medium', 'large'))
    );

    CREATE TABLE IF NOT EXISTS packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      locker_id INTEGER NOT NULL,
      recipient_name TEXT,
      recipient_phone TEXT NOT NULL,
      pickup_code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK (status IN ('stored', 'picked')),
      created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
      picked_up_at TEXT,
      FOREIGN KEY (locker_id) REFERENCES lockers(id)
    );
  `);
}

export function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  const database = new Database(DB_PATH);
  initialiseDatabase(database);
  dbInstance = database;

  createDefaultLockers();

  return database;
}
