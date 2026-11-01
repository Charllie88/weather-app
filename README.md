# Weather App

A responsive weather app built with HTML, CSS, and vanilla JavaScript. Search for a city to view current conditions, temperature, humidity, wind, pressure, and visibility.

## Requirements

- Node.js 20.6 or newer
- An OpenWeatherMap API key

The project has no third-party runtime or development dependencies.

## Setup

Set the API key in your environment, then start the app from the project directory.

**PowerShell**

```powershell
$env:OPENWEATHER_API_KEY = "your-new-api-key"
npm start
```

**macOS / Linux**

```sh
export OPENWEATHER_API_KEY="your-new-api-key"
npm start
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Do not open `index.html` directly; the app uses the local server for both static files and the weather API proxy.

## Scripts

| Command | Description |
| --- | --- |
| `npm start` | Start the static app server and same-origin weather API proxy. |
| `npm test` | Run the built-in Node.js server tests. |

Set `PORT` to change the server port. Set `HOST=0.0.0.0` only when the app needs to be reachable from outside the local machine.

## Project structure

```text
.
├── assets/
│   ├── app.js          # Search, accessible UI states, and weather rendering
│   ├── style.css       # Responsive layout, design tokens, and motion styles
│   └── icons/          # Reserved weather icon assets
├── test/
│   └── server.test.js  # HTTP and API-proxy tests using node:test
├── index.html          # Accessible app markup
├── server.js           # Static file server and OpenWeatherMap proxy
└── package.json        # Start and test scripts (no dependencies)
```

## API key security

The browser requests weather data from `/api/weather`; the server adds `OPENWEATHER_API_KEY` when it contacts OpenWeatherMap. Keep the key in the server environment and never put it in `assets/app.js`, HTML, or a public environment file.

**The API key previously committed to this repository must be revoked or rotated in OpenWeatherMap before using or deploying this version.** Removing a key from the latest source does not remove it from Git history.

## Current scope

This app shows current weather for one searched city at a time. Forecasts, saved locations, and geolocation are not implemented.
