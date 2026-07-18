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

export interface Options {
  enabled: boolean;
  /** Left offset of the crop region, in source pixels. */
  x: number;
  /** Top offset of the crop region, in source pixels. */
  y: number;
  /** Width of the crop region, in source pixels. */
  width: number;
  /** Height of the crop region, in source pixels. */
  height: number;
}

export const defaultOptions: Options = {
  enabled: false,
  x: 0,
  y: 0,
  // Zero width/height means "not yet set"; the crop is a no-op until the user
  // draws a region. The actual defaults track the source image size.
  width: 0,
  height: 0,
};
