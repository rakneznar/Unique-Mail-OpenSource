import React from 'react';

interface AppLogoProps {
  className?: string;
  size?: number | string;
}

export default function AppLogo({ className = '', size = 32 }: AppLogoProps) {
  const dimension = typeof size === 'number' ? String(size) + 'px' : size;

  return (
    <img
      id="app-logo-img"
      src="/unique-mail-logo.png"
      alt="Unique Mail"
      width={size}
      height={size}
      className={`select-none object-cover ${className}`}
      style={{
        width: dimension,
        height: dimension,
        display: 'inline-block',
        verticalAlign: 'middle',
      }}
      draggable={false}
    />
  );
}
