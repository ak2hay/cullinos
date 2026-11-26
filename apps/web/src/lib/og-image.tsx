import { ImageResponse } from 'next/og';

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = 'image/png';

export function renderOgImage(title: string, eyebrow = 'Cullinos') {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 72,
          background: '#F5F0E8',
          color: '#2C2416',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              border: '3px solid #C4A052',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#C4A052',
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            C
          </div>
          <span style={{ fontSize: 28, color: '#6B5E4F' }}>{eyebrow}</span>
        </div>
        <p style={{ fontSize: 60, fontWeight: 600, lineHeight: 1.15, marginTop: 28, maxWidth: 1000 }}>
          {title}
        </p>
        <p style={{ fontSize: 28, color: '#C4A052', marginTop: 28 }}>
          Restaurant POS & GST Billing Software
        </p>
      </div>
    ),
    { ...ogSize },
  );
}
