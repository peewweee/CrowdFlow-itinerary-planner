"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  CrowdReport,
  CrowdResult,
  Itinerary,
  Spot,
  Weather,
} from "@/types";
import { dataService, GenerateItineraryInput } from "@/lib/dataService";
import { crowdScore } from "@/lib/crowd";
import { findAlternative, RerouteSuggestion } from "@/lib/reroute";
import { ItineraryForm } from "@/components/ItineraryForm";
import { SpotCard } from "@/components/SpotCard";
import { WeatherBar } from "@/components/WeatherBar";
import { SplashScreen } from "@/components/SplashScreen";
import type { MapMarker, UserLocation } from "@/components/MapView";

// Leaflet can't render on the server — load the map client-side only.
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-slate-400">
      Loading map…
    </div>
  ),
});

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [sheetMinimized, setSheetMinimized] = useState(false);
  const [dayIndex, setDayIndex] = useState(1); // Mon fallback for SSR
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [spotMap, setSpotMap] = useState<Map<string, Spot>>(new Map());
  const [citySpots, setCitySpots] = useState<Spot[]>([]);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [reports, setReports] = useState<CrowdReport[]>([]);

  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [focusTick, setFocusTick] = useState(0); // bumps to recenter the map

  useEffect(() => {
    setMounted(true);
    setDayIndex(new Date().getDay());
    dataService.listCities().then(setCities);
  }, []);

  // Auto-dismiss the location error toast.
  useEffect(() => {
    if (!locateError) return;
    const t = setTimeout(() => setLocateError(null), 5000);
    return () => clearTimeout(t);
  }, [locateError]);

  const handleLocate = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLocateError("Location isn't supported on this device.");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setFocusTick((t) => t + 1);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setLocateError(
          err.code === err.PERMISSION_DENIED
            ? "Location blocked. Enable it for this site in your browser settings."
            : "Couldn't get your location. Please try again."
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, []);

  const handleGenerate = useCallback(
    async (input: GenerateItineraryInput) => {
      setLoading(true);
      try {
        const [itin, wx, spots] = await Promise.all([
          dataService.generateItinerary(input),
          dataService.getWeather(input.city),
          dataService.getSpots(input.city),
        ]);
        setItinerary(itin);
        setWeather(wx);
        setCitySpots(spots);
        setSpotMap(new Map(spots.map((s) => [s.id, s])));
        setReports([]);
        setSheetMinimized(false); // pop the sheet open for the new plan
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleReport = useCallback(
    (spotId: string, level: 1 | 3 | 5) => {
      setReports((prev) => [
        ...prev,
        {
          id: `${spotId}_${Date.now()}_${prev.length}`,
          spotId,
          level,
          createdAt: Date.now(),
        },
      ]);
    },
    []
  );

  const handleSwap = useCallback(
    (stopSpotId: string, alternativeId: string) => {
      setItinerary((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          stops: prev.stops.map((s) =>
            s.spotId === stopSpotId ? { ...s, spotId: alternativeId } : s
          ),
        };
      });
    },
    []
  );

  // Crowd score for a spot at a given visit hour, using current reports/weather.
  const scoreAt = useCallback(
    (spot: Spot, hour: number): CrowdResult =>
      crowdScore(spot, {
        hour,
        dayIndex,
        reports,
        weather: weather ?? undefined,
      }),
    [dayIndex, reports, weather]
  );

  // Build per-stop view models: the spot, its crowd, and a reroute suggestion
  // if it's overcrowded.
  const rows = useMemo(() => {
    if (!itinerary) return [];
    return itinerary.stops.map((stop) => {
      const spot = spotMap.get(stop.spotId);
      if (!spot) return null;
      const crowd = scoreAt(spot, stop.startHour);

      let suggestion: RerouteSuggestion | null = null;
      let suggestionCrowd: CrowdResult | null = null;
      if (crowd.band === "high") {
        suggestion = findAlternative({
          spot,
          candidates: citySpots,
          itinerarySpotIds: itinerary.stops.map((s) => s.spotId),
          interests: itinerary.interests,
          scoreOf: (s) => scoreAt(s, stop.startHour),
        });
        if (suggestion) {
          suggestionCrowd = scoreAt(suggestion.alternative, stop.startHour);
        }
      }
      return { stop, spot, crowd, suggestion, suggestionCrowd };
    });
  }, [itinerary, spotMap, citySpots, scoreAt]);

  const markers: MapMarker[] = useMemo(
    () =>
      rows
        .filter((r): r is NonNullable<typeof r> => r !== null)
        .map((r, i) => ({ spot: r.spot, crowd: r.crowd, order: i + 1 })),
    [rows]
  );

  const crowdedCount = rows.filter((r) => r?.crowd.band === "high").length;

  const collapsedLabel = itinerary
    ? `${itinerary.city} · ${markers.length} stop${
        markers.length === 1 ? "" : "s"
      }`
    : "Plan a queue-free day";

  const splash = showSplash ? (
    <SplashScreen onDone={() => setShowSplash(false)} />
  ) : null;

  if (!mounted) {
    return (
      <>
        {splash}
        <main className="flex h-screen items-center justify-center text-slate-400">
          Loading CrowdFlow…
        </main>
      </>
    );
  }

  return (
    <>
      {splash}
      <main className="relative h-dvh w-screen overflow-hidden">
      {/* Full-screen map living behind everything else. */}
      <div className="absolute inset-0 z-0">
        <MapView
          markers={markers}
          userLocation={userLocation}
          focusTick={focusTick}
        />
      </div>

      {/* "You're here" — locate button + hint, top-right. */}
      <div className="absolute right-4 top-4 z-30 flex items-center gap-2">
        {!userLocation && (
          <span className="rounded-full bg-white/90 px-2 py-1 text-[10px] font-medium text-slate-500 shadow-sm backdrop-blur-sm">
            Tap to see current location
          </span>
        )}
        <button
          onClick={handleLocate}
          disabled={locating}
          aria-label="Show my location"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-sky-600 shadow-lg transition hover:bg-slate-50 active:scale-95 disabled:opacity-70"
        >
        {locating ? (
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <circle cx="12" cy="12" r="3" />
            <circle cx="12" cy="12" r="8" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
          </svg>
        )}
        </button>
      </div>

      {/* Location error toast. */}
      {locateError && (
        <div className="absolute right-4 top-16 z-30 max-w-[16rem] rounded-lg bg-slate-900/85 px-3 py-2 text-xs text-white shadow-lg backdrop-blur-sm">
          {locateError}
        </div>
      )}

      {/* Circular back button, top-left, only once a plan exists. */}
      {itinerary && (
        <button
          onClick={() => setItinerary(null)}
          aria-label="Plan another day"
          className="absolute left-4 top-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg transition hover:bg-slate-50 active:scale-95"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}

      {/* Slide-up bottom sheet that holds the form / itinerary. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center">
        <div className="animate-sheet-up pointer-events-auto flex max-h-[85dvh] w-full max-w-2xl flex-col rounded-t-3xl bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl ring-1 ring-black/5">
          {/* Drag handle — tap to minimize / expand */}
          <button
            onClick={() => setSheetMinimized((m) => !m)}
            aria-label={sheetMinimized ? "Expand panel" : "Minimize panel"}
            aria-expanded={!sheetMinimized}
            className="flex w-full shrink-0 flex-col items-center gap-1.5 px-5 pb-2 pt-3 transition hover:bg-slate-50/60"
          >
            <div className="h-1.5 w-10 rounded-full bg-slate-300" />
            {sheetMinimized && (
              <span className="flex items-center gap-1.5 pt-0.5 text-sm font-semibold text-slate-700">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 text-slate-400"
                >
                  <path d="M18 15l-6-6-6 6" />
                </svg>
                {collapsedLabel}
              </span>
            )}
          </button>

          <div
            className={`overflow-y-auto px-5 transition-all duration-300 ease-out ${
              sheetMinimized
                ? "max-h-0 pb-0 opacity-0"
                : "max-h-[76dvh] pb-7 opacity-100"
            }`}
          >
            {!itinerary ? (
              <>
                <div className="flex items-center gap-2 pb-4 pt-1">
                  <span className="text-2xl">🧭</span>
                  <div>
                    <h1 className="text-lg font-bold text-slate-900">
                      CrowdFlow
                    </h1>
                    <p className="text-xs text-slate-500">
                      Dynamic, crowd-aware itineraries for the Philippines
                    </p>
                  </div>
                </div>
                <h2 className="mb-1 text-xl font-bold text-slate-900">
                  Plan a queue-free day
                </h2>
                <p className="mb-5 text-sm text-slate-500">
                  Tell us what you like and we&apos;ll build a route that steers
                  you around the crowds.
                </p>
                <ItineraryForm
                  cities={cities}
                  loading={loading}
                  onGenerate={handleGenerate}
                />
              </>
            ) : (
              <div className="space-y-4">
                {weather && <WeatherBar weather={weather} />}

                {crowdedCount > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    ⚠️ {crowdedCount} stop{crowdedCount > 1 ? "s" : ""} on your
                    route {crowdedCount > 1 ? "are" : "is"} packed. See the
                    suggested swaps below.
                  </div>
                )}

                {rows.map((r) =>
                  r ? (
                    <SpotCard
                      key={r.stop.spotId}
                      spot={r.spot}
                      stop={r.stop}
                      index={markers.findIndex((m) => m.spot.id === r.spot.id)}
                      crowd={r.crowd}
                      suggestion={r.suggestion}
                      suggestionCrowd={r.suggestionCrowd}
                      onReport={handleReport}
                      onSwap={handleSwap}
                    />
                  ) : null
                )}

                <p className="pt-1 text-center text-xs text-slate-400">
                  Tap a pin on the map for crowd details · 🟢 quiet 🟡 filling
                  up 🔴 packed
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      </main>
    </>
  );
}
