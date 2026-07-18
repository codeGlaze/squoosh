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
import { h, Component } from 'preact';
import { drawDataToCanvas } from 'client/lazy-app/util/canvas';
import { linkRef } from 'shared/prerendered-app/util';
import type { Options } from '../shared/meta';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Clamp a crop region to sit within the bounds of an image, rounding to whole
 * pixels and guaranteeing at least a 1×1 region.
 */
export function clampCrop(
  rect: CropRect,
  imgWidth: number,
  imgHeight: number,
): CropRect {
  const x = clamp(Math.round(rect.x), 0, imgWidth - 1);
  const y = clamp(Math.round(rect.y), 0, imgHeight - 1);
  const width = clamp(Math.round(rect.width), 1, imgWidth - x);
  const height = clamp(Math.round(rect.height), 1, imgHeight - y);
  return { x, y, width, height };
}

/** Whether a crop region covers the whole image (making it a no-op). */
export function isFullImage(
  rect: CropRect,
  imgWidth: number,
  imgHeight: number,
): boolean {
  return (
    rect.x === 0 &&
    rect.y === 0 &&
    rect.width === imgWidth &&
    rect.height === imgHeight
  );
}

/**
 * Return the region of `data` described by `options` as a new ImageData.
 * A full-image (or unset) crop returns the original data untouched.
 */
