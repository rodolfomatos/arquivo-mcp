/**
 * Validate date range parameter format.
 *
 * Accepted formats:
 *   - YYYY (4 digits)
 *   - YYYYMMDDHHMMSS (up to 14 digits, partial allowed)
 *   - Empty/undefined (allowed, means no filter)
 *
 * @param date - Date string to validate (optional)
 * @returns true if format is valid or empty; false otherwise
 *
 * Note: Does not validate date semantics (e.g., Feb 30), only digit length.
 */
export function isValidDateRange(date?: string): boolean {
  if (!date) return true; // empty is allowed (means no filter)
  // Allow YYYY or YYYYMMDDHHMMSS (at least 4 digits)
  return /^\d{4,14}$/.test(date);
}
