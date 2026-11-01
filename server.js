import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const weatherApiUrl = "https://api.openweathermap.org/data/2.5/weather";
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

function isWeatherPayload(data) {
  const weather = data?.weather?.[0];
  const main = data?.main;
  const wind = data?.wind;

  return (
    typeof data?.name === "string" &&
    typeof weather?.description === "string" &&
    /^\d{2}[dn]$/.test(weather?.icon ?? "") &&
    Number.isFinite(main?.temp) &&
    Number.isFinite(main?.feels_like) &&
    Number.isFinite(main?.humidity) &&
    Number.isFinite(main?.pressure) &&
    Number.isFinite(wind?.speed)
  );
}

async function handleWeatherRequest(requestUrl, response, { apiKey, fetchImpl }) {
  const city = requestUrl.searchParams.get("city")?.trim();
  if (!city) {
    sendJson(response, 400, { error: "Enter a city name to search." });
    return;
  }

  if (city.length > 100) {
    sendJson(response, 400, { error: "City names must be 100 characters or fewer." });
    return;
  }

  if (!apiKey) {
    sendJson(response, 503, { error: "Weather service is not configured on the server." });
    return;
  }

  const upstreamUrl = new URL(weatherApiUrl);
  upstreamUrl.searchParams.set("q", city);
  upstreamUrl.searchParams.set("appid", apiKey);
  upstreamUrl.searchParams.set("units", "metric");

  let upstreamResponse;
  try {
    upstreamResponse = await fetchImpl(upstreamUrl, {
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      sendJson(response, 504, { error: "The weather service took too long to respond. Try again." });
      return;
    }

    console.error("Weather service request failed:", error);
    sendJson(response, 502, { error: "Unable to reach the weather service. Try again later." });
    return;
  }

  let data;
  try {
    data = await upstreamResponse.json();
  } catch {
    sendJson(response, 502, { error: "The weather service returned an invalid response." });
    return;
  }

  if (!upstreamResponse.ok) {
    if (upstreamResponse.status === 404) {
      sendJson(response, 404, { error: "City not found. Check the spelling and try again." });
      return;
    }
    if (upstreamResponse.status === 429) {
      sendJson(response, 429, { error: "Weather search limit reached. Try again later." });
      return;
    }
    if (upstreamResponse.status === 401) {
      sendJson(response, 502, { error: "Weather service configuration is invalid." });
      return;
    }

    sendJson(response, 502, { error: "The weather service could not complete this request." });
    return;
  }

  if (!isWeatherPayload(data)) {
    sendJson(response, 502, { error: "The weather service returned incomplete data." });
    return;
  }

  sendJson(response, 200, data);
}

export function createWeatherServer({
  apiKey = process.env.OPENWEATHER_API_KEY,
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

      await handleWeatherRequest(requestUrl, response, { apiKey, fetchImpl });
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
