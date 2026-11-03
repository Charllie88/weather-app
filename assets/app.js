const elements = {
  form: document.getElementById("weatherForm"),
  cityInput: document.getElementById("cityInput"),
  weatherResult: document.getElementById("weatherResult"),
  loader: document.getElementById("loader"),
  errorMessage: document.getElementById("errorMessage"),
  submitButton: document.querySelector(".submit-btn"),
};

const state = {
  isLoading: false,
  errorTimer: null,
};

const weatherCardTemplate = `
  <article class="weather-card" aria-labelledby="weatherCity">
    <header class="weather-header">
      <div class="weather-location">
        <h2 class="weather-city" id="weatherCity"></h2>
        <p class="weather-country"></p>
      </div>
      <span class="weather-icon-large" aria-hidden="true"></span>
    </header>
    <div class="weather-main">
      <p class="weather-temp"></p>
      <p class="weather-description"></p>
    </div>
    <dl class="weather-details">
      <div class="weather-detail-item">
        <dt><span class="detail-icon" aria-hidden="true">🌡️</span><span class="detail-label">Feels Like</span></dt>
        <dd class="detail-value"></dd>
      </div>
      <div class="weather-detail-item">
        <dt><span class="detail-icon" aria-hidden="true">💧</span><span class="detail-label">Humidity</span></dt>
        <dd class="detail-value"></dd>
      </div>
      <div class="weather-detail-item">
        <dt><span class="detail-icon" aria-hidden="true">💨</span><span class="detail-label">Wind Speed</span></dt>
        <dd class="detail-value"></dd>
      </div>
      <div class="weather-detail-item">
        <dt><span class="detail-icon" aria-hidden="true">🧭</span><span class="detail-label">Wind Direction</span></dt>
        <dd class="detail-value"></dd>
      </div>
      <div class="weather-detail-item">
        <dt><span class="detail-icon" aria-hidden="true">📊</span><span class="detail-label">Pressure</span></dt>
        <dd class="detail-value"></dd>
      </div>
      <div class="weather-detail-item">
        <dt><span class="detail-icon" aria-hidden="true">👁️</span><span class="detail-label">Visibility</span></dt>
        <dd class="detail-value"></dd>
      </div>
    </dl>
  </article>
`;

function isValidWeatherData(data) {
  return (
    typeof data?.name === "string" &&
    typeof data?.description === "string" &&
    Number.isFinite(data?.current?.temperature_2m) &&
    Number.isFinite(data?.current?.apparent_temperature) &&
    Number.isFinite(data?.current?.relative_humidity_2m) &&
    Number.isFinite(data?.current?.weather_code) &&
    Number.isFinite(data?.current?.wind_speed_10m) &&
    Number.isFinite(data?.current?.wind_direction_10m) &&
    Number.isFinite(data?.current?.pressure_msl)
  );
}

function formatTemperature(value) {
  return `${Math.round(value)}°C`;
}

function formatWindDirection(degrees) {
  if (!Number.isFinite(degrees)) {
    return "N/A";
  }

  const directions = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  return directions[Math.round(degrees / 22.5) % directions.length];
}

