
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  fullWidth?: boolean;
}

export default function Button({ 
  variant = 'primary', 
  size = 'md', 
  children, 
  className = '',
  fullWidth = false,
  ...props 
}: ButtonProps) {
  const baseStyles = 'whitespace-nowrap cursor-pointer font-medium transition-all duration-200 rounded-lg inline-flex items-center justify-center gap-2';
  
  const variants = {
    primary: 'bg-[#004aad] text-white hover:bg-[#003d91] shadow-sm shadow-[#004aad]/20',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    outline: 'border border-gray-200 text-gray-700 hover:bg-gray-50 bg-white',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    ghost: 'text-gray-600 hover:bg-gray-100',
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-sm',
  };
  
  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

