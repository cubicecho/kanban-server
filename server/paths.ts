import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(here, "..");
export const DATA_DIR = process.env.KANBAN_SERVER_DATA_DIR ?? path.join(ROOT, "data");
export const PORT = Number(process.env.PORT ?? 8788);

/**
 * A postgres server to connect to. Empty — the default — runs PGlite inside the process
 * against `DATA_DIR`, so a fresh clone needs no database of its own. See `db/client.ts`.
 */
export const DATABASE_URL = process.env.DATABASE_URL ?? "";

/**
 * Whether to create the database named in `DATABASE_URL` when the server does not find one.
 *
 * On by default: pointing at a shared postgres should be the one variable it looks like, not a
 * variable and a `CREATE DATABASE` somebody has to remember to run first. Set
 * `KANBAN_SERVER_CREATE_DATABASE=0` where handing out databases is the DBA's business, and the
 * server reports the missing one instead of making it.
 */
export const CREATE_DATABASE = !/^(0|false|no|off)$/i.test(
  process.env.KANBAN_SERVER_CREATE_DATABASE ?? "",
);
