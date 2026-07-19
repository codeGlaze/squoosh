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
// Modernized to use @jsquash/oxipng — Squoosh's own OxiPNG as a maintained
// package. Its optimise() takes raw ImageData (encoding + optimising in one
// step, like the native module) and the same { level, interlace } options, and
// picks the threaded/single build internally. See MODERNIZATION.md.
import optimise from '@jsquash/oxipng/optimise';
import { EncodeOptions } from '../shared/meta';

type JSquashOptions = Parameters<typeof optimise>[1];

export default function encode(
  data: ImageData,
  options: EncodeOptions,
): Promise<ArrayBuffer> {
  return optimise(data, options as unknown as JSquashOptions);
}
