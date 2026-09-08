import { useRef, useState, type DragEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '../../components/Button';
import { DURATION, SPRING } from '../../lib/motion';

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
      <motion.div
        data-testid="dropzone"
        // The surface lifts and the accent comes up under it while a file is over
        // it — the feedback that says "let go here" without a word of copy.
        animate={{
          scale: dragging ? 1.01 : 1,
          borderColor: dragging ? 'rgb(var(--primary))' : 'rgb(var(--outline-variant))',
          backgroundColor: dragging
            ? 'rgb(var(--primary) / 0.06)'
            : 'rgb(var(--surface-container-lowest))',
        }}
        transition={SPRING.soft}
        className="border-2 border-dashed rounded-4xl p-lg sm:p-xl flex flex-col items-center justify-center text-center"
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <motion.span
          className="material-symbols-outlined text-[32px] text-secondary mb-sm"
          aria-hidden="true"
          animate={{ y: dragging ? -4 : 0, color: dragging ? 'rgb(var(--primary))' : undefined }}
          transition={SPRING.soft}
        >
          cloud_upload
        </motion.span>

        <p className="text-body-lg text-on-surface mb-sm">Arraste seus vídeos para cá</p>
        <p className="text-body-sm text-secondary mb-lg">
          {ACCEPTED_EXTENSIONS.join(', ')} · até 500 MB por arquivo · vários de uma vez
        </p>

        <motion.div
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          transition={SPRING.snappy}
        >
          <Button variant="primary" disabled={disabled} onClick={() => inputRef.current?.click()}>
            Escolher arquivos
          </Button>
        </motion.div>

        {/* The input stays reachable by keyboard and screen readers; the drag
            surface is only a convenience on top of it. */}
        <label className="sr-only" htmlFor="upload-input">
          Selecionar arquivos
        </label>
        <input
          id="upload-input"
          ref={inputRef}
          className="sr-only"
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          disabled={disabled}
          onChange={(event) => {
            handle(event.target.files);
            event.target.value = '';
          }}
        />
      </motion.div>

      <AnimatePresence>
        {rejected.length > 0 && (
          <motion.p
            className="mt-sm px-md py-sm rounded-xl bg-error-container text-on-error-container text-body-sm overflow-hidden"
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: DURATION.base }}
          >
            {rejected.map((name) => `Formato não suportado: ${name}`).join(' · ')}
          </motion.p>
        )}
      </AnimatePresence>
    </>
  );
}
