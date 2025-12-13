/**
 * Modern Weather App
 * Professional weather application with enhanced UX
 */

// ============================================
// Configuration
// ============================================

const CONFIG = {
    apiKey: "babff801af0304d6938a2e9ebfa3fdef",
    apiUrl: "https://api.openweathermap.org/data/2.5/weather",
    units: "metric",
    defaultCity: "London"
};

// ============================================
// DOM Elements
// ============================================

const elements = {
    form: document.getElementById("weatherForm"),
    cityInput: document.getElementById("cityInput"),
    weatherResult: document.getElementById("weatherResult"),
    loader: document.getElementById("loader"),
    errorMessage: document.getElementById("errorMessage"),
    submitBtn: document.querySelector(".submit-btn")
};

// ============================================
// State Management
// ============================================

const state = {
    isLoading: false,
    currentData: null
};

// ============================================
// Utility Functions
// ============================================

/**
 * Capitalize first letter of string
 */
function capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Format temperature with degree symbol
 */
function formatTemp(temp) {
    return `${Math.round(temp)}°C`;
}

/**
 * Format wind speed
 */
function formatWindSpeed(speed) {
    return `${speed.toFixed(1)} m/s`;
}

/**
 * Get weather emoji based on weather condition
 */
function getWeatherEmoji(weatherMain) {
    const emojiMap = {
        "Clear": "☀️",
        "Clouds": "☁️",
        "Rain": "🌧️",
        "Drizzle": "🌦️",
        "Thunderstorm": "⛈️",
        "Snow": "❄️",
        "Mist": "🌫️",
        "Fog": "🌫️",
        "Haze": "🌫️"
    };
    return emojiMap[weatherMain] || "🌤️";
}

/**
 * Get time of day (for future enhancements)
 */
function getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return "morning";
    if (hour >= 12 && hour < 18) return "afternoon";
    if (hour >= 18 && hour < 22) return "evening";
    return "night";
}

// ============================================
// UI Functions
// ============================================

/**
 * Show loading state
 */
function showLoader() {
    state.isLoading = true;
    elements.loader.style.display = "flex";
    elements.weatherResult.classList.add("hidden");
    elements.errorMessage.classList.remove("show");
    elements.submitBtn.disabled = true;
    elements.submitBtn.querySelector(".btn-text").textContent = "Searching...";
}

/**
 * Hide loading state
 */
function hideLoader() {
    state.isLoading = false;
    elements.loader.style.display = "none";
    elements.submitBtn.disabled = false;
    elements.submitBtn.querySelector(".btn-text").textContent = "Search";
}

/**
 * Show error message
 */
function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.classList.add("show");
    elements.weatherResult.classList.add("hidden");
    
    // Auto-hide error after 5 seconds
    setTimeout(() => {
        elements.errorMessage.classList.remove("show");
    }, 5000);
}

/**
 * Hide error message
 */
function hideError() {
    elements.errorMessage.classList.remove("show");
}

/**
 * Render weather data
 */
