import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Cullinos — Restaurant Operating System';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 80,
          background: '#0F0F1A',
          color: '#F9FAFB',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              background: '#D4A017',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 40,
              fontWeight: 700,
              color: '#0F0F1A',
            }}
          >
            C
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 48, fontWeight: 700 }}>Cullinos</span>
            <span style={{ fontSize: 24, color: '#9CA3AF' }}>Restaurant Operating System</span>
          </div>
        </div>
        <p style={{ fontSize: 36, fontWeight: 600, lineHeight: 1.3, maxWidth: 900 }}>
          Run your restaurant{' '}
          <span style={{ color: '#D4A017' }}>from one place.</span>
        </p>
        <p style={{ fontSize: 22, color: '#9CA3AF', marginTop: 24, maxWidth: 800 }}>
          POS, kitchen, ordering, inventory, and enterprise management — unified.
        </p>
      </div>
    ),
    { ...size },
  );
}
