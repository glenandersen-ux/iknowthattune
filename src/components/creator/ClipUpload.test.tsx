import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClipUpload } from './ClipUpload';

class MockAudioContext {
  decodeAudioData = vi.fn(async () => ({
    duration: 10,
    getChannelData: () => new Float32Array(1000).fill(0.5),
  }) as unknown as AudioBuffer);
  close = vi.fn(async () => undefined);
}

function makeFile(name: string, type: string, sizeBytes: number): File {
  const file = new File([new Uint8Array(Math.min(sizeBytes, 16))], name, { type });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

describe('ClipUpload', () => {
  beforeEach(() => {
    vi.stubGlobal('AudioContext', MockAudioContext);
  });

  it('rejects unsupported file types', async () => {
    render(<ClipUpload challengeId="XqZ9mK" slot="track-1" onUploadComplete={vi.fn()} />);

    const input = screen.getByLabelText('Choose audio file');
    fireEvent.change(input, { target: { files: [makeFile('clip.txt', 'text/plain', 1000)] } });

    expect(await screen.findByText(/Unsupported file type/)).toBeInTheDocument();
  });

  it('rejects files over 10MB', async () => {
    render(<ClipUpload challengeId="XqZ9mK" slot="track-1" onUploadComplete={vi.fn()} />);

    const input = screen.getByLabelText('Choose audio file');
    await userEvent.upload(input, makeFile('clip.mp3', 'audio/mpeg', 11 * 1024 * 1024));

    expect(await screen.findByText(/too large/)).toBeInTheDocument();
  });

  it('shows the trim controls and DMCA checkbox after loading a valid file, gating the upload button', async () => {
    render(<ClipUpload challengeId="XqZ9mK" slot="track-1" onUploadComplete={vi.fn()} />);

    const input = screen.getByLabelText('Choose audio file');
    await userEvent.upload(input, makeFile('clip.mp3', 'audio/mpeg', 1000));

    await waitFor(() => expect(screen.getByTestId('waveform')).toBeInTheDocument());
    expect(screen.getByLabelText('Clip start')).toBeInTheDocument();
    expect(screen.getByLabelText('Clip end')).toBeInTheDocument();

    const uploadButton = screen.getByRole('button', { name: 'Upload Clip' });
    expect(uploadButton).toBeDisabled();

    await userEvent.click(screen.getByRole('checkbox'));
    expect(uploadButton).toBeEnabled();
  });

  it('caps the trim end at 30 seconds after the start', async () => {
    class LongMockAudioContext extends MockAudioContext {
      decodeAudioData = vi.fn(async () => ({
        duration: 60,
        getChannelData: () => new Float32Array(1000).fill(0.5),
      }) as unknown as AudioBuffer);
    }
    vi.stubGlobal('AudioContext', LongMockAudioContext);

    render(<ClipUpload challengeId="XqZ9mK" slot="track-1" onUploadComplete={vi.fn()} />);

    const input = screen.getByLabelText('Choose audio file');
    await userEvent.upload(input, makeFile('clip.mp3', 'audio/mpeg', 1000));

    await waitFor(() => expect(screen.getByLabelText('Clip end')).toBeInTheDocument());
    const endSlider = screen.getByLabelText('Clip end') as HTMLInputElement;
    expect(Number(endSlider.value)).toBe(30);
  });

  it('uploads the clip via presign, PUT, and confirm, then reports the resulting key', async () => {
    const onUploadComplete = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ uploadUrl: 'https://r2.example/put-url', key: 'ugc-clips/XqZ9mK/track-1.mp3' }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ key: 'ugc-clips/XqZ9mK/track-1.mp3' }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(<ClipUpload challengeId="XqZ9mK" slot="track-1" onUploadComplete={onUploadComplete} />);

    const input = screen.getByLabelText('Choose audio file');
    await userEvent.upload(input, makeFile('clip.mp3', 'audio/mpeg', 1000));

    await waitFor(() => expect(screen.getByRole('checkbox')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Upload Clip' }));

    await waitFor(() => expect(onUploadComplete).toHaveBeenCalledWith('ugc-clips/XqZ9mK/track-1.mp3'));
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/ugc/presign?challengeId=XqZ9mK&slot=track-1');
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://r2.example/put-url', expect.objectContaining({ method: 'PUT' }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/ugc/confirm', expect.objectContaining({ method: 'POST' }));

    vi.unstubAllGlobals();
  });
});
