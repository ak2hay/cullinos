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
          background: '#F5F0E8',
          color: '#2C2416',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 40 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              border: '3px solid #C4A052',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36,
              fontWeight: 600,
              color: '#C4A052',
              background: '#FAF7F2',
            }}
          >
            C
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 48, fontWeight: 600 }}>Cullinos</span>
            <span style={{ fontSize: 24, color: '#6B5E4F' }}>Restaurant Operating System</span>
          </div>
        </div>
        <p style={{ fontSize: 56, fontWeight: 500, lineHeight: 1.2, maxWidth: 900 }}>
          Experience{' '}
          <span style={{ color: '#C4A052', fontStyle: 'italic' }}>Unified Operations</span>
        </p>
      </div>
    ),
    { ...size },
  );
}
