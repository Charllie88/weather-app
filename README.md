# Weather App

A responsive weather app built with HTML, CSS, and vanilla JavaScript. Search for a city to view current conditions, temperature, humidity, wind, pressure, and visibility. City search uses Open-Meteo Geocoding; weather conditions come from the Open-Meteo Forecast API.

## Live demo

The GitHub Pages deployment is configured to publish from the `main` branch using GitHub Actions. After Pages is enabled for the repository and the deployment workflow succeeds, the demo will be available at:

https://charllie88.github.io/weather-app/

## Requirements

- Node.js 18 or newer

The app uses Open-Meteo's public APIs and needs no API key or third-party packages.

## Run locally

```sh
npm start
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Do not open `index.html` directly; run the local server so city search can use the same-origin API proxy.

Set `PORT` to change the port. The server binds to `127.0.0.1` by default; set `HOST=0.0.0.0` only when access from another device is intended.

## Tests

```sh
npm test
```

Tests use Node's built-in test runner and stub Open-Meteo responses; they do not require a key or make live API requests.

## Project structure

```text
.
├── assets/
│   ├── app.js          # Search, accessible UI states, and weather rendering
│   ├── style.css       # Responsive layout, design tokens, and motion styles
│   └── icons/          # Reserved weather icon assets
├── test/
│   └── server.test.js  # HTTP and Open-Meteo proxy tests
├── index.html          # App markup
├── server.js           # Static file server and weather API proxy
└── package.json        # Start/test scripts; no third-party dependencies
```

## Data and privacy

When deployed to GitHub Pages, the browser sends the city name to Open-Meteo Geocoding, then requests current weather from Open-Meteo Forecast using the resolved coordinates. No API key is required. Search terms are sent to Open-Meteo to resolve a location. Weather data is attributed in the app footer.

For local development, `npm start` serves the static app and proxies weather requests through the included Node server.

The app displays current weather for one searched city at a time. Forecast views, saved locations, and geolocation are not implemented.

## Previously exposed OpenWeatherMap key

An older version of this repository included an OpenWeatherMap API key in its public Git history. This version no longer uses that key. Revoke or rotate it with OpenWeatherMap; removing it from the latest source does not erase it from prior commits.
