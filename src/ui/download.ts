/** Saves text as a file the browser downloads; nothing leaves the device. */
export function downloadText(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoke on the next tick: some browsers start the download only after the click handler returns.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** "Zoë & Co" → "zo-co": file names keep only safe letters and digits. */
export function fileSafe(name: string): string {
  const safe = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return safe === '' ? 'student' : safe;
}
