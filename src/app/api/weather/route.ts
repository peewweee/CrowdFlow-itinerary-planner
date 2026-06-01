import { NextRequest, NextResponse } from "next/server";
import { spotsByCity } from "@/data/spots";
import { Weather, WeatherCondition } from "@/types";

export const runtime = "nodejs";

// Maps OpenWeather's "main" condition to our simplified set.
function mapCondition(main: string): WeatherCondition {
  switch (main) {
    case "Clear":
      return "clear";
    case "Rain":
    case "Drizzle":
      return "rain";
    case "Thunderstorm":
      return "storm";
    case "Clouds":
      return "clouds";
    default:
      // Mist/Fog/Haze/Smoke/etc.
      return "clouds";
  }
}

// Average the city's spot coordinates to get a representative point.
function cityCenter(city: string): { lat: number; lng: number } | null {
  const spots = spotsByCity(city);
  if (spots.length === 0) return null;
  const lat = spots.reduce((s, x) => s + x.lat, 0) / spots.length;
  const lng = spots.reduce((s, x) => s + x.lng, 0) / spots.length;
  return { lat, lng };
}

async function fetchWeather(city: string): Promise<Weather | null> {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) return null;

  const center = cityCenter(city);
  if (!center) return null;

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${center.lat}&lon=${center.lng}&units=metric&appid=${apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      console.error("OpenWeather error:", res.status, await res.text());
      return null;
    }
    const data = await res.json();

    const main: string = data?.weather?.[0]?.main ?? "Clouds";
    const tempC: number = Math.round(data?.main?.temp ?? 30);
    const dt: number = data?.dt ?? 0;
    const sunrise: number = data?.sys?.sunrise ?? 0;
    const sunset: number = data?.sys?.sunset ?? 0;
    const isDaytime =
      sunrise && sunset ? dt >= sunrise && dt <= sunset : true;

    return { condition: mapCondition(main), tempC, isDaytime };
  } catch (err) {
    console.error("OpenWeather request failed:", err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city") ?? "";
  const weather = await fetchWeather(city);
  if (!weather) {
    return NextResponse.json({ weather: null, source: "fallback" });
  }
  return NextResponse.json({ weather, source: "openweather" });
}