function renderWeather(data) {
    hideError();
    elements.weatherResult.classList.remove("hidden");
    
    const iconUrl = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
    const weatherMain = data.weather[0].main;
    const weatherDescription = capitalize(data.weather[0].description);
    const temp = formatTemp(data.main.temp);
    const feelsLike = formatTemp(data.main.feels_like);
    const humidity = data.main.humidity;
    const windSpeed = formatWindSpeed(data.wind.speed);
    const pressure = data.main.pressure;
    const visibility = data.visibility ? (data.visibility / 1000).toFixed(1) : "N/A";
    
    // Get wind direction if available
    const windDirection = data.wind.deg ? getWindDirection(data.wind.deg) : "N/A";
    
    elements.weatherResult.innerHTML = `
        <div class="weather-header">
            <div class="weather-location">
                <div class="weather-city">
                    <span>${data.name}</span>
                </div>
                <div class="weather-country">${data.sys.country}</div>
            </div>
            <img src="${iconUrl}" 
                 alt="${weatherDescription}" 
                 class="weather-icon-large"
                 loading="lazy">
        </div>
        
        <div class="weather-main">
            <div class="weather-temp">${temp}</div>
            <div class="weather-description">${weatherDescription}</div>
        </div>
        
        <div class="weather-details">
            <div class="weather-detail-item">
                <div class="detail-icon">🌡️</div>
                <div class="detail-label">Feels Like</div>
                <div class="detail-value">${feelsLike}</div>
            </div>
            
            <div class="weather-detail-item">
                <div class="detail-icon">💧</div>
                <div class="detail-label">Humidity</div>
                <div class="detail-value">${humidity}%</div>
            </div>
            
            <div class="weather-detail-item">
                <div class="detail-icon">💨</div>
                <div class="detail-label">Wind Speed</div>
                <div class="detail-value">${windSpeed}</div>
            </div>
            
            <div class="weather-detail-item">
                <div class="detail-icon">🧭</div>
                <div class="detail-label">Wind Direction</div>
                <div class="detail-value">${windDirection}</div>
            </div>
            
            <div class="weather-detail-item">
                <div class="detail-icon">📊</div>
                <div class="detail-label">Pressure</div>
                <div class="detail-value">${pressure} hPa</div>
            </div>
            
            <div class="weather-detail-item">
                <div class="detail-icon">👁️</div>
                <div class="detail-label">Visibility</div>
                <div class="detail-value">${visibility} km</div>
            </div>
        </div>
    `;
    
    // Store current data
    state.currentData = data;
    
    // Add fade-in animation
    elements.weatherResult.style.animation = "fadeInUp 0.5s ease-out";
}

/**
 * Get wind direction from degrees
 */
function getWindDirection(degrees) {
    const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", 
                       "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
}

// ============================================
// API Functions
// ============================================

/**
 * Fetch weather data from API
 */
async function fetchWeather(city) {
    const url = `${CONFIG.apiUrl}?q=${encodeURIComponent(city)}&appid=${CONFIG.apiKey}&units=${CONFIG.units}`;
    
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error("City not found. Please check the spelling and try again.");
            } else if (response.status === 401) {
                throw new Error("API key is invalid. Please check the configuration.");
            } else if (response.status === 429) {
                throw new Error("Too many requests. Please try again later.");
            } else {
                throw new Error(`Failed to fetch weather data. Status: ${response.status}`);
            }
        }
        
        const data = await response.json();
        
        if (!data || !data.weather || !data.main) {
            throw new Error("Invalid data received from the server.");
        }
        
        return data;
    } catch (error) {
        if (error instanceof TypeError && error.message.includes("fetch")) {
            throw new Error("Network error. Please check your internet connection.");
        }
        throw error;
    }
}

// ============================================
// Event Handlers
// ============================================

/**
 * Handle form submission
 */
async function handleSubmit(e) {
    e.preventDefault();
    
    const city = elements.cityInput.value.trim();
    
    if (!city) {
        showError("Please enter a city name.");
        elements.cityInput.focus();
        return;
    }
    
    if (state.isLoading) {
        return;
    }
    
    showLoader();
    
    try {
        const data = await fetchWeather(city);
        renderWeather(data);
    } catch (error) {
        console.error("Weather fetch error:", error);
        showError(error.message || "An unexpected error occurred. Please try again.");
    } finally {
        hideLoader();
    }
}

/**
 * Handle input validation
 */
function handleInputChange() {
    if (elements.errorMessage.classList.contains("show")) {
        hideError();
    }
}

// ============================================
// Event Listeners
// ============================================

elements.form.addEventListener("submit", handleSubmit);
elements.cityInput.addEventListener("input", handleInputChange);
elements.cityInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !state.isLoading) {
        elements.form.dispatchEvent(new Event("submit"));
    }
});

// ============================================
// Initialize App
// ============================================

/**
 * Initialize the application
 */
function init() {
    // Focus input on load
    elements.cityInput.focus();
    
    // Add smooth transitions
    document.body.style.opacity = "0";
    setTimeout(() => {
        document.body.style.transition = "opacity 0.3s ease-in";
        document.body.style.opacity = "1";
    }, 10);
    
    console.log("Weather App initialized successfully");
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
