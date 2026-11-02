import { useState, useEffect } from "react";
import { api } from "./api";
export function Presets({
  type,
  onApply,
}: {
  type: string;
  onApply: (id: string) => void;
}) {
  const [query, setQuery] = useState(""),
    [items, setItems] = useState<{ id: string; description: string }[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const timer = setTimeout(
      () =>
        api<typeof items>(
          `/presets?type=${encodeURIComponent(type)}&q=${encodeURIComponent(query)}`,
        )
          .then((v) => {
            if (live) setItems(v);
          })
          .catch((e) => {
            if (live) setError(e.message);
          }),
      150,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [type, query]);
  return (
    <>
      <p>
        Pinned component database · {type}. Applying a template changes the
        selected real component and is undoable.
      </p>
      <input
        aria-label="Search component templates"
        className="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter manufacturer or part…"
      />
      <div className="example-list">
        {items.map((p) => (
          <button key={p.id} onClick={() => onApply(p.id)}>
            {p.description}
          </button>
        ))}
      </div>
      {error && <p className="error-inline">{error}</p>}
    </>
  );
}
