import { ApprovalPendingError } from '@/lib/api';

/** Error text for mutations; approval parking is reported by the shell, not as an error. */
export function errorMessage(err: unknown): string | null {
  if (!err || err instanceof ApprovalPendingError) return null;
  return err instanceof Error ? err.message : 'Something went wrong';
}
