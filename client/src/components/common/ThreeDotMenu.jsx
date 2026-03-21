import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function ThreeDotMenu({ items }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const hasItems = items && items.filter(Boolean).length > 0;
  if (!hasItems) return null;

  const handleOpen = (e) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(v => !v);
  };

  const dropdown = open ? (
    <div
      ref={menuRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
      className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-xl min-w-[168px] py-1.5 overflow-hidden"
      onClick={e => e.stopPropagation()}
    >
      {items.map((item, i) =>
        item === null ? (
          <hr key={i} className="my-1 border-surface-container" />
        ) : (
          <button
            key={i}
            onClick={() => { setOpen(false); item.onClick(); }}
            className={`w-full text-right px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-2
              ${item.danger ? 'text-error hover:bg-red-50' : 'text-on-surface hover:bg-surface-container-low'}`}
          >
            {item.icon && <span className="flex-shrink-0 text-base">{item.icon}</span>}
            <span>{item.label}</span>
          </button>
        )
      )}
    </div>
  ) : null;

  return (
    <div onClick={e => e.stopPropagation()}>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-xl transition-colors"
      >
        <span className="material-symbols-outlined text-xl">more_vert</span>
      </button>
      {createPortal(dropdown, document.body)}
    </div>
  );
}
