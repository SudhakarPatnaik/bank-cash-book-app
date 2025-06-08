
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  ...props
}) {
  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Inter', sans-serif",
    fontWeight: 500,
    borderRadius: '8px',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: 'pointer',
    position: 'relative',
    overflow: 'hidden',
    border: 'none',
    gap: '8px',
    width: fullWidth ? '100%' : 'auto',
  };

  const variants = {
    primary: {
      background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
      color: '#ffffff',
    },
    secondary: {
      background: 'transparent',
      border: '1px solid #e5e7eb',
      color: '#111827',
    },
    ghost: {
      background: 'transparent',
      color: '#6366f1',
    }
  };

  const sizes = {
    sm: { padding: '6px 12px', fontSize: '0.875rem' },
    md: { padding: '8px 16px', fontSize: '1rem' },
    lg: { padding: '12px 20px', fontSize: '1.125rem' },
  };

  const style = {
    ...baseStyle,
    ...variants[variant],
    ...sizes[size],
  };

  return (
    <button
      style={style}
      className={`modern-button ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
