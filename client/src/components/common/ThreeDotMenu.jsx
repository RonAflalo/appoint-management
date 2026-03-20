import { useState, useEffect, useRef } from 'react';

export default function ThreeDotMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const hasItems = items && items.filter(Boolean).length > 0;
  if (!hasItems) return null;

  return (
    <div className="relative" ref={ref} onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-lg leading-none"
      >
        ⋮
      </button>
      {open && (
        <div className="absolute left-0 top-9 z-30 bg-white border border-gray-200 rounded-xl shadow-lg min-w-[160px] py-1 overflow-hidden">
          {items.map((item, i) =>
            item === null ? (
              <hr key={i} className="my-1 border-gray-100" />
            ) : (
              <button
                key={i}
                onClick={() => { setOpen(false); item.onClick(); }}
                className={`w-full text-right px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2
                  ${item.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700'}`}
              >
                {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                <span>{item.label}</span>
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
