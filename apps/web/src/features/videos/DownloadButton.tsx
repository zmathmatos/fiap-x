import { useState } from 'react';
import { Button } from '../../components/Button';
import { downloadZip } from '../../lib/download';
import { useAuth } from '../auth/useAuth';

interface DownloadButtonProps {
  videoId: string;
  originalName: string;
  variant?: 'default' | 'primary';
  size?: 'sm' | 'md';
}

export function DownloadButton({
  videoId,
  originalName,
  variant = 'default',
  size = 'sm',
}: DownloadButtonProps): JSX.Element {
  const { token } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async (): Promise<void> => {
    if (!token) return;

    setBusy(true);
    setError(null);
    try {
      await downloadZip(videoId, token, `${originalName}-frames.zip`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Falha no download.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant={variant} size={size} loading={busy} onClick={() => void start()}>
        Baixar zip
      </Button>
      {error && (
        <span className="field__error" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
