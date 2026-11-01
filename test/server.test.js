import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createWeatherServer } from "../server.js";

const activeServers = new Set();

async function withServer(fetchImpl, run) {
  const server = createWeatherServer({ fetchImpl });
  activeServers.add(server);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    activeServers.delete(server);
  }
}

afterEach(async () => {
  await Promise.all(
    [...activeServers].map(
      (server) =>
        new Promise((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
  activeServers.clear();
});

const geocodingResponse = {
  results: [{ name: "Berlin", country: "Germany", latitude: 52.52, longitude: 13.41 }],
};

const forecastResponse = {
  current: {
    temperature_2m: 18,
    relative_humidity_2m: 52,
    apparent_temperature: 17,
    weather_code: 0,
    wind_speed_10m: 0,
    wind_direction_10m: 0,
    pressure_msl: 1014,
    visibility: 10_000,
  },
};

function openMeteoStub({ geocoding = geocodingResponse, forecast = forecastResponse } = {}) {
  const requestedUrls = [];

  return {
    requestedUrls,
    fetchImpl: async (url) => {
      const requestUrl = new URL(url);
      requestedUrls.push(requestUrl);
      if (requestUrl.hostname === "geocoding-api.open-meteo.com") {
        return new Response(JSON.stringify(geocoding), { status: 200 });
      }
      return new Response(JSON.stringify(forecast), { status: 200 });
    },
  };
}

describe("weather app server", () => {
  it("serves the page and only allowlisted static assets", async () => {
    const { fetchImpl } = openMeteoStub();
    await withServer(fetchImpl, async (baseUrl) => {
      const page = await fetch(baseUrl);
      assert.equal(page.status, 200);
      assert.match(await page.text(), /Weather Forecast/);

      const privateFile = await fetch(`${baseUrl}/.env`);
      assert.equal(privateFile.status, 404);
    });
  });

  it("rejects an empty city without calling Open-Meteo", async () => {
    let called = false;
    await withServer(
      async () => {
        called = true;
        throw new Error("Unexpected API call");
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/weather?city=%20`);
        assert.equal(response.status, 400);
        assert.equal(called, false);
      },
    );
  });

  it("geocodes a city and returns validated current weather", async () => {
    const { fetchImpl, requestedUrls } = openMeteoStub();
    await withServer(fetchImpl, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/weather?city=Berlin`);
      const data = await response.json();

      assert.equal(response.status, 200);
      assert.equal(data.name, "Berlin");
      assert.equal(data.country, "Germany");
      assert.equal(data.description, "Clear sky");
      assert.equal(data.current.temperature_2m, 18);
      assert.equal(requestedUrls.length, 2);
      assert.equal(requestedUrls[0].searchParams.get("name"), "Berlin");
      assert.equal(requestedUrls[1].searchParams.get("latitude"), "52.52");
      assert.equal(requestedUrls[1].searchParams.get("longitude"), "13.41");
      assert.match(requestedUrls[1].searchParams.get("current"), /temperature_2m/);
      assert.equal(requestedUrls[1].searchParams.get("wind_speed_unit"), "kmh");
      assert.equal(requestedUrls[1].searchParams.has("appid"), false);
    });
  });

  it("returns a helpful not-found error when geocoding finds no city", async () => {
    const { fetchImpl, requestedUrls } = openMeteoStub({ geocoding: { results: [] } });
    await withServer(fetchImpl, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/weather?city=NotARealCity`);
      assert.equal(response.status, 404);
      assert.match((await response.json()).error, /City not found/);
      assert.equal(requestedUrls.length, 1);
    });
  });

  it("rejects incomplete successful forecast responses", async () => {
    const { fetchImpl } = openMeteoStub({ forecast: { current: { temperature_2m: 18 } } });
    await withServer(fetchImpl, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/weather?city=Berlin`);
      assert.equal(response.status, 502);
      assert.match((await response.json()).error, /incomplete data/);
    });
  });

  it("maps Open-Meteo rate limits to a retryable user-facing error", async () => {
    await withServer(
      async () => new Response("{}", { status: 429 }),
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/weather?city=Berlin`);
        assert.equal(response.status, 429);
        assert.match((await response.json()).error, /limit reached/);
      },
    );
  });

  it("rejects unsupported weather codes instead of returning a broken card", async () => {
    const { fetchImpl } = openMeteoStub({
      forecast: {
        current: { ...forecastResponse.current, weather_code: 999 },
      },
    });
    await withServer(fetchImpl, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/weather?city=Berlin`);
      assert.equal(response.status, 502);
      assert.match((await response.json()).error, /unsupported weather condition/);
    });
  });
});
