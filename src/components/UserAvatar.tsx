'use client';

import React, { useState, useEffect } from 'react';

interface UserAvatarProps {
  user?: {
    full_name?: string;
    avatar_url?: string | null;
    email?: string;
  } | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  ring?: boolean;
  previewUrl?: string | null;
}

/**
 * Menghasilkan inisial nama yang rapi dan profesional (misal: "Talitha Ayu" -> "TA", "Budi" -> "BU")
 */
export function getInitials(name?: string, email?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) {
    return email.slice(0, 2).toUpperCase();
  }
  return 'TD';
}

export function UserAvatar({
  user,
  size = 'md',
  className = '',
  ring = true,
  previewUrl = null,
}: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);

  // Reset imgError jika avatar_url atau previewUrl berubah
  const activeUrl = previewUrl || user?.avatar_url;
  useEffect(() => {
    setImgError(false);
  }, [activeUrl]);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base font-bold',
    xl: 'w-20 h-20 text-xl font-bold',
    '2xl': 'w-24 h-24 text-2xl font-black',
  };

  const ringClass = ring ? 'ring-2 ring-emerald-500/30' : '';
  const initials = getInitials(user?.full_name, user?.email);

  // Jika terdapat foto profil atau pratinjau yang valid
  if (activeUrl && !imgError) {
    return (
      <img
        src={activeUrl}
        alt={user?.full_name || 'Foto Profil'}
        onError={() => setImgError(true)}
        className={`${sizeClasses[size]} rounded-full object-cover shrink-0 ${ringClass} ${className}`}
      />
    );
  }

  // Avatar Default yang Rapi dan Profesional berbasis Inisial dengan Gradient Modern
  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-600 text-white font-extrabold flex items-center justify-center shrink-0 tracking-wider shadow-sm select-none ${ringClass} ${className}`}
      title={user?.full_name || 'Pengguna TataDana'}
    >
      <span>{initials}</span>
    </div>
  );
}
