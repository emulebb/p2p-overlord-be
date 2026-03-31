import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';

declare global {
	// eslint-disable-next-line no-var
	var __overlordPrisma: PrismaClient | undefined;
	// eslint-disable-next-line no-var
	var __overlordPgPool: Pool | undefined;
}

function readDatabaseUrlFromEnvFile(): string | null {
	try {
		const contents = readFileSync(new URL('../../../.env', import.meta.url), 'utf8');
		for (const rawLine of contents.split(/\r?\n/)) {
			const line = rawLine.trim();
			if (!line || line.startsWith('#')) {
				continue;
			}

			const separatorIndex = line.indexOf('=');
			if (separatorIndex < 0) {
				continue;
			}

			const key = line.slice(0, separatorIndex).trim();
			if (key !== 'DATABASE_URL') {
				continue;
			}

			const value = line.slice(separatorIndex + 1).trim();
			return value.length > 0 ? value : null;
		}
	} catch {
		return null;
	}

	return null;
}

/**
 * Resolves the coordinator database URL, preferring the repo-local `.env` written by the
 * managed DB helper over any unrelated shell-level `DATABASE_URL`.
 */
function getDatabaseUrl(): string {
	const connectionString = readDatabaseUrlFromEnvFile() ?? process.env.DATABASE_URL?.trim();
	if (!connectionString) {
		throw new Error('DATABASE_URL is not set');
	}
	return connectionString;
}

export function getDb(): PrismaClient {
	if (!globalThis.__overlordPrisma) {
		const adapter = new PrismaPg({ connectionString: getDatabaseUrl() });
		globalThis.__overlordPrisma = new PrismaClient({ adapter });
	}
	return globalThis.__overlordPrisma;
}

export function getPgPool(): Pool {
	if (!globalThis.__overlordPgPool) {
		globalThis.__overlordPgPool = new Pool({
			connectionString: getDatabaseUrl()
		});
	}
	return globalThis.__overlordPgPool;
}
