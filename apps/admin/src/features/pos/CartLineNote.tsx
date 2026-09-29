import { useState } from 'react';
import { CART_NOTE_MAX_LENGTH } from './cartStore';

interface CartLineNoteProps {
  notes?: string;
  onSave: (notes: string) => void;
}

export function CartLineNote({ notes, onSave }: CartLineNoteProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes ?? '');

  if (!editing) {
    return notes ? (
      <button
        type="button"
        onClick={() => {
          setDraft(notes);
          setEditing(true);
        }}
        className="mt-1 block w-full truncate text-left text-xs italic text-brand-primary/90"
        title="Edit note"
      >
        Note: {notes}
      </button>
    ) : (
      <button
        type="button"
        onClick={() => {
          setDraft('');
          setEditing(true);
        }}
        className="mt-1 text-xs text-text-muted underline-offset-2 hover:text-brand-primary hover:underline"
      >
        + Add note
      </button>
    );
  }

  const save = () => {
    onSave(draft);
    setEditing(false);
  };

  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        autoFocus
        value={draft}
        maxLength={CART_NOTE_MAX_LENGTH}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') setEditing(false);
        }}
        placeholder="e.g. no onion, extra spicy"
        className="min-w-0 flex-1 rounded-lg border border-white/10 bg-bg-primary px-2 py-1.5 text-xs outline-none focus:border-brand-primary"
      />
      <button
        type="button"
        onClick={save}
        className="shrink-0 rounded-lg bg-brand-primary/20 px-2 py-1.5 text-xs font-semibold text-brand-primary"
      >
        Save
      </button>
    </div>
  );
}
