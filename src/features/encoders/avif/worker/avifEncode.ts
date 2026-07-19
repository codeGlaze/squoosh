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
// Modernized to use @jsquash/avif — Squoosh's own libavif codec as a maintained
// package. See MODERNIZATION.md.
import avifEncode from '@jsquash/avif/encode';
import { EncodeOptions } from '../shared/meta';

export default function encode(
  data: ImageData,
  options: EncodeOptions,
): Promise<ArrayBuffer> {
  // avif's encode is overloaded (8- vs 16-bit); cast at the adapter boundary.
  return avifEncode(data, options as any);
}
