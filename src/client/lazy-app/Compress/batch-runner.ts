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

/**
 * Runs the image pipeline over many files with one shared set of settings.
 *
 * Concurrency is bounded at the *worker-pool* level: we hold a fixed number of
 * WorkerBridge instances and keep exactly that many images in flight, one per
 * bridge. Since each WorkerBridge serialises its own jobs, one in-flight image
 * per bridge is real parallelism with a hard ceiling on simultaneous WASM codec
 * instances — the ceiling is what prevents out-of-memory on large batches. We
 * never Promise.all the whole list.
 *
 * Failures are isolated per file and surfaced (never silently dropped): one bad
 * image becomes an `error` entry and the rest of the batch continues.
 */
import WorkerBridge from '../worker-bridge';
import { processOneImage, ProcessInput } from './pipeline';

export type FileStatus =
  | 'queued'
  | 'processing'
  | 'done'
  | 'error'
  | 'cancelled';

export interface FileResult {
  file: File;
  status: FileStatus;
  /** The encoded output, present when status === 'done'. */
  result?: File;
  /** Byte size of the encoded output, present when status === 'done'. */
  outputSize?: number;
  /** The failure, present when status === 'error'. */
  error?: Error;
}

/**
 * A conservative default: one fewer than the CPU count so the UI thread stays
 * responsive, capped at 3 because each in-flight image holds a decoded bitmap
 * plus a live WASM codec instance, and too many at once risks OOM.
 */
export function defaultConcurrency(): number {
  const cores = navigator.hardwareConcurrency || 4;
  return Math.min(Math.max(cores - 1, 1), 3);
}

const MB = 1024 * 1024;

/**
 * Size-aware backoff. A file's decoded RGBA bitmap is far larger than its
 * compressed bytes (a few MB of JPEG can decode to hundreds of MB), so with big
 * inputs present we run fewer in parallel — down to 1 — to keep peak memory
 * bounded. `file.size` is a coarse proxy for decoded size, but a safe one.
 */
function concurrencyForFiles(files: File[], cap: number): number {
  const maxSize = files.reduce((max, f) => Math.max(max, f.size), 0);
  if (maxSize > 6 * MB) return 1;
  if (maxSize > 3 * MB) return Math.min(2, cap);
  return cap;
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

export class BatchRunner {
  readonly concurrency: number;
  private readonly bridges: WorkerBridge[];
  private abortController?: AbortController;

  constructor(concurrency: number = defaultConcurrency()) {
    this.concurrency = Math.max(1, Math.floor(concurrency));
    this.bridges = Array.from(
      { length: this.concurrency },
      () => new WorkerBridge(),
    );
  }

  /** Abort an in-progress run. In-flight images are marked 'cancelled'. */
  cancel(): void {
    this.abortController?.abort();
  }

  /**
   * Terminate the worker pool, reclaiming WASM memory immediately rather than
   * waiting for each worker's idle timeout. Call once the batch is finished.
   */
  dispose(): void {
    for (const bridge of this.bridges) bridge.terminate();
  }

  /**
   * Process every file with `settings`. `onProgress` receives a fresh snapshot
   * of the results array on every state change, so a UI can render live status.
   * Resolves with the final results once the batch settles.
   */
  async run(
    files: File[],
    settings: ProcessInput,
    onProgress?: (results: FileResult[]) => void,
  ): Promise<FileResult[]> {
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    const results: FileResult[] = files.map((file) => ({
      file,
      status: 'queued',
    }));
    const emit = () => onProgress?.(results.slice());
    emit();

    let nextIndex = 0;

    // Each bridge pulls the next queued file, processes it, then pulls again —
    // so at most `concurrency` images are ever decoding/encoding at once.
    const workerLoop = async (bridge: WorkerBridge): Promise<void> => {
      while (true) {
        if (signal.aborted) return;
        const index = nextIndex++;
        if (index >= files.length) return;

        results[index] = { file: files[index], status: 'processing' };
        emit();

        try {
          const output = await processOneImage(
            signal,
            files[index],
            settings,
            bridge,
          );
          results[index] = {
            file: files[index],
            status: 'done',
            result: output,
            outputSize: output.size,
          };
        } catch (err) {
          if (isAbortError(err)) {
            results[index] = { file: files[index], status: 'cancelled' };
            emit();
            return;
          }
          // Isolate the failure: record it and keep going with the next file.
          results[index] = {
            file: files[index],
            status: 'error',
            error: err instanceof Error ? err : new Error(String(err)),
          };
        }
        emit();
      }
    };

    // Use fewer bridges when the inputs are large (unused bridges never spawn
    // a worker). At least one always runs.
    const active = Math.max(1, concurrencyForFiles(files, this.bridges.length));
    await Promise.all(
      this.bridges.slice(0, active).map((bridge) => workerLoop(bridge)),
    );

    // Any file still 'processing' when we exit was interrupted by a cancel.
    if (signal.aborted) {
      for (let i = 0; i < results.length; i++) {
        if (
          results[i].status === 'processing' ||
          results[i].status === 'queued'
        ) {
          results[i] = { file: results[i].file, status: 'cancelled' };
        }
      }
      emit();
    }

    return results;
  }
}
