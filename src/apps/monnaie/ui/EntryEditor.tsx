"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { AccountNames, Categories, Entry } from "../money";
import { EntryDialog } from "./EntryDialog";

const EditContext = createContext<((id: string) => void) | null>(null);

/** Lets the charts open any of `entries` in the edit dialog (see useEditEntry). */
export function EntryEditor({ entries, categories, names, children }: { entries: Entry[]; categories: Categories; names: AccountNames; children: ReactNode }) {
  const [id, setId] = useState<string | null>(null);
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const entry = id ? byId.get(id) : undefined;
  return (
    <EditContext value={setId}>
      {children}
      {entry && (
        <EntryDialog
          key={entry.id}
          entry={entry}
          categories={categories}
          names={names}
          defaultDate={entry.date}
          sameLabel={entries.filter((e) => e.label === entry.label).length}
          startOpen
          onClose={() => setId(null)}
        />
      )}
    </EditContext>
  );
}

/** Opens a line in the edit dialog, or null outside an EntryEditor. */
export const useEditEntry = () => useContext(EditContext);
