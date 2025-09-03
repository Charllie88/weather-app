const apiKey = "babff801af0304d6938a2e9ebfa3fdef";
const form = document.getElementById("weatherForm");
const cityInput = document.getElementById("cityInput");
const weatherResult = document.getElementById("weatherResult");
const loader = document.getElementById("loader");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const city = cityInput.value.trim();
  if (!city) return;
  weatherResult.innerHTML = "";
  loader.style.display = "block";
  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
        city
      )}&appid=${apiKey}&units=metric`
    );
    if (!response.ok) {
      throw new Error("City not found. Please check the city name.");
    }
    const data = await response.json();
    const iconUrl = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
    weatherResult.innerHTML = `
      <h2><img src="${iconUrl}" alt="${
      data.weather[0].description
    }" width="48" height="48">${data.name}, ${data.sys.country}</h2>
      <p><strong>${capitalize(data.weather[0].main)}</strong> - ${capitalize(
      data.weather[0].description
    )}</p>
      <p>🌡️ Temperature: <b>${Math.round(data.main.temp)}°C</b></p>
      <p>🤗 Feels like: ${Math.round(data.main.feels_like)}°C</p>
      <p>💧 Humidity: ${data.main.humidity}%</p>
      <p>💨 Wind: ${data.wind.speed} m/s</p>
    `;
  } catch (error) {
    weatherResult.innerHTML = `<span style="color:#d90429;">${error.message}</span>`;
  } finally {
    loader.style.display = "none";
  }
});

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
