/**
 * Zip module: folder compression using fflate
 * Supports streaming zip creation from multiple files
 */

import { Zip, ZipDeflate, ZipPassThrough } from 'fflate';

/**
 * Create a zip Blob from File objects
 * Uses fflate's streaming API for memory efficiency
 */
export async function createZipFromFiles(
  files: File[],
  onProgress?: (bytesWritten: number) => void
): Promise<Blob> {
  const chunks: Uint8Array[] = [];
  let bytesWritten = 0;

  return new Promise((resolve, reject) => {
    const zip = new Zip((err, data, final) => {
      if (err) {
        reject(err);
        return;
      }
      if (data) {
        chunks.push(data);
        bytesWritten += data.length;
        onProgress?.(bytesWritten);
      }
      if (final) {
        const blob = new Blob(chunks as BlobPart[], { type: 'application/zip' });
        resolve(blob);
      }
    });

    // Add each file to the zip
    for (const file of files) {
      const fileStream = new ZipDeflate(file.name, { level: 6 });
      zip.add(fileStream);

      // Read file and push chunks to the zip stream
      const reader = file.stream().getReader();
      const pump = () => {
        reader.read().then(({ done, value }) => {
          if (done) {
            fileStream.push(new Uint8Array(0), true);
            return;
          }
          fileStream.push(value);
          pump();
        }).catch(reject);
      };
      pump();
    }

    zip.end();
  });
}

/**
 * Create a zip from files with custom paths (for folder structure)
 */
export async function createZipFromFilesWithPaths(
  files: Array<{ path: string; file: File }>,
  onProgress?: (bytesWritten: number) => void
): Promise<Blob> {
  const chunks: Uint8Array[] = [];
  let bytesWritten = 0;

  return new Promise((resolve, reject) => {
    const zip = new Zip((err, data, final) => {
      if (err) {
        reject(err);
        return;
      }
      if (data) {
        chunks.push(data);
        bytesWritten += data.length;
        onProgress?.(bytesWritten);
      }
      if (final) {
        const blob = new Blob(chunks as BlobPart[], { type: 'application/zip' });
        resolve(blob);
      }
    });

    for (const { path, file } of files) {
      const fileStream = new ZipDeflate(path, { level: 6 });
      zip.add(fileStream);

      const reader = file.stream().getReader();
      const pump = () => {
        reader.read().then(({ done, value }) => {
          if (done) {
            fileStream.push(new Uint8Array(0), true);
            return;
          }
          fileStream.push(value);
          pump();
        }).catch(reject);
      };
      pump();
    }

    zip.end();
  });
}

/**
 * Check if browser supports the APIs needed for zip streaming
 */
export function supportsZipStreaming(): boolean {
  return typeof ReadableStream !== 'undefined' && typeof TransformStream !== 'undefined';
}
