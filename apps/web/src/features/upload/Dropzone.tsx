import { useRef, useState, type DragEvent } from 'react';
import { Button } from '../../components/Button';

export const ACCEPTED_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.map((ext) => `.${ext}`).join(',');

export function isAccepted(fileName: string): boolean {
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 && ACCEPTED_EXTENSIONS.includes(parts.at(-1) ?? '');
}

interface DropzoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

export function Dropzone({ onFiles, disabled = false }: DropzoneProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);

  const handle = (files: FileList | null): void => {
    if (!files) return;

    const list = Array.from(files);
    const accepted = list.filter((file) => isAccepted(file.name));
    const refused = list.filter((file) => !isAccepted(file.name)).map((file) => file.name);

    setRejected(refused);
    if (accepted.length > 0) onFiles(accepted);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setDragging(false);
    if (!disabled) handle(event.dataTransfer.files);
  };

  return (
    <>
      <div
        className={`dropzone ${dragging ? 'dropzone--active' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <p className="dropzone__title">Arraste seus vídeos para cá</p>
        <p className="dropzone__hint">
          {ACCEPTED_EXTENSIONS.join(', ')} · até 500 MB por arquivo · vários de uma vez
        </p>
        <div className="dropzone__actions">
          <Button variant="primary" disabled={disabled} onClick={() => inputRef.current?.click()}>
            Escolher arquivos
          </Button>
        </div>

        {/* The input stays reachable by keyboard and screen readers; the drag
            surface is only a convenience on top of it. */}
        <label className="visually-hidden" htmlFor="upload-input">
          Selecionar arquivos
        </label>
        <input
          id="upload-input"
          ref={inputRef}
          className="visually-hidden"
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          disabled={disabled}
          onChange={(event) => {
            handle(event.target.files);
            event.target.value = '';
          }}
        />
      </div>

      {rejected.length > 0 && (
        <p className="alert" role="alert" style={{ marginTop: 'var(--space-3)' }}>
          {rejected.map((name) => `Formato não suportado: ${name}`).join(' · ')}
        </p>
      )}
    </>
  );
}
