import * as fs from 'fs';

export function directoryExistsSync(path: string, required?: boolean): boolean {
  if (!path) {
    throw new Error("Arg 'path' must not be empty");
  }

  let stats: fs.Stats;
  try {
    stats = fs.statSync(path);
  } catch (error) {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    if ((error as any)?.code === 'ENOENT') {
      if (!required) {
        return false;
      }

      throw new Error(`Directory '${path}' does not exist`);
    }

    throw new Error(
      `Encountered an error when checking whether path '${path}' exists: ${
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        (error as any)?.message ?? error
      }`
    );
  }

  if (stats.isDirectory()) {
    return true;
  } else if (!required) {
    return false;
  }

  throw new Error(`Directory '${path}' does not exist`);
}

export function fileExistsSync(path: string): boolean {
  if (!path) {
    throw new Error("Arg 'path' must not be empty");
  }

  let stats: fs.Stats;
  try {
    stats = fs.statSync(path);
  } catch (error) {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    if ((error as any)?.code === 'ENOENT') {
      return false;
    }

    throw new Error(
      `Encountered an error when checking whether path '${path}' exists: ${
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        (error as any)?.message ?? error
      }`
    );
  }

  return !stats.isDirectory();
}
