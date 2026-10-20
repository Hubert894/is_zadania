const form = document.querySelector("#weather-form");
const cityInput = document.querySelector("#city-input");
const searchButton = document.querySelector("#search-button");
const statusMessage = document.querySelector("#status-message");
const results = document.querySelector("#weather-results");
const currentWeather = document.querySelector("#current-weather");
const forecastList = document.querySelector("#forecast-list");

const API_BASE = "https://api.openweathermap.org/data/2.5";
const API_KEY = "7ded80d91f2b280ec979100cc8bbba94";

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const city = cityInput.value.trim();
    if (!city) {
        statusMessage.textContent = "Podaj miejscowość.";
        return;
    }

    searchButton.disabled = true;
    statusMessage.textContent = "Pobieranie aktualnej pogody i prognozy…";
    results.hidden = false;
    currentWeather.innerHTML = "";
    forecastList.innerHTML = "";

    const errors = [];
    let hasResults = false;
    try {
        const [currentResult, forecastResult] = await Promise.allSettled([
            loadCurrentWeather(city, API_KEY),
            loadForecast(city, API_KEY)
        ]);

        if (currentResult.status === "fulfilled") {
            try {
                renderCurrentWeather(currentResult.value);
                hasResults = true;
            } catch (error) {
                errors.push(`Pogoda bieżąca: ${error.message}`);
            }
        } else {
            errors.push(`Pogoda bieżąca: ${currentResult.reason.message}`);
        }

        if (forecastResult.status === "fulfilled") {
            try {
                renderForecast(forecastResult.value);
                hasResults = true;
            } catch (error) {
                errors.push(`Prognoza: ${error.message}`);
            }
        } else {
            errors.push(`Prognoza: ${forecastResult.reason.message}`);
        }
    } finally {
        searchButton.disabled = false;
    }

    statusMessage.textContent = errors.join(" ");
    results.hidden = !hasResults;
});

function loadCurrentWeather(city, apiKey) {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        const url = new URL(`${API_BASE}/weather`);
        url.search = new URLSearchParams({
            q: city,
            appid: apiKey,
            units: "metric",
            lang: "pl"
        }).toString();

        request.open("GET", url.toString());
        request.timeout = 15000;
        request.onload = () => {
            let data;
            try {
                data = JSON.parse(request.responseText);
            } catch {
                reject(new Error("serwer zwrócił nieprawidłową odpowiedź."));
                return;
            }

            if (request.status < 200 || request.status >= 300) {
                reject(new Error(getApiError(data, request.status)));
                return;
            }
            resolve(data);
        };
        request.onerror = () => reject(new Error("nie udało się połączyć z serwerem."));
        request.ontimeout = () => reject(new Error("przekroczono czas oczekiwania."));
        request.send();
    });
}

async function loadForecast(city, apiKey) {
    const params = new URLSearchParams({
        q: city,
        appid: apiKey,
        units: "metric",
        lang: "pl"
    });
    const response = await fetch(`${API_BASE}/forecast?${params}`);
    let data;
    try {
        data = await response.json();
    } catch {
        throw new Error("serwer zwrócił nieprawidłową odpowiedź.");
    }

    if (!response.ok) {
        throw new Error(getApiError(data, response.status));
    }
    return data;
}

function getApiError(data, status) {
    if (data && typeof data.message === "string" && data.message.length > 0) {
        return data.message;
    }
    return `błąd serwera (${status}).`;
}

function renderCurrentWeather(data) {
    const weather = data.weather[0];
    const icon = weatherIconUrl(weather.icon);
    const date = new Intl.DateTimeFormat("pl-PL", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "UTC"
    }).format(new Date((data.dt + data.timezone) * 1000));

    currentWeather.innerHTML = `
        <div class="current-main">
            <p class="current-place">${escapeHtml(data.name)}, ${escapeHtml(data.sys.country)}</p>
            <p class="current-date">${escapeHtml(date)}</p>
            <p class="current-description">${escapeHtml(weather.description)}</p>
        </div>
        <div class="current-temperature">
            <strong>${Math.round(data.main.temp)}°</strong>
            <img class="current-icon" src="${icon}" alt="${escapeHtml(weather.description)}">
        </div>
        <div class="current-details">
            <span>Odczuwalna <b>${Math.round(data.main.feels_like)}°C</b></span>
            <span>Wilgotność <b>${data.main.humidity}%</b></span>
            <span>Wiatr <b>${Math.round(data.wind.speed)} m/s</b></span>
            <span>Ciśnienie <b>${data.main.pressure} hPa</b></span>
        </div>`;
}

function renderForecast(data) {
    if (data.list.length === 0) {
        throw new Error("brak danych prognozy dla tej miejscowości.");
    }

    forecastList.innerHTML = data.list.slice(0, 5).map((item) => {
        const weather = item.weather[0];
        const localTime = new Date((item.dt + data.city.timezone) * 1000);
        const date = new Intl.DateTimeFormat("pl-PL", {
            weekday: "short",
            day: "numeric",
            month: "short",
            timeZone: "UTC"
        }).format(localTime);
        const time = new Intl.DateTimeFormat("pl-PL", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC"
        }).format(localTime);

        return `
            <article class="forecast-card">
                <p class="forecast-day">${escapeHtml(date)}</p>
                <p class="forecast-date">${escapeHtml(time)}</p>
                <img class="forecast-icon" src="${weatherIconUrl(weather.icon)}" alt="${escapeHtml(weather.description)}">
                <p class="forecast-description">${escapeHtml(weather.description)}</p>
                <div class="forecast-temperatures">
                    <span>${Math.round(item.main.temp)}°C</span>
                </div>
            </article>`;
    }).join("");
}

function weatherIconUrl(icon) {
    return `https://openweathermap.org/img/wn/${encodeURIComponent(icon)}@2x.png`;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    })[character]);
}
