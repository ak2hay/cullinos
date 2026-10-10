import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
);

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Icon>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);

export const ArrowLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const MinusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14" />
  </Icon>
);

export const CartIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="20" r="1.4" />
    <circle cx="18" cy="20" r="1.4" />
    <path d="M2.5 3.5h2.6l2.4 11.2a1.8 1.8 0 0 0 1.8 1.4h8.4a1.8 1.8 0 0 0 1.7-1.3L21.5 8H6.1" />
  </Icon>
);

export const TableIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 9h18M5 9v10M19 9v10M8 9V6h8v3M5 14h14" />
  </Icon>
);

export const FlameIcon = (p: IconProps) => (
  <Icon {...p} fill="currentColor" stroke="none">
    <path d="M12 2c.6 3.2-1 5-2.6 6.8C7.8 10.6 6 12.6 6 15.5A6 6 0 0 0 12 22a6 6 0 0 0 6-6.3c0-2.4-1.1-4.1-2.3-5.6-.3 1.4-1 2.5-2.1 3.1.3-3.8-.6-8-1.6-11.2Z" />
  </Icon>
);

export const GridIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.6" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" />
  </Icon>
);

export const LeafIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21c-4.5-2-7-5.6-7-10 3 0 5.4 1 7 3 1.6-2 4-3 7-3 0 4.4-2.5 8-7 10Z" />
    <path d="M12 21v-7M12 14c0-4 1.2-7.4 3.5-10-3.7 1.3-5.8 3.6-6.6 6" />
  </Icon>
);

export const ClocheIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 18h18M4.5 18a7.5 7.5 0 0 1 15 0M12 7.5V6M10.5 6h3" />
  </Icon>
);

export const CupIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 8h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8ZM16 10h1.5a2.5 2.5 0 0 1 0 5H16M7 3.5v2M10 3.5v2M13 3.5v2" />
  </Icon>
);

export const CakeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20h16M5 20v-6.5a1.5 1.5 0 0 1 1.5-1.5h11a1.5 1.5 0 0 1 1.5 1.5V20M5 15.5c1.2 1 2.4 1 3.5 0s2.3-1 3.5 0 2.3 1 3.5 0 2.3-1 3.5 0M12 12V8.5M12 6.5a1 1 0 1 0 0-.01" />
  </Icon>
);

export const PizzaIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21 3.5 6.5a14 14 0 0 1 17 0L12 21Z" />
    <circle cx="10" cy="10" r="1" />
    <circle cx="14" cy="13" r="1" />
  </Icon>
);

export const BowlIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 11h18a9 9 0 0 1-18 0ZM8 7c0-1.5 1-2 1-3.5M12 7c0-1.5 1-2 1-3.5M16 7c0-1.5 1-2 1-3.5" />
  </Icon>
);

export const UtensilsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 21V3c-2.2 1.2-3.5 3.7-3.5 7v3H17" />
  </Icon>
);

export const SparkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
  </Icon>
);
