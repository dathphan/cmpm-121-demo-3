// Imports
import L from "leaflet";
import "./leafletWorkaround.ts";
import "leaflet/dist/leaflet.css";
import luck from "./luck.ts";
import "./style.css";

// App
const app = document.querySelector<HTMLDivElement>("#app")!;
const APP_NAME = "Geocoin Carrier";
document.title = APP_NAME;

// Parameters
const ORIGIN: L.LatLng = L.latLng(36.9895, -122.0628);
const ZOOM: number = 19;
const CACHE_SPAWN_COUNT: number = 12;
const CACHE_SPAWN_RADIUS: number = 0.001;
const MAX_CACHE_COINS_SPAWN: number = 64;
const SEED: string = "SEED";

// Variables
let playerCoins: number = 5;
const cachePopups: Map<L.LatLng, HTMLDivElement> = new Map();

// Events
const coinsChanged: Event = new Event("coins-changed");

// Handle Random
let _timesRandomRan: number = 0;
function setRandom(min: number = 0, max: number = 1): number {
  _timesRandomRan++;
  const rand = luck(SEED + _timesRandomRan);
  return rand * (max - min) + min;
}

// Create Map
const map = L.map(document.getElementById("map")!, {
  center: ORIGIN,
  zoom: ZOOM,
  zoomControl: false,
  scrollWheelZoom: false,
});

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: ZOOM,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

// Player Stats
const coinDisplay: HTMLDivElement = document.createElement("div");
coinDisplay.innerHTML = `Coins: ${playerCoins}`;
app.appendChild(coinDisplay);

coinDisplay.addEventListener("coins-changed", () => {
  // Update Coin Display
  coinDisplay.innerHTML = `Coins: ${playerCoins}`;
});

// Player Marker
const playerIcon = L.divIcon({
  html: "👤",
  iconAnchor: [16, 16],
  className: "player-icon",
});
const playerMarker = L.marker(ORIGIN, { icon: playerIcon });
playerMarker.bindTooltip("Your location");
playerMarker.addTo(map);

// Creating Caches
for (let i = 0; i < CACHE_SPAWN_COUNT; i++) {
  const lat = ORIGIN.lat + setRandom(-1, 1) * CACHE_SPAWN_RADIUS;
  const lng = ORIGIN.lng + setRandom(-1, 1) * CACHE_SPAWN_RADIUS;
  createCache(lat, lng);
}

function createCache(lat: number, lng: number) {
  const cacheMarker = L.marker(L.latLng(lat, lng));
  cacheMarker.bindPopup(cachePopup, L.latLng(lat, lng));
  cacheMarker.addTo(map);
}

function cachePopup(latLng: L.LatLng): HTMLDivElement {
  // Return popup if it already exists
  if (cachePopups.has(latLng)) {
    return cachePopups.get(latLng)!;
  }

  let coins: number = Math.ceil(setRandom(0, MAX_CACHE_COINS_SPAWN));
  const div: HTMLDivElement = document.createElement("div");

  // Collect and Deposit Buttons
  const collect: HTMLButtonElement = document.createElement("button");
  collect.innerHTML = "Collect";
  collect.id = "collect";
  div.appendChild(collect);

  const deposit: HTMLButtonElement = document.createElement("button");
  deposit.innerHTML = "Deposit";
  deposit.id = "deposit";
  div.appendChild(deposit);

  updateCachePopup(div, coins);

  div.querySelector<HTMLButtonElement>("#collect")!.addEventListener(
    "click",
    () => {
      if (coins <= 0) return;
      coins--;
      playerCoins++;
      updateCachePopup(div, coins);
      coinDisplay.dispatchEvent(coinsChanged);
    },
  );

  div.querySelector<HTMLButtonElement>("#deposit")!.addEventListener(
    "click",
    () => {
      if (playerCoins <= 0) return;
      coins++;
      playerCoins--;
      updateCachePopup(div, coins);
      coinDisplay.dispatchEvent(coinsChanged);
    },
  );

  cachePopups.set(latLng, div);
  return div;
}

function updateCachePopup(div: HTMLDivElement, coins: number): void {
  const collect = div.querySelector<HTMLButtonElement>("#collect")!;
  const deposit = div.querySelector<HTMLButtonElement>("#deposit")!;

  // Update coin value
  div.innerHTML = `Coins: ${coins}<div>`;
  div.appendChild(collect);
  div.appendChild(deposit);

  // Disable buttons depending on coin values
  collect.disabled = coins <= 0;
  deposit.disabled = playerCoins <= 0;
}
