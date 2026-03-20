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
      className="bg-white border border-gray-200 rounded-xl shadow-lg min-w-[160px] py-1 overflow-hidden"
      onClick={e => e.stopPropagation()}
    >
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
  ) : null;

  return (
    <div onClick={e => e.stopPropagation()}>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <span className="flex flex-col items-center gap-[3px]">
          <span className="block w-[4px] h-[4px] rounded-full bg-current" />
          <span className="block w-[4px] h-[4px] rounded-full bg-current" />
          <span className="block w-[4px] h-[4px] rounded-full bg-current" />
        </span>
      </button>
      {createPortal(dropdown, document.body)}
    </div>
  );
}
