import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { DURATION } from '../../lib/motion';

interface RenameFieldProps {
  value: string;
  onSave: (title: string) => Promise<unknown>;
  className?: string;
}

/**
 * Edit-in-place for a video's name.
 *
 * A dialog would be heavier than the act deserves — renaming is a one-word
 * correction, usually done right after an upload, and the reader is already
 * looking at the name they want to change.
 */
export function RenameField({ value, onSave, className = '' }: RenameFieldProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus and select on open, so the next keystroke replaces the name instead of
  // appending to it. Done with a ref rather than `autoFocus`, which would also
  // steal focus if this ever rendered already-open on page load.
  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const open = (): void => {
    setDraft(value);
    setError(null);
    setEditing(true);
  };

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();

    const trimmed = draft.trim();
    // Nothing changed: closing without a request keeps the list from flickering
    // through a save it did not need.
    if (trimmed === value) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed);
      setEditing(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível renomear.');
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setEditing(false);
      setError(null);
    }
  };

  if (!editing) {
    return (
      <span className={`group flex items-center gap-xs min-w-0 max-w-full ${className}`}>
        <span className="truncate min-w-0" title={value}>
          {value}
        </span>
        <button
          type="button"
          onClick={open}
          aria-label={`Renomear ${value}`}
          title="Renomear"
          className="shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-secondary hover:text-primary-container transition-opacity"
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            edit
          </span>
        </button>
      </span>
    );
  }

  return (
    <form onSubmit={submit} className={`flex flex-col gap-xs min-w-0 ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={draft}
        disabled={saving}
        maxLength={200}
        aria-label="Nome do vídeo"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => !saving && setEditing(false)}
        className="w-full h-8 px-sm rounded-full border border-primary-container bg-surface-container-lowest text-body-sm text-on-surface focus:outline-none"
      />
      <AnimatePresence>
        {error && (
          <motion.span
            role="alert"
            className="text-body-sm text-error"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: DURATION.fast }}
          >
            {error}
          </motion.span>
        )}
      </AnimatePresence>
    </form>
  );
}
