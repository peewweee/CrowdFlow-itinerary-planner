import { Category, Itinerary, Spot, Weather } from "@/types";
import { CITIES, SPOTS, spotsByCity } from "@/data/spots";

// ---------------------------------------------------------------------------
// Swappable data layer.
//
// The entire UI talks ONLY to this interface. Today it returns mocked data.
// When the backend/AI is finalized, we implement DataService against the real
// backend (DB, AI itinerary endpoint, weather API) and swap the export — with
// zero changes to any component.
// ---------------------------------------------------------------------------

export interface GenerateItineraryInput {
  city: string;
  interests: Category[];
  startHour: number;
  endHour: number;
}

export interface DataService {
  listCities(): Promise<string[]>;
  getSpots(city: string): Promise<Spot[]>;
  generateItinerary(input: GenerateItineraryInput): Promise<Itinerary>;
  getWeather(city: string): Promise<Weather>;
}

// Average hours we budget per stop when slicing up the available time.
const HOURS_PER_STOP = 2;

function pickSpotsForItinerary(
  city: string,
  interests: Category[],
  maxStops: number
): Spot[] {
  const pool = spotsByCity(city);

  // Spots matching the user's interests come first, ordered to interleave
  // categories for variety; everything else is a fallback.
  const matching = pool.filter((s) => interests.includes(s.category));
  const rest = pool.filter((s) => !interests.includes(s.category));

  const ordered = interleaveByCategory(matching, interests);
  const chosen = [...ordered, ...rest].slice(0, maxStops);
  return chosen;
}

// Round-robins through the interest categories so the day isn't, e.g., five
// museums in a row.
function interleaveByCategory(spots: Spot[], interests: Category[]): Spot[] {
  const buckets = new Map<Category, Spot[]>();
  for (const cat of interests) buckets.set(cat, []);
  for (const s of spots) buckets.get(s.category)?.push(s);

  const result: Spot[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const cat of interests) {
      const bucket = buckets.get(cat);
      if (bucket && bucket.length > 0) {
        result.push(bucket.shift()!);
        added = true;
      }
    }
  }
  return result;
}

class MockDataService implements DataService {
  async listCities(): Promise<string[]> {
    return CITIES;
  }

  async getSpots(city: string): Promise<Spot[]> {
    return spotsByCity(city);
  }

  async generateItinerary(
    input: GenerateItineraryInput
  ): Promise<Itinerary> {
    const { city, interests, startHour, endHour } = input;
    const available = Math.max(0, endHour - startHour);
    const maxStops = Math.max(1, Math.floor(available / HOURS_PER_STOP));

    // Try the AI route first; fall back to the offline generator on any
    // failure so the demo never breaks.
    let spots = await this.generateWithAI(input, maxStops);
    if (!spots) {
      await delay(400); // keep a believable "thinking" beat for the fallback
      spots = pickSpotsForItinerary(city, interests, maxStops);
    }

    const stops = spots.map((s, i) => ({
      spotId: s.id,
      startHour: startHour + i * HOURS_PER_STOP,
      endHour: startHour + (i + 1) * HOURS_PER_STOP,
    }));

    return {
      id: `itin_${Date.now()}`,
      city,
      interests,
      startHour,
      endHour,
      stops,
      createdAt: Date.now(),
    };
  }

  // Calls the server-side AI route and maps the returned spot ids back to
  // Spot objects (in the city). Returns null if AI is unavailable.
  private async generateWithAI(
    input: GenerateItineraryInput,
    maxStops: number
  ): Promise<Spot[] | null> {
    try {
      const res = await fetch("/api/itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, stops: maxStops }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { spotIds: string[] | null };
      if (!data.spotIds || data.spotIds.length === 0) return null;

      const byId = new Map(spotsByCity(input.city).map((s) => [s.id, s]));
      const spots = data.spotIds
        .map((id) => byId.get(id))
        .filter((s): s is Spot => Boolean(s))
        .slice(0, maxStops);

      return spots.length > 0 ? spots : null;
    } catch {
      return null;
    }
  }

  async getWeather(city: string): Promise<Weather> {
    // Try the live weather route; fall back to a typical sunny PH afternoon
    // if the API key is missing or the request fails.
    try {
      const res = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
      if (res.ok) {
        const data = (await res.json()) as { weather: Weather | null };
        if (data.weather) return data.weather;
      }
    } catch {
      // ignore and fall back
    }
    await delay(150);
    return { condition: "clear", tempC: 32, isDaytime: true };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The single instance the app imports. Replace this line to swap backends.
export const dataService: DataService = new MockDataService();

// Re-export so callers don't need a second import for the full spot catalog.
export { SPOTS };
