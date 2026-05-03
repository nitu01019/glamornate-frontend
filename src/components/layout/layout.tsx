import React from 'react';
import Header from './Header';
import Footer from './Footer';

interface LayoutProps {
  children: React.ReactNode;
  variant?: 'public' | 'customer' | 'spa' | 'admin';
  showHeader?: boolean;
  showFooter?: boolean;
  className?: string;
}

export default function Layout({
  children,
  variant = 'public',
  showHeader = true,
  showFooter = true,
  className = '',
}: LayoutProps) {
  return (
    <div className={`min-h-screen flex flex-col ${className}`}>
      {showHeader && <Header variant={variant} />}
      <main className="flex-1">{children}</main>
      {showFooter && <Footer variant={variant === 'admin' ? 'minimal' : 'public'} />}
    </div>
  );
}
