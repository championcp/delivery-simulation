import { getDb } from '@/lib/db';

export type LockerSize = 'small' | 'medium' | 'large';
export type LockerStatus = 'empty' | 'occupied';

export interface LockerSummary {
  id: number;
  label: string;
  size: LockerSize;
  status: LockerStatus;
}

interface AssignLockerInput {
  recipientName?: string;
  recipientPhone: string;
  size: LockerSize;
}

export function listLockers(): LockerSummary[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT
        l.id,
        l.label,
        l.size,
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM packages p
            WHERE p.locker_id = l.id AND p.status = 'stored'
          ) THEN 'occupied'
          ELSE 'empty'
        END AS status
      FROM lockers l
      ORDER BY l.id ASC
    `,
    )
    .all() as Array<{
    id: number;
    label: string;
    size: LockerSize;
    status: LockerStatus;
  }>;

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    size: row.size,
    status: row.status,
  }));
}

function generatePickupCode(): string {
  const number = Math.floor(100000 + Math.random() * 900000);
  return number.toString();
}

function ensureUniquePickupCode(): string {
  const db = getDb();
  const check = db.prepare(
    'SELECT id FROM packages WHERE pickup_code = ? LIMIT 1',
  );
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = generatePickupCode();
    const exists = check.get(candidate);
    if (!exists) {
      return candidate;
    }
  }
  throw new Error('系统繁忙，暂时无法生成新的取件码');
}

export function assignLocker(input: AssignLockerInput) {
  const db = getDb();

  const locker = db
    .prepare(
      `
      SELECT l.id, l.label, l.size
      FROM lockers l
      WHERE l.size = @size
        AND NOT EXISTS (
          SELECT 1 FROM packages p
          WHERE p.locker_id = l.id AND p.status = 'stored'
        )
      ORDER BY l.id ASC
      LIMIT 1
    `,
    )
    .get({ size: input.size }) as
    | { id: number; label: string; size: LockerSize }
    | undefined;

  if (!locker) {
    throw new Error('该尺寸的柜格已全部使用，请选择其他尺寸');
  }

  const pickupCode = ensureUniquePickupCode();

  db.prepare(
    `
      INSERT INTO packages (
        locker_id,
        recipient_name,
        recipient_phone,
        pickup_code,
        status
      )
      VALUES (@lockerId, @recipientName, @recipientPhone, @pickupCode, 'stored')
    `,
  ).run({
    lockerId: locker.id,
    recipientName: input.recipientName ?? null,
    recipientPhone: input.recipientPhone,
    pickupCode,
  });

  return {
    locker: {
      id: locker.id as number,
      label: locker.label as string,
      size: locker.size as LockerSize,
      status: 'occupied' as LockerStatus,
    },
    pickupCode,
  };
}

export function pickupPackage(pickupCode: string) {
  const db = getDb();

  const record = db
    .prepare(
      `
      SELECT p.id, p.locker_id, l.label, l.size
      FROM packages p
      INNER JOIN lockers l ON l.id = p.locker_id
      WHERE p.pickup_code = @pickupCode
        AND p.status = 'stored'
      LIMIT 1
    `,
    )
    .get({ pickupCode }) as
    | { id: number; locker_id: number; label: string; size: LockerSize }
    | undefined;

  if (!record) {
    throw new Error('取件码不存在或已被使用');
  }

  db.prepare(
    `
      UPDATE packages
      SET status = 'picked', picked_up_at = DATETIME('now')
      WHERE id = @id
    `,
  ).run({ id: record.id });

  return {
    locker: {
      id: record.locker_id as number,
      label: record.label as string,
      size: record.size as LockerSize,
      status: 'empty' as LockerStatus,
    },
  };
}
