const STATUS_CONFIG = {
  pending:              { label: 'ממתין',      dot: 'bg-amber-500',   pill: 'bg-amber-50 text-amber-700' },
  confirmed:            { label: 'מאושר',      dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700' },
  completed:            { label: 'הושלם',      dot: 'bg-blue-500',    pill: 'bg-blue-50 text-blue-700' },
  cancelled:            { label: 'בוטל',       dot: 'bg-red-500',     pill: 'bg-red-50 text-red-600' },
  reschedule_requested: { label: 'שינוי מועד', dot: 'bg-indigo-500',  pill: 'bg-indigo-50 text-indigo-700' },
};

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || { label: status, dot: 'bg-gray-400', pill: 'bg-gray-50 text-gray-600' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${config.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`} />
      {config.label}
    </span>
  );
}
