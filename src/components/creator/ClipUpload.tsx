import { useRef, useState, type ChangeEvent, type DragEvent, type JSX } from 'react';

/** Max upload size for BYOC clips (Phase 4 §4.2). */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Max trimmed clip length; matches the catalog's 30s clip ceiling (DeepDive §C.4). */
const MAX_CLIP_SECONDS = 30;

const ACCEPTED_TYPES = ['audio/mpeg', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/flac', 'audio/x-flac'];

const WAVEFORM_BARS = 100;

export interface ClipUploadProps {
  challengeId: string;
  slot: string;
  /** Called with the R2 object key once the clip has been uploaded and confirmed. */
  onUploadComplete: (clipKey: string) => void;
}

interface TrimRange {
  start: number;
  end: number;
}

function formatSeconds(value: number): string {
  return `${value.toFixed(1)}s`;
}

/** Computes per-bar peak amplitudes from the first audio channel for a static waveform display. */
function computeWaveformPeaks(buffer: AudioBuffer, bars: number): number[] {
  const channelData = buffer.getChannelData(0);
  const blockSize = Math.max(1, Math.floor(channelData.length / bars));
  const peaks: number[] = [];
  for (let i = 0; i < bars; i++) {
    let max = 0;
    for (let j = 0; j < blockSize; j++) {
      const value = Math.abs(channelData[i * blockSize + j] ?? 0);
      if (value > max) max = value;
    }
    peaks.push(max);
  }
  return peaks;
}

function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return 'Unsupported file type. Use MP3, AAC, WAV, or FLAC.';
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return 'File is too large. Maximum size is 10MB.';
  }
  return null;
}

/** BYOC clip upload with client-side trim tool and DMCA attestation (Phase 4 §4.2). */
export function ClipUpload({ challengeId, slot, onUploadComplete }: ClipUploadProps): JSX.Element {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [trim, setTrim] = useState<TrimRange>({ start: 0, end: 0 });
  const [dmcaAccepted, setDmcaAccepted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFile = async (candidate: File): Promise<void> => {
    const validationError = validateFile(candidate);
    if (validationError) {
      setError(validationError);
      return;
    }

    const arrayBuffer = await candidate.arrayBuffer();
    const ctx = new AudioContext();
    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    } finally {
      void ctx.close();
    }

    setError(null);
    setFile(candidate);
    setDuration(audioBuffer.duration);
    setWaveform(computeWaveformPeaks(audioBuffer, WAVEFORM_BARS));
    setTrim({ start: 0, end: Math.min(audioBuffer.duration, MAX_CLIP_SECONDS) });
    setDmcaAccepted(false);
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>): void => {
    const selected = event.target.files?.[0];
    if (selected) void loadFile(selected);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setIsDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped) void loadFile(dropped);
  };

  const handleTrimStartChange = (value: number): void => {
    setTrim((prev) => ({ ...prev, start: Math.min(Math.max(0, value), prev.end - 0.1) }));
  };

  const handleTrimEndChange = (value: number): void => {
    setTrim((prev) => {
      const maxEnd = Math.min(duration, prev.start + MAX_CLIP_SECONDS);
      return { ...prev, end: Math.max(Math.min(value, maxEnd), prev.start + 0.1) };
    });
  };

  const handleUpload = async (): Promise<void> => {
    if (!file || !dmcaAccepted) return;
    setIsUploading(true);
    setError(null);
    try {
      const presignResponse = await fetch(
        `/api/ugc/presign?challengeId=${encodeURIComponent(challengeId)}&slot=${encodeURIComponent(slot)}`,
      );
      if (!presignResponse.ok) throw new Error('Failed to get upload URL');
      const { uploadUrl, key } = (await presignResponse.json()) as { uploadUrl: string; key: string };

      const putResponse = await fetch(uploadUrl, { method: 'PUT', body: file });
      if (!putResponse.ok) throw new Error('Upload failed');

      const confirmResponse = await fetch('/api/ugc/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId, slot }),
      });
      if (!confirmResponse.ok) throw new Error('Failed to confirm upload');

      onUploadComplete(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-slate-800 p-4 text-white">
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center text-sm ${
          isDragging ? 'border-cyan-400 bg-slate-700' : 'border-slate-600'
        }`}
      >
        {file ? file.name : 'Drag and drop an audio file, or tap to select (MP3, AAC, WAV, FLAC, max 10MB)'}
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.aac,.wav,.flac,audio/mpeg,audio/aac,audio/wav,audio/x-wav,audio/flac,audio/x-flac"
          className="hidden"
          aria-label="Choose audio file"
          onChange={handleFileSelect}
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {file && (
        <>
          <div className="flex h-16 items-end gap-px rounded bg-slate-900 p-2" data-testid="waveform">
            {waveform.map((peak, index) => {
              const time = (index / WAVEFORM_BARS) * duration;
              const inTrim = time >= trim.start && time <= trim.end;
              return (
                <div
                  key={index}
                  className={inTrim ? 'bg-cyan-400' : 'bg-slate-600'}
                  style={{ height: `${Math.max(4, peak * 100)}%`, width: `${100 / WAVEFORM_BARS}%` }}
                />
              );
            })}
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-sm">
              <span>
                Start: {formatSeconds(trim.start)} (clip length: {formatSeconds(trim.end - trim.start)})
              </span>
              <input
                type="range"
                aria-label="Clip start"
                min={0}
                max={duration}
                step={0.1}
                value={trim.start}
                onChange={(event) => handleTrimStartChange(Number(event.target.value))}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>End: {formatSeconds(trim.end)}</span>
              <input
                type="range"
                aria-label="Clip end"
                min={0}
                max={duration}
                step={0.1}
                value={trim.end}
                onChange={(event) => handleTrimEndChange(Number(event.target.value))}
              />
            </label>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={dmcaAccepted}
              onChange={(event) => setDmcaAccepted(event.target.checked)}
            />
            <span>
              I confirm I have the rights to use this clip and understand it will be trimmed to{' '}
              {MAX_CLIP_SECONDS} seconds max.
            </span>
          </label>

          <button
            type="button"
            onClick={() => void handleUpload()}
            disabled={!dmcaAccepted || isUploading}
            className="rounded-lg bg-cyan-600 px-4 py-3 font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploading ? 'Uploading…' : 'Upload Clip'}
          </button>
        </>
      )}
    </div>
  );
}
