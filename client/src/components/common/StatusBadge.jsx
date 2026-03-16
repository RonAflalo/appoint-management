const STATUS_CONFIG = {
  pending: { label: 'ממתין', className: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: 'מאושר', className: 'bg-green-100 text-green-800' },
  completed: { label: 'הושלם', className: 'bg-blue-100 text-blue-800' },
  cancelled: { label: 'בוטל', className: 'bg-red-100 text-red-800' },
  reschedule_requested: { label: 'שינוי מועד', className: 'bg-orange-100 text-orange-800' },
};

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
