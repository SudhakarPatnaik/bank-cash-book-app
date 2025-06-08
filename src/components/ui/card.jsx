
export function Card({
  children,
  variant = 'default',
  className = '',
  darkMode = false,
  isMobile = false,
  ...props
}) {
  const baseStyle = {
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    animation: 'fadeSlideUp 0.5s ease forwards',
  };

  const variants = {
    default: {
      background: darkMode ? '#374151' : '#ffffff',
      border: darkMode ? '1px solid #4b5563' : '1px solid #e5e7eb',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    },
    elevated: {
      background: darkMode ? '#374151' : '#ffffff',
      border: darkMode ? '1px solid #4b5563' : '1px solid #e5e7eb',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    },
    gradient: {
      background: darkMode ?
        'linear-gradient(135deg, #374151 0%, #1f2937 100%)' :
        'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
      border: darkMode ? '1px solid #4b5563' : '1px solid #e5e7eb',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    }
  };

  const style = {
    ...baseStyle,
    ...variants[variant],
  };

  return (
    <div
      style={style}
      className={`${isMobile ? 'card' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardContent({
  children,
  className = '',
  padding = '20px',
  ...props
}) {
  const style = {
    padding,
  };

  return (
    <div
      className={className}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}