export function crop(data: ImageData, options: Options): ImageData {
  if (options.width <= 0 || options.height <= 0) return data;

  const { x, y, width, height } = clampCrop(options, data.width, data.height);
  if (isFullImage({ x, y, width, height }, data.width, data.height)) {
    return data;
  }

  const source = document.createElement('canvas');
  source.width = data.width;
  source.height = data.height;
  drawDataToCanvas(source, data);

  const dest = document.createElement('canvas');
  dest.width = width;
  dest.height = height;
  const ctx = dest.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas context');
  ctx.drawImage(source, x, y, width, height, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

type DragMode =
  | 'move'
  | 'new'
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'nw'
  | 'ne'
  | 'sw'
  | 'se';

const handles: { mode: DragMode; cursor: string; sx: number; sy: number }[] = [
  { mode: 'nw', cursor: 'nwse-resize', sx: 0, sy: 0 },
  { mode: 'n', cursor: 'ns-resize', sx: 0.5, sy: 0 },
  { mode: 'ne', cursor: 'nesw-resize', sx: 1, sy: 0 },
  { mode: 'e', cursor: 'ew-resize', sx: 1, sy: 0.5 },
  { mode: 'se', cursor: 'nwse-resize', sx: 1, sy: 1 },
  { mode: 's', cursor: 'ns-resize', sx: 0.5, sy: 1 },
  { mode: 'sw', cursor: 'nesw-resize', sx: 0, sy: 1 },
  { mode: 'w', cursor: 'ew-resize', sx: 0, sy: 0.5 },
];

interface Props {
  image: ImageData;
  initialRect?: CropRect;
  onApply(rect: CropRect): void;
  onCancel(): void;
}

interface State {
  rect: CropRect;
  containerWidth: number;
  containerHeight: number;
}

export class CropEditor extends Component<Props, State> {
  private containerEl?: HTMLElement;
  private canvas?: HTMLCanvasElement;
  private dragMode: DragMode | null = null;
  private dragStartRect: CropRect = { x: 0, y: 0, width: 0, height: 0 };
  private dragStartPointer = { x: 0, y: 0 };
  private resizeObserver?: ResizeObserver;

  constructor(props: Props) {
    super(props);
    const { width, height } = props.image;
    const initial =
      props.initialRect && props.initialRect.width > 0
        ? clampCrop(props.initialRect, width, height)
        : { x: 0, y: 0, width, height };
    this.state = {
      rect: initial,
      containerWidth: 1,
      containerHeight: 1,
    };
  }

  componentDidMount() {
    this.measure();
    if (typeof ResizeObserver !== 'undefined' && this.containerEl) {
      this.resizeObserver = new ResizeObserver(() => this.measure());
      this.resizeObserver.observe(this.containerEl);
    } else {
      window.addEventListener('resize', this.measure);
    }
    window.addEventListener('keydown', this.onKeyDown);
    this.drawCanvas();
  }

  componentDidUpdate() {
    this.drawCanvas();
  }

  componentWillUnmount() {
    if (this.resizeObserver) this.resizeObserver.disconnect();
    window.removeEventListener('resize', this.measure);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
  }

  private drawCanvas() {
    if (this.canvas) drawDataToCanvas(this.canvas, this.props.image);
  }

  private measure = () => {
    if (!this.containerEl) return;
    const rect = this.containerEl.getBoundingClientRect();
    this.setState({
      containerWidth: rect.width || 1,
      containerHeight: rect.height || 1,
    });
  };

  /**
   * Scale & offset for fitting the image within the container ("contain").
   * A margin is left around the image so the edge/corner handles never sit on
   * (or beyond) the container boundary, keeping them grabbable.
   */
  private getFit(
    width = this.state.containerWidth,
    height = this.state.containerHeight,
  ) {
    const { image } = this.props;
    const margin = 24;
    const availWidth = Math.max(1, width - margin * 2);
    const availHeight = Math.max(1, height - margin * 2);
    const scale = Math.min(
      availWidth / image.width,
      availHeight / image.height,
    );
    return {
      scale,
      offsetX: (width - image.width * scale) / 2,
      offsetY: (height - image.height * scale) / 2,
    };
  }

  private pointerToImage(clientX: number, clientY: number) {
    const rect = this.containerEl!.getBoundingClientRect();
    const { scale, offsetX, offsetY } = this.getFit(rect.width, rect.height);
    return {
      x: (clientX - rect.left - offsetX) / scale,
      y: (clientY - rect.top - offsetY) / scale,
    };
  }

  private startDrag(mode: DragMode, event: PointerEvent) {
    event.preventDefault();
    this.dragMode = mode;
    this.dragStartPointer = this.pointerToImage(event.clientX, event.clientY);

    if (mode === 'new') {
      const start = {
        x: clamp(this.dragStartPointer.x, 0, this.props.image.width),
        y: clamp(this.dragStartPointer.y, 0, this.props.image.height),
        width: 0,
        height: 0,
      };
      this.dragStartRect = start;
      this.setState({ rect: start });
    } else {
      this.dragStartRect = { ...this.state.rect };
    }

    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
  }

  private onBackgroundPointerDown = (event: PointerEvent) => {
    this.startDrag('new', event);
  };

  private onSelectionPointerDown = (event: PointerEvent) => {
    event.stopPropagation();
    this.startDrag('move', event);
  };

  private onHandlePointerDown = (mode: DragMode) => (event: PointerEvent) => {
    event.stopPropagation();
    this.startDrag(mode, event);
  };

  private onPointerMove = (event: PointerEvent) => {
    if (!this.dragMode) return;
    const { width: imgW, height: imgH } = this.props.image;
    const p = this.pointerToImage(event.clientX, event.clientY);
    const dx = p.x - this.dragStartPointer.x;
    const dy = p.y - this.dragStartPointer.y;
    const start = this.dragStartRect;
    let rect: CropRect;

    if (this.dragMode === 'move') {
      rect = {
        x: clamp(start.x + dx, 0, imgW - start.width),
        y: clamp(start.y + dy, 0, imgH - start.height),
        width: start.width,
        height: start.height,
      };
    } else if (this.dragMode === 'new') {
      const x0 = clamp(this.dragStartPointer.x, 0, imgW);
      const y0 = clamp(this.dragStartPointer.y, 0, imgH);
      const x1 = clamp(p.x, 0, imgW);
      const y1 = clamp(p.y, 0, imgH);
      rect = {
        x: Math.min(x0, x1),
        y: Math.min(y0, y1),
        width: Math.abs(x1 - x0),
        height: Math.abs(y1 - y0),
      };
    } else {
      const mode = this.dragMode;
      let left = start.x;
      let top = start.y;
      let right = start.x + start.width;
      let bottom = start.y + start.height;
      if (mode.includes('w')) left = clamp(start.x + dx, 0, right - 1);
      if (mode.includes('e')) right = clamp(right + dx, left + 1, imgW);
      if (mode.includes('n')) top = clamp(start.y + dy, 0, bottom - 1);
      if (mode.includes('s')) bottom = clamp(bottom + dy, top + 1, imgH);
      rect = { x: left, y: top, width: right - left, height: bottom - top };
    }

    this.setState({ rect });
  };

  private onPointerUp = () => {
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    const wasNew = this.dragMode === 'new';
    this.dragMode = null;

    // A stray click (or a too-tiny drag) shouldn't leave a degenerate region.
    if (wasNew && (this.state.rect.width < 1 || this.state.rect.height < 1)) {
      this.selectAll();
    }
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.props.onCancel();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.apply();
    }
  };

  private onNumberInput = (field: keyof CropRect) => (event: Event) => {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isNaN(value)) return;
    const { width: imgW, height: imgH } = this.props.image;
    // Use the updater form so several quick edits compose against fresh state
    // rather than a stale snapshot.
    this.setState((state) => {
      const rect = { ...state.rect, [field]: value };
      // Keep the region inside the image without fighting the user's typing.
      rect.x = clamp(rect.x, 0, imgW - 1);
      rect.y = clamp(rect.y, 0, imgH - 1);
      rect.width = clamp(rect.width, 1, imgW - rect.x);
      rect.height = clamp(rect.height, 1, imgH - rect.y);
      return { rect };
    });
  };

  private selectAll = () => {
    this.setState({
      rect: {
        x: 0,
        y: 0,
        width: this.props.image.width,
        height: this.props.image.height,
      },
    });
  };

  private apply = () => {
    const { width: imgW, height: imgH } = this.props.image;
    this.props.onApply(clampCrop(this.state.rect, imgW, imgH));
  };

  render(
    { image, onCancel }: Props,
    { rect, containerWidth, containerHeight }: State,
  ) {
    const { scale, offsetX, offsetY } = this.getFit(
      containerWidth,
      containerHeight,
    );
    const displayRect = {
      left: offsetX + rect.x * scale,
      top: offsetY + rect.y * scale,
      width: rect.width * scale,
      height: rect.height * scale,
    };
    const round = Math.round;

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10,
          background: '#181818',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          ref={linkRef(this, 'containerEl')}
          onPointerDown={this.onBackgroundPointerDown}
          style={{
            position: 'relative',
            flex: 1,
            overflow: 'hidden',
            touchAction: 'none',
            cursor: 'crosshair',
            userSelect: 'none',
          }}
        >
          <canvas
            ref={linkRef(this, 'canvas')}
            width={image.width}
            height={image.height}
            style={{
              position: 'absolute',
              left: `${offsetX}px`,
              top: `${offsetY}px`,
              width: `${image.width * scale}px`,
              height: `${image.height * scale}px`,
              pointerEvents: 'none',
            }}
          />
          <div
            onPointerDown={this.onSelectionPointerDown}
            style={{
              position: 'absolute',
              left: `${displayRect.left}px`,
              top: `${displayRect.top}px`,
              width: `${displayRect.width}px`,
              height: `${displayRect.height}px`,
              boxSizing: 'border-box',
              border: '1px solid #fff',
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
              cursor: 'move',
            }}
          >
            {handles.map((handle) => (
              <div
                key={handle.mode}
                onPointerDown={this.onHandlePointerDown(handle.mode)}
                style={{
                  position: 'absolute',
                  left: `${handle.sx * 100}%`,
                  top: `${handle.sy * 100}%`,
                  width: '14px',
                  height: '14px',
                  marginLeft: '-7px',
                  marginTop: '-7px',
                  background: '#fff',
                  border: '1px solid #666',
                  borderRadius: '2px',
                  cursor: handle.cursor,
                  touchAction: 'none',
                }}
              />
            ))}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            background: '#1f1f1f',
            color: '#fff',
            font: '13px/1.4 sans-serif',
          }}
        >
          {(['x', 'y', 'width', 'height'] as (keyof CropRect)[]).map(
            (field) => (
              <label
                key={field}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <span style={{ textTransform: 'uppercase' }}>
                  {field === 'width' ? 'W' : field === 'height' ? 'H' : field}
                </span>
                <input
                  type="number"
                  min={field === 'width' || field === 'height' ? 1 : 0}
                  value={round(rect[field])}
                  onInput={this.onNumberInput(field)}
                  style={{ width: '72px' }}
                />
              </label>
            ),
          )}
          <div style={{ flex: 1 }} />
          <button type="button" onClick={this.selectAll}>
            Reset
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" onClick={this.apply}>
            Apply crop
          </button>
        </div>
      </div>
    );
  }
}
