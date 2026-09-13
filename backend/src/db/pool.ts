import pg from "pg";

const { Pool, types } = pg;

// Return DATE columns as plain 'YYYY-MM-DD' strings instead of JS Date
// objects — the app never needs a time component and this avoids any
// timezone-shift surprises when converting back and forth.
types.setTypeParser(1082 /* DATE oid */, (val) => val);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

export const pool = new Pool({ connectionString });
