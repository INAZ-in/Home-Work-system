import { pool } from "../db/pool.js";
import type { HomeworkFileMeta } from "../types/schedule.js";

// Files live as bytea rows in Postgres (see migration 006) — there's no
// filesystem quota backstopping this, so cap the combined size of every
// homework_files row across the whole app. Once a new upload would push the
// total past this, uploads are refused until something is deleted.
export const MAX_TOTAL_STORAGE_BYTES = 2 * 1024 * 1024 * 1024;

export interface StorageUsage {
  usedBytes: number;
  totalBytes: number;
  fileCount: number;
}

/** Current combined size of every uploaded homework file, app-wide — backs both the upload-time quota check and the admin storage-usage panel. */
export async function getStorageUsage(): Promise<StorageUsage> {
  const { rows } = await pool.query<{ used: string; count: string }>(
    "SELECT COALESCE(SUM(size_bytes), 0)::bigint AS used, COUNT(*)::bigint AS count FROM homework_files",
  );
  return {
    usedBytes: Number(rows[0].used),
    totalBytes: MAX_TOTAL_STORAGE_BYTES,
    fileCount: Number(rows[0].count),
  };
}

interface FileRow {
  id: number;
  homework_item_id: number;
  filename: string;
  content_type: string;
  size_bytes: number;
  uploaded_at: string;
  uploaded_by_name: string | null;
}

/** File metadata (never the bytes) for a batch of homework items, grouped by homework_item_id. */
export async function filesByHomeworkId(homeworkItemIds: number[]): Promise<Map<number, HomeworkFileMeta[]>> {
  const map = new Map<number, HomeworkFileMeta[]>();
  if (homeworkItemIds.length === 0) return map;

  const { rows } = await pool.query<FileRow>(
    `SELECT hf.id, hf.homework_item_id, hf.filename, hf.content_type, hf.size_bytes, hf.uploaded_at,
            u.name AS uploaded_by_name
     FROM homework_files hf
     LEFT JOIN users u ON u.id = hf.uploaded_by
     WHERE hf.homework_item_id = ANY($1::int[])
     ORDER BY hf.uploaded_at`,
    [homeworkItemIds],
  );
  for (const row of rows) {
    const list = map.get(row.homework_item_id) ?? [];
    list.push({
      id: row.id,
      filename: row.filename,
      contentType: row.content_type,
      sizeBytes: row.size_bytes,
      uploadedAt: row.uploaded_at,
      uploadedBy: row.uploaded_by_name,
    });
    map.set(row.homework_item_id, list);
  }
  return map;
}
