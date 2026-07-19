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
// Modernized to use @jsquash/resize — Squoosh's own rust resize + hqx as a
// maintained package. It's a superset of the old worker: it handles the
// contain fit method, premultiply/linear-RGB, and hqx internally, so the
// hand-rolled cropping/contain logic here is no longer needed. Browser and
// vector resize methods are still handled client-side. See MODERNIZATION.md.
import jsquashResize from '@jsquash/resize';
import type { WorkerResizeOptions } from '../shared/meta';

type JSquashOptions = Parameters<typeof jsquashResize>[1];

export default function resize(
  data: ImageData,
  opts: WorkerResizeOptions,
): Promise<ImageData> {
  return jsquashResize(data, opts as unknown as JSquashOptions);
}
