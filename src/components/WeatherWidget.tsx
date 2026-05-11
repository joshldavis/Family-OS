
import React, { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, Wind, Droplets, Thermometer, Loader2, MapPin } from 'lucide-react';

interface WeatherData {
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  description: string;
  icon: string;
  city: string;
  high: number;
  low: number;
  fetchedAt?: number;
}

const CACHE_KEY  = 'family_os_weather_cache';
const CACHE_TTL  = 30 * 60 * 1000; // 30 minutes

const WEATHER_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  '01d': Sun,  '01n': Sun,
  '02d': Cloud,'02n': Cloud,
  '03d': Cloud,'03n': Cloud,
  '04d': Cloud,'04n': Cloud,
  '09d': CloudDrizzle,'09n': CloudDrizzle,
  '10d': CloudRain,   '10n': CloudRain,
  '11d': CloudLightning,'11n': CloudLightning,
  '13d': CloudSnow,   '13n': CloudSnow,
  '50d': Wind,        '50n': Wind,
};

function readCache(): WeatherData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WeatherData;
  } catch { return null; }
}

function writeCache(d: WeatherData) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...d, fetchedAt: Date.now() })); }
  catch { /* quota exceeded, ignore */ }
}

function isFresh(d: WeatherData | null): boolean {
  return !!d?.fetchedAt && Date.now() - d.fetchedAt < CACHE_TTL;
}

// Fetch weather from OpenWeather given lat/lon
async function fetchOWM(lat: number, lon: number, apiKey: string, signal: AbortSignal): Promise<WeatherData> {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`OWM ${res.status}`);
  const d = await res.json();
  return {
    temp: Math.round(d.main.temp),
    feelsLike: Math.round(d.main.feels_like),
    humidity: d.main.humidity,
    windSpeed: Math.round(d.wind.speed),
    description: d.weather[0].description,
    icon: d.weather[0].icon,
    city: d.name,
    high: Math.round(d.main.temp_max),
    low: Math.round(d.main.temp_min),
  };
}

// Get coords from browser geolocation (Promise wrapper)
function geoCoords(timeout = 5000): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('no geolocation')); return; }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      err => reject(err),
      { timeout, maximumAge: CACHE_TTL }
    );
  });
}

// Fallback: IP-based geolocation (no permission needed)
async function ipCoords(signal: AbortSignal): Promise<{ lat: number; lon: number; city: string }> {
  const res = await fetch('https://ipapi.co/json/', { signal });
  if (!res.ok) throw new Error('ipapi failed');
  const d = await res.json();
  if (!d.latitude) throw new Error('no coords in ipapi');
  return { lat: d.latitude, lon: d.longitude, city: d.city };
}

const WeatherWidget: React.FC = () => {
  const cached = readCache();
  const [weather, setWeather] = useState<WeatherData | null>(cached);
  const [loading, setLoading] = useState(!isFresh(cached));
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (isFresh(cached)) { setLoading(false); return; }

    let alive = true;
    const ctrl = new AbortController();

    (async () => {
      const apiKey = import.meta.env.VITE_OPENWEATHER_KEY as string | undefined;
      if (!apiKey || apiKey === 'your_openweathermap_api_key_here') {
        // No key — show last cached city or a neutral placeholder
        if (!cached) setWeather({ temp: 72, feelsLike: 70, humidity: 45, windSpeed: 8,
          description: 'Add weather API key', icon: '02d', city: '—', high: 76, low: 58 });
        setLoading(false);
        return;
      }

      try {
        // 1. Try browser geolocation first (fast, accurate)
        let lat: number, lon: number;
        try {
          ({ lat, lon } = await geoCoords(4000));
        } catch {
          // 2. Fall back to IP geolocation (works without any permission)
          const ip = await ipCoords(ctrl.signal);
          lat = ip.lat; lon = ip.lon;
        }

        if (!alive) return;
        const wd = await fetchOWM(lat, lon, apiKey, ctrl.signal);
        if (!alive) return;

        writeCache(wd);
        setWeather(wd);
        setError(null);
      } catch (err: unknown) {
        if (!alive) return;
        if (err instanceof Error && err.name === 'AbortError') return;
        // Couldn't get weather at all — keep stale cache or show error
        if (!cached) setError('Unable to load weather');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; ctrl.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !weather) {
    return (
      <div className="bg-gradient-to-br from-sky-500 to-blue-600 text-white rounded-2xl p-6 notion-shadow flex items-center justify-center h-44">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if ((error || !weather) && !loading) {
    return (
      <div className="bg-gradient-to-br from-sky-500 to-blue-600 text-white rounded-2xl p-6 notion-shadow h-44 flex items-center justify-center">
        <p className="text-white/80 text-sm">{error || 'Weather unavailable'}</p>
      </div>
    );
  }

  if (!weather) return null;

  const IconComponent = WEATHER_ICONS[weather.icon] || Cloud;

  return (
    <div className="bg-gradient-to-br from-sky-500 to-blue-600 text-white rounded-2xl p-6 notion-shadow relative overflow-hidden">
      <div className="relative z-10">
        <div className="flex items-center gap-1.5 text-white/80 text-xs font-medium mb-3">
          <MapPin size={12} />
          <span>{weather.city}</span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-4xl font-bold tracking-tight">{weather.temp}°F</p>
            <p className="text-white/80 text-sm capitalize mt-0.5">{weather.description}</p>
          </div>
          <IconComponent size={48} className="text-white/90" />
        </div>

        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/20 text-xs text-white/80">
          <div className="flex items-center gap-1">
            <Thermometer size={12} />
            <span>H {weather.high}° / L {weather.low}°</span>
          </div>
          <div className="flex items-center gap-1">
            <Droplets size={12} />
            <span>{weather.humidity}%</span>
          </div>
          <div className="flex items-center gap-1">
            <Wind size={12} />
            <span>{weather.windSpeed} mph</span>
          </div>
        </div>
      </div>

      <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
      <div className="absolute -left-4 -bottom-4 w-20 h-20 bg-white/5 rounded-full blur-xl" />
    </div>
  );
};

export default WeatherWidget;
