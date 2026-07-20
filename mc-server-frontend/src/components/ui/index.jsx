import React from 'react';

// --- Card Component ---
export const Card = ({ children, className = '', onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`bg-bg-surface border border-border-default rounded-xl p-5 shadow-lg transition-all duration-300 ${
        onClick ? 'cursor-pointer hover:border-border-active hover:shadow-primary-tint/20 hover:shadow-xl hover:-translate-y-0.5' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};

// --- Button Component ---
export const Button = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary', // primary, secondary, outline, danger, success, warning
  disabled = false,
  className = '',
  loading = false,
}) => {
  const baseStyle = 'inline-flex items-center justify-center font-semibold px-4 py-2.5 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-border disabled:opacity-50 disabled:cursor-not-allowed text-sm';
  
  const variants = {
    primary: 'bg-primary-base border border-primary-border text-white hover:bg-primary-tint active:scale-95 shadow-md shadow-primary-tint/20',
    secondary: 'bg-bg-page border border-border-subtle text-text-body hover:bg-bg-surface',
    outline: 'border border-primary-border text-primary-text hover:bg-primary-tint/20',
    danger: 'bg-danger-bg border border-danger-border text-danger-text hover:bg-red-950/70',
    success: 'bg-success-bg border border-success-border text-success-text hover:bg-green-950/70',
    warning: 'bg-warning-bg border border-warning-border text-warning-text hover:bg-amber-950/70',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyle} ${variants[variant]} ${className}`}
    >
      {loading ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          กำลังโหลด...
        </>
      ) : children}
    </button>
  );
};

// --- Badge Component ---
export const Badge = ({ children, status = 'default' }) => {
  const styles = {
    default: 'bg-bg-surface border border-border-subtle text-text-muted',
    pending: 'bg-warning-bg border border-warning-border text-warning-text',
    confirmed: 'bg-success-bg border border-success-border text-success-text',
    online: 'bg-success-bg border border-success-border text-success-text',
    offline: 'bg-danger-bg border border-danger-border text-danger-text',
    cancelled: 'bg-danger-bg border border-danger-border text-danger-text',
    restarting: 'bg-warning-bg border border-warning-border text-warning-text',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${styles[status] || styles.default}`}>
      {children}
    </span>
  );
};

// --- Input Component ---
export const Input = ({
  label,
  type = 'text',
  name,
  value,
  onChange,
  placeholder,
  required = false,
  error = '',
  className = '',
  ...props
}) => {
  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      {label && <label className="text-xs font-medium text-text-body">{label} {required && <span className="text-danger-text">*</span>}</label>}
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className={`bg-bg-input border border-border-default focus:border-border-active focus:ring-1 focus:ring-border-active text-text-heading placeholder-text-placeholder rounded-lg px-3 py-2 text-sm outline-none transition-all duration-150 ${
          error ? 'border-danger-border focus:border-danger-border focus:ring-danger-border' : ''
        }`}
        {...props}
      />
      {error && <span className="text-xs text-danger-text mt-0.5">{error}</span>}
    </div>
  );
};

// --- Modal Component ---
export const Modal = ({ isOpen, onClose, title, children, className = '' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-bg-app border border-border-default rounded-xl w-full max-w-lg shadow-2xl p-6 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200 ${className}`}>
        <div className="flex items-center justify-between pb-4 border-b border-border-subtle mb-4">
          <h3 className="text-lg font-bold text-text-heading">{title}</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-heading transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- Table Component ---
export const Table = ({ headers, children, className = '' }) => {
  return (
    <div className={`overflow-x-auto border border-border-default rounded-xl bg-bg-surface ${className}`}>
      <table className="min-w-full divide-y divide-border-subtle">
        <thead className="bg-bg-app">
          <tr>
            {headers.map((header, idx) => (
              <th
                key={idx}
                scope="col"
                className="px-6 py-3.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle bg-bg-surface text-sm text-text-body">
          {children}
        </tbody>
      </table>
    </div>
  );
};

// --- StatCard Component ---
export const StatCard = ({ title, value, icon, description, className = '' }) => {
  return (
    <Card className={`flex items-center gap-4 ${className}`}>
      {icon && (
        <div className="p-3.5 bg-primary-tint/40 border border-primary-border/20 rounded-xl text-primary-text flex items-center justify-center">
          {icon}
        </div>
      )}
      <div>
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">{title}</p>
        <h4 className="text-2xl font-extrabold text-text-heading mt-1">{value}</h4>
        {description && <p className="text-xs text-text-muted mt-1.5">{description}</p>}
      </div>
    </Card>
  );
};
