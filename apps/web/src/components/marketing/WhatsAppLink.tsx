import type { ReactNode } from 'react';
import { whatsappHref } from '@/lib/business';

export function WhatsAppLink({
  className = 'btn-pill',
  children = 'WhatsApp',
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <a
      href={whatsappHref()}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}
