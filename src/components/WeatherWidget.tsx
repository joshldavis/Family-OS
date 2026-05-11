
import React, { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, Wind, Droplets, Thermometer, Loader2, MapPin, RefreshCw } from 'lucide-react';

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
  fetchedAt?: number; // epoch ms
}

const CACHE_KEY = 'family_os_weather_cache';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

const WEATHER_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  '01d': Sun, '01n': Sun,
  '02d': Cloud, '02n': Cloud,
  '03d': Cloud, '03n': Cloud,
  '04d': Cloud, '04n': Cloud,
  '09d': CloudDrizzle, '09n': CloudDrizzle,
  '10d': CloudRain, '10n': CloudRain,
  '11d': CloudLightning, '11n': CloudLightning,
  '13d': CloudSnow, '13n': CloudSnow,
  '50d': Wind, '50n': Wind,
};

function loadCache(): WeatherData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data: WeatherData = JSON.parse(raw);
    return data;
  } catch {
    return null;
  }
}

function saveCache(data: WeatherData) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, fetchedAt: Date.now() }));
  } catch { /* ignore */ }
}

function isCacheFresh(data: WeatherData): boolean {
  return !!data.fetchedAt && Date.now() - data.fetchedAt < CACHE_TTL_MS;
}

const WeatherWidget: React.FC = () => {
  const cached = loadCache();
  const [weather, setWeather]   = useState<WeatherData | null>(cached);
  const [loading, setLoading]   = useState(!cached || !isCacheFresh(cached));
  const [stale, setStale]       = useState(!!cached && !isCacheFresh(cached));
  const [error, setError]       = useState<string | null>(null);

  const fetchWeather = (lat: number, lon: number, apiKey: string, signal: AbortSignal) =>
    fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`,
      { signal }
    );

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const apiKey = import.meta.env.VITE_OPENWEATHER_KEY as string | undefined;

    if (!apiKey) {
      // No API key — use cache if we have it, otherwise show placeholder
      if (!cached) {
        setWeather({
          temp: 72, feelsLike: 70, humidity: 45, windSpeed: 8,
          description: 'Partly cloudy', icon: '02d',
          city: 'Your City', high: 76, low: 58,
        });
      }
      setLoading(false);
      return () => { isMounted = false; controller.abort(); };
    }

    // If we have a fresh cache already, skip fetching
    if (cached && isCacheFresh(cached)) {
      setLoading(false);
      return () => { isMounted = false; controller.abort(); };
    }

    // Try to get geolocation with a short timeout so Safari doesn't hang
    const geoTimeout = setTimeout(() => {
      // Geolocation timed out — show cache or placeholder
      if (!isMounted) return;
      if (!weather) {
        setWeather(cached ?? {
          temp: 72, feelsLike: 70, humidity: 45, windSpeed: 8,
          description: 'Location unavailable', icon: '02d',
          city: 'Your City', high: 76, low: 58,
        });
      }
      setLoading(false);
      setStale(true);
    }, 5000);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        clearTimeout(geoTimeout);
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetchWeather(latitude, longitude, apiKey, controller.signal);
          if (!res.ok) throw new Error('Weather API error');
          const data = await res.json();
          if (!isMounted) return;

          const wd: WeatherData = {
            temp: Math.round(data.main.temp),
            feelsLike: Math.round(data.main.feels_like),
            humidity: data.main.humidity,
            windSpeed: Math.round(data.wind.speed),
            description: data.weather[0].description,
            icon: data.weather[0].icon,
            city: data.name,
            high: Math.round(data.main.temp_max),
            low: Math.round(data.main.temp_min),
          };
          saveCache(wd);
          setWeather(wd);
          setStale(false);
          setError(null);
        } catch (err: unknown) {
          if (!isMounted) return;
          if (err instanceof Error && err.name === 'AbortError') return;
          // Fetch failed but we might have a stale cache — show it
          if (!weather && cached) setWeather(cached);
          setError(weather || cached ? null : 'Could not fetch weather');
          setStale(true);
        } finally {
          if (isMounted) setLoading(false);
        }
      },
      () => {
        // Geolocation denied — use cache if available
        clearTimeout(geoTimeout);
        if (!isMounted) return;
        if (cached) {
          setWeather(cached);
          setStale(!isCacheFresh(cached));
        } else {
          setWeather({
            temp: 72, feelsLike: 70, humidity: 45, windSpeed: 8,
            description: 'Enable location for live weather', icon: '02d',
            city: 'Location off', high: 76, low: 58,
          });
        }
        setLoading(false);
      },
      { timeout: 4500, maximumAge: CACHE_TTL_MS }
    );

    return () => {
      isMounted = false;
      clearTimeout(geoTimeout);
      controller.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !weather) {
    return (
      <div className="bg-gradient-to-br from-sky-500 to-blue-600 text-white rounded-2xl p-6 notion-shadow flex items-center justify-center h-44">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="bg-gradient-to-br from-sky-500 to-blue-600 text-white rounded-2xl p-6 notion-shadow h-44 flex items-center justify-center">
        <p className="text-white/80 text-sm">{error || 'Weather unavailable'}</p>
      </div>
    );
  }

  const IconComponent = WEATHER_ICONS[weather.icon] || Cloud;

  return (
    <div className="bg-gradient-to-br from-sky-500 to-blue-600 text-white rounded-2xl p-6 notion-shadow relative overflow-hidden">
      <div className="relative z-10">
        {/* City & Description */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-white/80 text-xs font-medium">
            <MapPin size={12} />
            <span>{weather.city}</span>
          </div>
          {stale && (
            <div className="flex items-center gap-1 text-white/50 text-[10px]">
              <RefreshCw size={9} />
              <span>cached</span>
            </div>
          )}
        </div>

        {/* Main temp row */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-4xl font-bold tracking-tight">{weather.temp}°F</p>
            <p className="text-white/80 text-sm capitalize mt-0.5">{weather.description}</p>
          </div>
          <IconComponent size={48} className="text-white/90" />
        </div>

        {/* Details row */}
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

      {/* Background decoration */}
      <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
      <div className="absolute -left-4 -bottom-4 w-20 h-20 bg-white/5 rounded-full blur-xl"></div>
    </div>
  );
};

export default WeatherWidget;
