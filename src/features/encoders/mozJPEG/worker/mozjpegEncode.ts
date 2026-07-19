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
import jpegEncode from '@jsquash/jpeg/encode';
import { EncodeOptions } from '../shared/meta';

// jSquash's MozJPEG is the very codec Squoosh built, extracted into a
// maintained package (see MODERNIZATION.md). It exposes the same
// encode(ImageData, options) => Promise<ArrayBuffer> contract and loads its
// wasm via `new URL(..., import.meta.url)`, which our importMetaAssets Rollup
// plugin already emits — so this drops in where the local Emscripten build was.
type JSquashOptions = Parameters<typeof jpegEncode>[1];

export default function encode(
  data: ImageData,
  options: EncodeOptions,
): Promise<ArrayBuffer> {
  // Our EncodeOptions and jSquash's are structurally identical (both come from
  // Squoosh); bridge the nominally-distinct types at this adapter boundary.
  return jpegEncode(data, options as unknown as JSquashOptions);
}
