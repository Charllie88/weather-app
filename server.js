import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const geocodingApiUrl = "https://geocoding-api.open-meteo.com/v1/search";
const forecastApiUrl = "https://api.open-meteo.com/v1/forecast";
const staticFiles = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/assets/style.css", ["assets/style.css", "text/css; charset=utf-8"]],
  ["/assets/app.js", ["assets/app.js", "text/javascript; charset=utf-8"]],
]);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(payload));
}

function isCurrentWeather(data) {
  const current = data?.current;
  return (
    Number.isFinite(current?.temperature_2m) &&
    Number.isFinite(current?.apparent_temperature) &&
    Number.isFinite(current?.relative_humidity_2m) &&
    Number.isFinite(current?.weather_code) &&
    Number.isFinite(current?.wind_speed_10m) &&
    Number.isFinite(current?.wind_direction_10m) &&
    Number.isFinite(current?.pressure_msl) &&
    Number.isFinite(current?.visibility)
  );
}

async function fetchOpenMeteoJson(url, fetchImpl) {
  let upstreamResponse;
  try {
    upstreamResponse = await fetchImpl(url, {
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      const timeoutError = new Error("The weather service took too long to respond. Try again.");
      timeoutError.statusCode = 504;
      throw timeoutError;
    }

    console.error("Open-Meteo request failed:", error);
    const networkError = new Error("Unable to reach the weather service. Try again later.");
    networkError.statusCode = 502;
    throw networkError;
  }

  if (!upstreamResponse.ok) {
    const upstreamError = new Error(
      upstreamResponse.status === 429
        ? "Weather search limit reached. Try again later."
        : "The weather service could not complete this request.",
    );
    upstreamError.statusCode = upstreamResponse.status === 429 ? 429 : 502;
    throw upstreamError;
  }

  try {
    return await upstreamResponse.json();
  } catch {
    const invalidResponseError = new Error("The weather service returned an invalid response.");
    invalidResponseError.statusCode = 502;
    throw invalidResponseError;
  }
}

function getWeatherDescription(code) {
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if ([51, 53, 55].includes(code)) return "Drizzle";
  if ([56, 57].includes(code)) return "Freezing drizzle";
  if ([61, 63, 65].includes(code)) return "Rain";
  if ([66, 67].includes(code)) return "Freezing rain";
  if ([71, 73, 75, 77].includes(code)) return "Snow";
  if ([80, 81, 82].includes(code)) return "Rain showers";
  if ([85, 86].includes(code)) return "Snow showers";
  if (code === 95 || code === 96 || code === 99) return "Thunderstorm";
  return null;
}

async function handleWeatherRequest(requestUrl, response, { fetchImpl }) {
  const city = requestUrl.searchParams.get("city")?.trim();
  if (!city) {
    sendJson(response, 400, { error: "Enter a city name to search." });
    return;
  }

  if (city.length > 100) {
    sendJson(response, 400, { error: "City names must be 100 characters or fewer." });
    return;
  }

  try {
    const geocodingUrl = new URL(geocodingApiUrl);
    geocodingUrl.searchParams.set("name", city);
    geocodingUrl.searchParams.set("count", "1");
    geocodingUrl.searchParams.set("language", "en");
    geocodingUrl.searchParams.set("format", "json");
    const geocodingData = await fetchOpenMeteoJson(geocodingUrl, fetchImpl);
    const location = geocodingData?.results?.[0];

    if (
      typeof location?.name !== "string" ||
      !Number.isFinite(location.latitude) ||
      !Number.isFinite(location.longitude)
    ) {
      sendJson(response, 404, { error: "City not found. Check the spelling and try again." });
      return;
    }

    const forecastUrl = new URL(forecastApiUrl);
    forecastUrl.searchParams.set("latitude", String(location.latitude));
    forecastUrl.searchParams.set("longitude", String(location.longitude));
    forecastUrl.searchParams.set(
      "current",
      [
        "temperature_2m",
        "relative_humidity_2m",
        "apparent_temperature",
        "weather_code",
        "wind_speed_10m",
        "wind_direction_10m",
        "pressure_msl",
        "visibility",
      ].join(","),
    );
    forecastUrl.searchParams.set("temperature_unit", "celsius");
    forecastUrl.searchParams.set("wind_speed_unit", "kmh");
    forecastUrl.searchParams.set("timezone", "auto");

    const forecastData = await fetchOpenMeteoJson(forecastUrl, fetchImpl);
    if (!isCurrentWeather(forecastData)) {
      sendJson(response, 502, { error: "The weather service returned incomplete data." });
      return;
    }

    const description = getWeatherDescription(forecastData.current.weather_code);
    if (!description) {
      sendJson(response, 502, { error: "The weather service returned an unsupported weather condition." });
      return;
    }

    sendJson(response, 200, {
      name: location.name,
      country: location.country,
      current: forecastData.current,
      description,
    });
  } catch (error) {
    sendJson(response, error.statusCode || 502, {
      error: error.message || "Unable to retrieve weather. Try again later.",
    });
  }
}

export function createWeatherServer({
  fetchImpl = fetch,
} = {}) {
  return createServer(async (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

    let requestUrl;
    try {
      requestUrl = new URL(request.url, "http://localhost");
    } catch {
      sendJson(response, 400, { error: "Invalid request URL." });
      return;
    }

    if (requestUrl.pathname === "/api/weather") {
      if (request.method !== "GET") {
        response.setHeader("Allow", "GET");
        sendJson(response, 405, { error: "Method not allowed." });
        return;
      }

      await handleWeatherRequest(requestUrl, response, { fetchImpl });
      return;
    }

    if (request.method !== "GET") {
      response.setHeader("Allow", "GET");
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    const file = staticFiles.get(requestUrl.pathname);
    if (!file) {
      sendJson(response, 404, { error: "Not found." });
      return;
    }

    try {
      const contents = await readFile(join(projectRoot, file[0]));
      response.writeHead(200, {
        "Cache-Control": "no-cache",
        "Content-Type": file[1],
        "X-Content-Type-Options": "nosniff",
      });
      response.end(contents);
    } catch (error) {
      console.error("Unable to serve application file:", error);
      sendJson(response, 500, { error: "Unable to serve the application." });
    }
  });
}

const isDirectExecution =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectExecution) {
  const host = process.env.HOST || "127.0.0.1";
  const port = Number.parseInt(process.env.PORT || "3000", 10);
  const server = createWeatherServer();

  server.once("error", (error) => {
    console.error("Unable to start the weather app server:", error);
    process.exitCode = 1;
  });
  server.listen(port, host, () => {
    console.log(`Weather App running at http://${host}:${port}`);
  });
}
