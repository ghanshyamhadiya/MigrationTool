import pool from "./db.js";

export async function insertConversionLog({
  userId,
  provider,
  targetFileName,
  outputFileName,
  inputTokens,
  cachedTokens,
  outputTokens,
  totalTokens,
  timeTakenMs,
  status,
  errorMessage,
}) {
  await pool.query(
    `INSERT INTO conversion_log (
      user_id,
      provider,
      target_file_name,
      output_file_name,
      input_tokens,
      cached_tokens,
      output_tokens,
      total_tokens,
      time_taken_ms,
      status,
      error_message
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      userId ?? null,
      provider ?? null,
      targetFileName,
      outputFileName,
      inputTokens ?? null,
      cachedTokens ?? 0,
      outputTokens ?? null,
      totalTokens ?? null,
      timeTakenMs ?? null,
      status || "success",
      errorMessage ?? null,
    ],
  );
}
