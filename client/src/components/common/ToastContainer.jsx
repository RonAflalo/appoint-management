export default function ToastContainer({ toasts, onRemove }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-6 left-4 z-50 flex flex-col gap-2" style={{ direction: 'ltr' }}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          onClick={() => onRemove(toast.id)}
          className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold min-w-64 cursor-pointer backdrop-blur-sm
            ${toast.type === 'error'
              ? 'bg-red-500/95 text-white'
              : toast.type === 'warning'
                ? 'bg-amber-500/95 text-white'
                : 'bg-inverse-surface/95 text-inverse-on-surface'}`}
        >
          <span className="material-symbols-outlined text-base">
            {toast.type === 'error' ? 'error' : toast.type === 'warning' ? 'warning' : 'check_circle'}
          </span>
          <span style={{ direction: 'rtl' }}>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
