/**
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { downloadZip } from 'client-zip';

/** Insert `suffix` before the extension, e.g. ("photo.jpg", "-min") → "photo-min.jpg". */
export function suffixName(name: string, suffix: string): string {
  const clean = suffix.replace(/[\\/:*?"<>|]/g, '');
  if (!clean) return name;
  const dot = name.lastIndexOf('.');
  if (dot === -1) return name + clean;
  return name.slice(0, dot) + clean + name.slice(dot);
}

/** Append `-N` before the extension to make `name` unique within `used`. */
function dedupeName(name: string, used: Set<string>): string {
  if (!used.has(name)) return name;
  const dot = name.lastIndexOf('.');
  const base = dot === -1 ? name : name.slice(0, dot);
  const ext = dot === -1 ? '' : name.slice(dot);
  let i = 1;
  while (used.has(`${base}-${i}${ext}`)) i++;
  return `${base}-${i}${ext}`;
}

/**
 * Bundle encoded files into a single zip Blob. Uses client-zip, which stores
 * entries without compression — correct here, since the payloads are already
 * compressed images, so a deflate pass would just waste CPU and memory.
 * Duplicate filenames are disambiguated with a numeric suffix.
 */
export async function zipFiles(files: File[], suffix = ''): Promise<Blob> {
  const used = new Set<string>();
  const entries = files.map((file) => {
    const name = dedupeName(suffixName(file.name, suffix), used);
    used.add(name);
    return { name, input: file, lastModified: new Date(file.lastModified) };
  });
  return downloadZip(entries).blob();
}

/** Trigger a browser download of `blob` as `filename`. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // Revoke on the next tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
