import { open, save, confirm } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

const jsonFilter = [{ name: 'JSON', extensions: ['json'] }];

export function confirmNativeAction(message) {
  return confirm(message, { title: 'Date Lotto Generator', kind: 'warning' });
}

export async function saveNativeBackup(content, defaultName, title) {
  const path = await save({ title, defaultPath: defaultName, filters: jsonFilter });
  if (path === null) return null;
  // The dialog dynamically grants the chosen path to the filesystem plugin.
  if (typeof path !== 'string' || !/\.json$/i.test(path)) throw new Error('invalid backup extension');
  await writeTextFile(path, content);
  return path;
}

export async function openNativeBackup(lastPath, title) {
  const path = await open({
    title,
    ...(lastPath ? { defaultPath: lastPath } : {}),
    multiple: false,
    directory: false,
    filters: jsonFilter
  });
  if (path === null) return null;
  if (typeof path !== 'string' || !/\.json$/i.test(path)) throw new Error('invalid backup extension');
  return { path, text: await readTextFile(path) };
}
