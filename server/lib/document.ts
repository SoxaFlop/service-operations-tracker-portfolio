export function parseStoredDocument(raw: string | null | undefined) {
  if (!raw) return null;
  const [filename, dataUri] = raw.split('$$$');
  if (!filename || !dataUri?.startsWith('data:')) return null;
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { filename, contentType: match[1], content: Buffer.from(match[2], 'base64') };
}
