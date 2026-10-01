import 'leaflet/dist/leaflet.css';
import './LocationPicker.css';
import { useEffect, useState } from 'react';
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { LocateFixed, Search } from 'lucide-react';
import { Button } from '@cullinos/ui';

const PIN_ICON = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
});

const INDIA_CENTER: [number, number] = [20.5937, 78.9629];
const PIN_ZOOM = 16;

type Point = [number, number];

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

function parsePoint(latitude: string, longitude: string): Point | null {
  if (!latitude.trim() || !longitude.trim()) return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lat, lng];
}

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Keeps a typed-in point visible without jumping the map when the pin was placed by hand. */
function FollowPoint({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat == null || lng == null) return;
    if (!map.getBounds().contains([lat, lng])) {
      map.setView([lat, lng], Math.max(map.getZoom(), PIN_ZOOM));
    }
  }, [map, lat, lng]);
  return null;
}

function FlyTo({ target }: { target: { point: Point; seq: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target.point, PIN_ZOOM, { duration: 0.8 });
  }, [map, target]);
  return null;
}

export function LocationPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: string;
  longitude: string;
  onChange: (latitude: string, longitude: string) => void;
}) {
  const point = parsePoint(latitude, longitude);
  const [initialPoint] = useState(point);
  const [flyTarget, setFlyTarget] = useState<{ point: Point; seq: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canLocate = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  function place(lat: number, lng: number, fly = false) {
    onChange(lat.toFixed(6), lng.toFixed(6));
    if (fly) setFlyTarget((prev) => ({ point: [lat, lng], seq: (prev?.seq ?? 0) + 1 }));
  }

  function locateMe() {
    setMessage(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        place(pos.coords.latitude, pos.coords.longitude, true);
      },
      (err) => {
        setLocating(false);
        setMessage(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied. Allow location for this site in your browser settings.'
            : err.code === err.TIMEOUT
              ? 'Finding your location took too long. Try again, or drop the pin on the map.'
              : 'Your location is unavailable right now. Drop the pin on the map instead.',
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function search() {
    const q = query.trim();
    if (!q) return;
    setMessage(null);
    setSearching(true);
    setResults(null);
    try {
      const params = new URLSearchParams({
        format: 'jsonv2',
        limit: '5',
        countrycodes: 'in',
        q,
      });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { 'Accept-Language': 'en' },
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as SearchResult[];
      setResults(data);
      if (data.length === 0) setMessage('No places found. Try a nearby landmark or area name.');
    } catch {
      setMessage('Search is unavailable right now. Drop the pin on the map instead.');
    } finally {
      setSearching(false);
    }
  }

  function pickResult(result: SearchResult) {
    setResults(null);
    setQuery(result.display_name);
    place(Number(result.lat), Number(result.lon), true);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void search();
              }
            }}
            placeholder="Search address or landmark, then press Enter"
            aria-label="Search location"
            className="h-11 w-full rounded-lg border border-line bg-bg-card pl-9 pr-3 text-sm text-text-primary outline-none focus:border-brand-primary"
          />
          {results && results.length > 0 ? (
            <ul className="absolute left-0 right-0 top-full z-[1100] mt-1 overflow-hidden rounded-lg border border-line bg-bg-card shadow-lg">
              {results.map((r) => (
                <li key={r.place_id}>
                  <button
                    type="button"
                    onClick={() => pickResult(r)}
                    className="block w-full px-3 py-2 text-left text-sm text-text-secondary hover:bg-hover hover:text-text-primary"
                  >
                    {r.display_name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => void search()} loading={searching}>
            Search
          </Button>
          {canLocate ? (
            <Button type="button" variant="secondary" onClick={locateMe} loading={locating}>
              <span className="inline-flex items-center gap-1.5">
                <LocateFixed size={16} aria-hidden="true" />
                Use my location
              </span>
            </Button>
          ) : null}
        </div>
      </div>

      {message ? <p className="text-xs text-status-warning">{message}</p> : null}

      <div className="isolate h-72 overflow-hidden rounded-xl border border-line-subtle">
        <MapContainer
          center={initialPoint ?? INDIA_CENTER}
          zoom={initialPoint ? PIN_ZOOM : 5}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            className="location-picker-tiles"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToPlace onPick={(lat, lng) => place(lat, lng)} />
          <FollowPoint lat={point?.[0] ?? null} lng={point?.[1] ?? null} />
          <FlyTo target={flyTarget} />
          {point ? (
            <Marker
              position={point}
              icon={PIN_ICON}
              draggable
              eventHandlers={{
                dragend(e) {
                  const { lat, lng } = (e.target as L.Marker).getLatLng();
                  place(lat, lng);
                },
              }}
            />
          ) : null}
        </MapContainer>
      </div>
      <p className="text-xs text-text-muted">
        Click the map or drag the pin to the outlet entrance. Latitude and longitude fill in automatically.
      </p>
    </div>
  );
}

export default LocationPicker;
