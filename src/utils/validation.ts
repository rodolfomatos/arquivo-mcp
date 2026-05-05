/**
 * Validate date range parameters.
 * Accepts: YYYY or YYYYMMDDHHMMSS (partial)
 */
export function isValidDateRange(date?: string): boolean {
  if (!date) return true; // empty is allowed (means no filter)
  // Allow YYYY or YYYYMMDDHHMMSS (at least 4 digits)
  return /^\d{4,14}$/.test(date);
}
