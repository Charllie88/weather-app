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
      <img class="weather-icon-large" alt="" width="80" height="80">
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
  const weather = data.weather[0];
  const icon = weatherCard.querySelector(".weather-icon-large");

  weatherCard.querySelector(".weather-city").textContent = data.name;
  weatherCard.querySelector(".weather-country").textContent =
    typeof data.sys?.country === "string" ? data.sys.country : "";
  weatherCard.querySelector(".weather-temp").textContent = formatTemperature(data.main.temp);
  weatherCard.querySelector(".weather-description").textContent = weather.description;
  icon.src = `https://openweathermap.org/img/wn/${weather.icon}@2x.png`;
  icon.alt = `Weather: ${weather.description}`;

  const values = [
    formatTemperature(data.main.feels_like),
    `${data.main.humidity}%`,
    `${data.wind.speed.toFixed(1)} m/s`,
    formatWindDirection(data.wind.deg),
    `${data.main.pressure} hPa`,
    Number.isFinite(data.visibility) ? `${(data.visibility / 1000).toFixed(1)} km` : "N/A",
  ];

  weatherCard.querySelectorAll(".detail-value").forEach((value, index) => {
    value.textContent = values[index];
  });

  elements.weatherResult.replaceChildren(weatherCard);
  elements.weatherResult.hidden = false;
}

async function fetchWeather(city) {
  let response;
  try {
    response = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
  } catch {
    throw new Error("Network error. Check your connection and try again.");
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("The weather server returned an invalid response.");
  }

  if (!response.ok) {
    throw new Error(data?.error || "Unable to retrieve weather. Try again later.");
  }

  return data;
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
