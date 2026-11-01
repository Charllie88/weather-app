import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createWeatherServer } from "../server.js";

const activeServers = new Set();

async function withServer(options, run) {
  const server = createWeatherServer(options);
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

const validWeather = {
  name: "London",
  sys: { country: "GB" },
  weather: [{ description: "clear sky", icon: "01d" }],
  main: { temp: 18, feels_like: 17, humidity: 52, pressure: 1014 },
  wind: { speed: 0, deg: 0 },
  visibility: 10_000,
};

describe("weather app server", () => {
  it("serves the page and only allowlisted static assets", async () => {
    await withServer({}, async (baseUrl) => {
      const page = await fetch(baseUrl);
      assert.equal(page.status, 200);
      assert.match(await page.text(), /Weather Forecast/);

      const privateFile = await fetch(`${baseUrl}/.env`);
      assert.equal(privateFile.status, 404);
    });
  });

  it("rejects an empty city without calling the weather API", async () => {
    let called = false;
    await withServer(
      {
        apiKey: "test-key",
        fetchImpl: async () => {
          called = true;
          throw new Error("Unexpected API call");
        },
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/weather?city=%20`);
        assert.equal(response.status, 400);
        assert.equal(called, false);
      },
    );
  });

  it("reports missing server configuration clearly", async () => {
    await withServer({ apiKey: "" }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/weather?city=London`);
      assert.equal(response.status, 503);
      assert.match((await response.json()).error, /not configured/);
    });
  });

  it("requests and returns validated weather data without exposing the key to the browser", async () => {
    let requestedUrl;
    await withServer(
      {
        apiKey: "server-only-test-key",
        fetchImpl: async (url) => {
          requestedUrl = new URL(url);
          return new Response(JSON.stringify(validWeather), { status: 200 });
        },
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/weather?city=New%20York`);
        assert.equal(response.status, 200);
        assert.equal((await response.json()).name, "London");
        assert.equal(requestedUrl.searchParams.get("q"), "New York");
        assert.equal(requestedUrl.searchParams.get("appid"), "server-only-test-key");
        assert.equal(requestedUrl.searchParams.get("units"), "metric");
      },
    );
  });

  it("maps an unknown city to a helpful not-found response", async () => {
    await withServer(
      {
        apiKey: "test-key",
        fetchImpl: async () => new Response("{}", { status: 404 }),
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/weather?city=NotARealCity`);
        assert.equal(response.status, 404);
        assert.match((await response.json()).error, /City not found/);
      },
    );
  });

  it("rejects malformed successful responses", async () => {
    await withServer(
      {
        apiKey: "test-key",
        fetchImpl: async () => new Response(JSON.stringify({ weather: [] }), { status: 200 }),
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/weather?city=London`);
        assert.equal(response.status, 502);
        assert.match((await response.json()).error, /incomplete data/);
      },
    );
  });
});
