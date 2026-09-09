import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, desc } from 'drizzle-orm';
import * as schema from './schema.ts';

// Add global connection pool caching to persist across hot-reloads
declare global {
  var _postgresPool: Pool | undefined;
}

export const getPool = (): Pool | null => {
  if (!process.env.SQL_HOST || !process.env.SQL_USER) {
    return null;
  }

  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15000,
    });

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }

  return global._postgresPool;
};

export const getDb = () => {
  const pool = getPool();
  if (!pool) return null;
  return drizzle(pool, { schema });
};

// 1. Get or Create User
export async function getOrCreateUser(uid: string, email: string, displayName?: string) {
  const db = getDb();
  if (!db) return null;

  try {
    const result = await db
      .insert(schema.users)
      .values({
        uid,
        email,
        displayName: displayName || null,
      })
      .onConflictDoUpdate({
        target: schema.users.uid,
        set: {
          email,
          displayName: displayName || null,
        },
      })
      .returning();

    return result[0] || null;
  } catch (error) {
    console.error('Database getOrCreateUser failed:', error);
    throw new Error('Database query failed: ' + String(error));
  }
}

// 2. Log Repair Action
export async function logRepairAction(
  uid: string,
  toolId: string,
  toolName: string,
  status: string,
  durationMs?: number,
  details?: string
) {
  const db = getDb();
  if (!db) return null;

  try {
    // Find user record ID
    const userList = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.uid, uid))
      .limit(1);

    const user = userList[0] || (await getOrCreateUser(uid, `${uid}@nexus.local`));
    if (!user) throw new Error('User record could not be established');

    const result = await db
      .insert(schema.repairLogs)
      .values({
        userId: user.id,
        toolId,
        toolName,
        status,
        durationMs: durationMs || 0,
        details: details || null,
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database logRepairAction failed:', error);
    throw new Error('Database query failed: ' + String(error));
  }
}

// 3. Fetch Repair Logs for User
export async function getRepairLogs(uid: string, limit = 20) {
  const db = getDb();
  if (!db) return [];

  try {
    const userList = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.uid, uid))
      .limit(1);

    const user = userList[0];
    if (!user) return [];

    return await db
      .select()
      .from(schema.repairLogs)
      .where(eq(schema.repairLogs.userId, user.id))
      .orderBy(desc(schema.repairLogs.createdAt))
      .limit(limit);
  } catch (error) {
    console.error('Database getRepairLogs failed:', error);
    throw new Error('Database query failed: ' + String(error));
  }
}

// 4. Record System Telemetry
export async function recordSystemTelemetry(
  uid: string,
  cpuLoad: number,
  ramUsedGb: string,
  diskFreeGb: string,
  osVersion: string
) {
  const db = getDb();
  if (!db) return null;

  try {
    const userList = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.uid, uid))
      .limit(1);

    const user = userList[0] || (await getOrCreateUser(uid, `${uid}@nexus.local`));
    if (!user) return null;

    const result = await db
      .insert(schema.systemTelemetry)
      .values({
        userId: user.id,
        cpuLoad,
        ramUsedGb,
        diskFreeGb,
        osVersion,
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database recordSystemTelemetry failed:', error);
    throw new Error('Database query failed: ' + String(error));
  }
}

// 5. Record Workspace Integration Activity
export async function recordWorkspaceIntegrationEvent(
  uid: string,
  service: string,
  resourceName: string,
  action: string,
  resourceId?: string,
  resourceUrl?: string
) {
  const db = getDb();
  if (!db) return null;

  try {
    const userList = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.uid, uid))
      .limit(1);

    const user = userList[0] || (await getOrCreateUser(uid, `${uid}@nexus.local`));
    if (!user) return null;

    const result = await db
      .insert(schema.workspaceIntegrations)
      .values({
        userId: user.id,
        service,
        resourceName,
        action,
        resourceId: resourceId || null,
        resourceUrl: resourceUrl || null,
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database recordWorkspaceIntegrationEvent failed:', error);
    throw new Error('Database query failed: ' + String(error));
  }
}

// 6. Get Workspace Integration Events
export async function getWorkspaceIntegrationEvents(uid: string, limit = 25) {
  const db = getDb();
  if (!db) return [];

  try {
    const userList = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.uid, uid))
      .limit(1);

    const user = userList[0];
    if (!user) return [];

    return await db
      .select()
      .from(schema.workspaceIntegrations)
      .where(eq(schema.workspaceIntegrations.userId, user.id))
      .orderBy(desc(schema.workspaceIntegrations.createdAt))
      .limit(limit);
  } catch (error) {
    console.error('Database getWorkspaceIntegrationEvents failed:', error);
    throw new Error('Database query failed: ' + String(error));
  }
}
