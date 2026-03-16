export default function ToastContainer({ toasts, onRemove }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2" style={{ direction: 'ltr' }}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium min-w-64 cursor-pointer
            ${toast.type === 'error' ? 'bg-red-500' : toast.type === 'warning' ? 'bg-yellow-500' : 'bg-green-500'}`}
          onClick={() => onRemove(toast.id)}
        >
          <span>{toast.type === 'error' ? '✕' : '✓'}</span>
          <span style={{ direction: 'rtl' }}>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
