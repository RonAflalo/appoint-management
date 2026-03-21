export default function LoadingSpinner({ size = 'md' }) {
  const sizeClasses = { sm: 'h-5 w-5 border-2', md: 'h-9 w-9 border-[3px]', lg: 'h-14 w-14 border-4' };
  return (
    <div className="flex items-center justify-center py-10">
      <div className={`animate-spin rounded-full border-primary-fixed border-t-primary ${sizeClasses[size]}`} />
    </div>
  );
}
