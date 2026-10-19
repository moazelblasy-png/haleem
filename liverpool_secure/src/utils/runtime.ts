/** Runtime-safe identifiers and local calendar helpers. */
export function newRuntimeId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  const bytes = new Uint32Array(2);
  globalThis.crypto?.getRandomValues?.(bytes);
  return `${prefix}-${Date.now()}-${bytes[0]?.toString(36) || '0'}${bytes[1]?.toString(36) || '0'}`;
}

export function localDateKey(value: Date | number = new Date()): string {
  const date = typeof value === 'number' ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