function getWeatherIcon(code) {
  if (code === 0) return "☀️";
  if (code === 1 || code === 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if ([51, 53, 55, 56, 57].includes(code)) return "🌦️";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "🌧️";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "🌨️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  return "🌡️";
}

function showLoader() {
  state.isLoading = true;
  elements.loader.hidden = false;
  elements.weatherResult.hidden = true;
  elements.weatherResult.setAttribute("aria-busy", "true");
  elements.errorMessage.hidden = true;
  elements.submitButton.disabled = true;
  elements.cityInput.disabled = true;
  elements.submitButton.querySelector(".btn-text").textContent = "Searching...";
}

function hideLoader() {
  state.isLoading = false;
  elements.loader.hidden = true;
  elements.weatherResult.setAttribute("aria-busy", "false");
  elements.submitButton.disabled = false;
  elements.cityInput.disabled = false;
  elements.submitButton.querySelector(".btn-text").textContent = "Search";
}

function showError(message) {
  window.clearTimeout(state.errorTimer);
  elements.errorMessage.textContent = message;
  elements.errorMessage.hidden = false;
  elements.weatherResult.hidden = true;
  state.errorTimer = window.setTimeout(() => {
    elements.errorMessage.hidden = true;
  }, 8000);
}

function hideError() {
  window.clearTimeout(state.errorTimer);
  state.errorTimer = null;
  elements.errorMessage.hidden = true;
}

function renderWeather(data) {
  if (!isValidWeatherData(data)) {
    throw new Error("The weather service returned incomplete data. Try another search.");
  }

  const card = document.createElement("template");
  card.innerHTML = weatherCardTemplate;
  const weatherCard = card.content.firstElementChild;
  const current = data.current;

  weatherCard.querySelector(".weather-city").textContent = data.name;
  weatherCard.querySelector(".weather-country").textContent =
    typeof data.country === "string" ? data.country : "";
  weatherCard.querySelector(".weather-temp").textContent =
    formatTemperature(current.temperature_2m);
  weatherCard.querySelector(".weather-description").textContent = data.description;
  weatherCard.querySelector(".weather-icon-large").textContent =
    getWeatherIcon(current.weather_code);

  const values = [
    formatTemperature(current.apparent_temperature),
    `${current.relative_humidity_2m}%`,
    `${current.wind_speed_10m.toFixed(1)} km/h`,
    formatWindDirection(current.wind_direction_10m),
    `${Math.round(current.pressure_msl)} hPa`,
    Number.isFinite(current.visibility) ? `${(current.visibility / 1000).toFixed(1)} km` : "N/A",
  ];

  weatherCard.querySelectorAll(".detail-value").forEach((value, index) => {
    value.textContent = values[index];
  });

  elements.weatherResult.replaceChildren(weatherCard);
  elements.weatherResult.hidden = false;
}

async function fetchWeather(city) {
  const geocodingUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
  geocodingUrl.searchParams.set("name", city);
  geocodingUrl.searchParams.set("count", "1");
  geocodingUrl.searchParams.set("language", "en");
  geocodingUrl.searchParams.set("format", "json");

  const geocodingResponse = await fetchOpenMeteoJson(geocodingUrl);
  const location = geocodingResponse?.results?.[0];
  if (
    typeof location?.name !== "string" ||
    !Number.isFinite(location.latitude) ||
    !Number.isFinite(location.longitude)
  ) {
    throw new Error("City not found. Check the spelling and try again.");
  }

  const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
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

  const forecastResponse = await fetchOpenMeteoJson(forecastUrl);
  const current = forecastResponse?.current;
  if (
    !Number.isFinite(current?.temperature_2m) ||
    !Number.isFinite(current?.apparent_temperature) ||
    !Number.isFinite(current?.relative_humidity_2m) ||
    !Number.isFinite(current?.weather_code) ||
    !Number.isFinite(current?.wind_speed_10m) ||
    !Number.isFinite(current?.wind_direction_10m) ||
    !Number.isFinite(current?.pressure_msl) ||
    !Number.isFinite(current?.visibility)
  ) {
    throw new Error("The weather service returned incomplete data. Try again.");
  }

  const description = getWeatherDescription(current.weather_code);
  if (!description) {
    throw new Error("The weather service returned an unsupported weather condition.");
  }

  return {
    name: location.name,
    country: location.country,
    current,
    description,
  };
}

async function fetchOpenMeteoJson(url) {
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new Error("Unable to reach the weather service. Check your connection and try again.");
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("The weather service returned an invalid response.");
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Weather search limit reached. Try again later.");
    }
    throw new Error("The weather service could not complete this request.");
  }

  return data;
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

async function handleSubmit(event) {
  event.preventDefault();
  if (state.isLoading) {
    return;
  }

  const city = elements.cityInput.value.trim();
  if (!city) {
    showError("Please enter a city name.");
    elements.cityInput.focus();
    return;
  }

  if (city.length > 100) {
    showError("City names must be 100 characters or fewer.");
    elements.cityInput.focus();
    return;
  }

  hideError();
  showLoader();

  try {
    const data = await fetchWeather(city);
    renderWeather(data);
  } catch (error) {
    console.error("Weather search failed:", error);
    showError(error instanceof Error ? error.message : "An unexpected error occurred.");
  } finally {
    hideLoader();
  }
}

elements.form.addEventListener("submit", handleSubmit);
elements.cityInput.addEventListener("input", hideError);
