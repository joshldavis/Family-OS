
import React, { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, Wind, Droplets, Eye, Thermometer, Loader2, MapPin } from 'lucide-react';

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
}

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

const WeatherWidget: React.FC = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_OPENWEATHER_KEY;

    if (!apiKey) {
      // Show a nice fallback with mock data
      setWeather({
        temp: 72,
        feelsLike: 70,
        humidity: 45,
        windSpeed: 8,
        description: 'Partly cloudy',
        icon: '02d',
        city: 'Your City',
        high: 76,
        low: 58,
      });
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=imperial`
          );
          if (!res.ok) throw new Error('Weather API error');
          const data = await res.json();
          setWeather({
            temp: Math.round(data.main.temp),
            feelsLike: Math.round(data.main.feels_like),
            humidity: data.main.humidity,
            windSpeed: Math.round(data.wind.speed),
            description: data.weather[0].description,
            icon: data.weather[0].icon,
            city: data.name,
            high: Math.round(data.main.temp_max),
            low: Math.round(data.main.temp_min),
          });
        } catch {
          setError('Could not fetch weather');
        } finally {
          setLoading(false);
        }
      },
      () => {
        // Geolocation denied — show fallback
        setWeather({
          temp: 72,
          feelsLike: 70,
          humidity: 45,
          windSpeed: 8,
          description: 'Partly cloudy',
          icon: '02d',
          city: 'Your City',
          high: 76,
          low: 58,
        });
        setLoading(false);
      }
    );
  }, []);

  if (loading) {
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
        <div className="flex items-center gap-1.5 text-white/80 text-xs font-medium mb-3">
          <MapPin size={12} />
          <span>{weather.city}</span>
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
