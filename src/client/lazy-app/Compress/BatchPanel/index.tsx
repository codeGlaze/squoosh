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
import { h, Component, Fragment } from 'preact';
import type { FileResult } from '../batch-runner';

interface Props {
  results: FileResult[];
  running: boolean;
  suffix: string;
  onSuffixChange(value: string): void;
  onCancel(): void;
  onRetry(): void;
  onDownloadZip(): void;
  onClose(): void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} kB`;
}

const statusColor: Record<FileResult['status'], string> = {
  queued: '#999',
  processing: '#4fc3f7',
  done: '#66bb6a',
  error: '#ef5350',
  cancelled: '#999',
};

function StatusCell({ result }: { result: FileResult }) {
  const color = statusColor[result.status];

  if (result.status === 'done' && result.outputSize !== undefined) {
    const saving = 1 - result.outputSize / result.file.size;
    const savingPct = Math.round(saving * 100);
    return (
      <span style={{ color, whiteSpace: 'nowrap' }}>
        {formatBytes(result.file.size)} → {formatBytes(result.outputSize)}{' '}
        <strong>
          {savingPct >= 0 ? '−' : '+'}
          {Math.abs(savingPct)}%
        </strong>
      </span>
    );
  }

  const label =
    result.status === 'queued'
      ? 'Queued'
      : result.status === 'processing'
      ? 'Compressing…'
      : result.status === 'error'
      ? 'Failed'
      : 'Cancelled';

  return (
    <span
      style={{ color, whiteSpace: 'nowrap' }}
      title={result.error ? result.error.message : undefined}
    >
      {label}
    </span>
  );
}

export default class BatchPanel extends Component<Props> {
  render({
    results,
    running,
    suffix,
    onSuffixChange,
    onCancel,
    onRetry,
    onDownloadZip,
    onClose,
  }: Props) {
    const total = results.length;
    const done = results.filter((r) => r.status === 'done').length;
    const failed = results.filter(
      (r) => r.status === 'error' || r.status === 'cancelled',
    ).length;
    const settled = done + failed;
    const progress = total ? settled / total : 0;

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10,
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          font: '14px/1.4 sans-serif',
        }}
        onClick={running ? undefined : onClose}
      >
        <div
          onClick={(e: Event) => e.stopPropagation()}
          style={{
            width: 'min(560px, 92vw)',
            maxHeight: '82vh',
            display: 'flex',
            flexDirection: 'column',
            background: '#1f1f1f',
            color: '#fff',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderBottom: '1px solid #333',
            }}
          >
            <strong style={{ fontSize: '15px' }}>Compress all images</strong>
            <button
              type="button"
              onClick={onClose}
              title="Close"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '20px',
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          <div style={{ padding: '12px 16px', borderBottom: '1px solid #333' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '6px',
              }}
            >
              <span>
                {done} / {total} done
                {failed > 0 && (
                  <span style={{ color: statusColor.error }}>
                    {' '}
                    · {failed} failed
                  </span>
                )}
              </span>
              {running && <span style={{ color: '#999' }}>Working…</span>}
            </div>
            <div
              style={{
                height: '6px',
                borderRadius: '3px',
                background: '#333',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.round(progress * 100)}%`,
                  height: '100%',
                  background: failed > 0 ? '#ef9a9a' : '#66bb6a',
                  transition: 'width 150ms ease',
                }}
              />
            </div>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {results.map((result, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '8px 16px',
                  borderBottom: '1px solid #2a2a2a',
                }}
              >
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={result.file.name}
                >
                  {result.file.name}
                </span>
                <StatusCell result={result} />
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              gap: '8px',
              justifyContent: 'flex-end',
              padding: '12px 16px',
              borderTop: '1px solid #333',
            }}
          >
            {running ? (
              <button type="button" onClick={onCancel}>
                Cancel
              </button>
            ) : (
              <Fragment>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginRight: 'auto',
                    color: '#bbb',
                  }}
                  title="Added to each filename before the extension"
                >
                  Suffix:
                  <input
                    type="text"
                    value={suffix}
                    placeholder="-min"
                    onInput={(e: Event) =>
                      onSuffixChange((e.target as HTMLInputElement).value)
                    }
                    style={{ width: '96px' }}
                  />
                </label>
                {failed > 0 && (
                  <button type="button" onClick={onRetry}>
                    Retry failed ({failed})
                  </button>
                )}
                <button
                  type="button"
                  onClick={onDownloadZip}
                  disabled={done === 0}
                >
                  Download .zip ({done})
                </button>
              </Fragment>
            )}
          </div>
        </div>
      </div>
    );
  }
}
