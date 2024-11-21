// Imports
import Leaflet from "leaflet";
import "./leafletWorkaround.ts";
import "leaflet/dist/leaflet.css";
import luck from "./luck.ts";
import "./style.css";
import { Board, Cell } from "./board.ts";

interface Cache {
  coins: Coin[];
  div: HTMLDivElement;
}

interface Coin {
  cell: Cell;
  serial: number;
}

// App
const app = document.querySelector<HTMLDivElement>("#app")!;
const APP_NAME = "Geocoin Carrier";
document.title = APP_NAME;

// Parameters
const ORIGIN: Leaflet.LatLng = Leaflet.latLng(36.9895, -122.0628);
const ZOOM: number = 19;
const CACHE_SPAWN_CHANCE: number = 0.1;
const MAX_CACHE_COINS_SPAWN: number = 3;

const TILE_WIDTH: number = 0.0001;
const TILE_VISIBILITY_RADIUS: number = 8;

const SEED: string = "SEED";

// Variables
const playerCache: Cache = { coins: [], div: document.createElement("div") };
const caches: Map<Cell, Cache> = new Map();

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
const board: Board = new Board(TILE_WIDTH, TILE_VISIBILITY_RADIUS);
const map = Leaflet.map(document.getElementById("map")!, {
  center: ORIGIN,
  zoom: ZOOM,
  zoomControl: false,
  scrollWheelZoom: false,
});

Leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: ZOOM,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

// Player Stats
playerCache.div.innerHTML = `Coins:`;
app.appendChild(playerCache.div);

playerCache.div.addEventListener("coins-changed", () => {
  // Update Coin Display
  playerCache.div.innerHTML = `Coins: <div>`;
  playerCache.coins.forEach((coin) => {
    playerCache.div.innerHTML += `${coinToString(coin)}<div>`;
  });
});

// Player Marker
const playerIcon = Leaflet.divIcon({
  html: "👤",
  iconAnchor: [16, 16],
  className: "player-icon",
});
const playerMarker = Leaflet.marker(ORIGIN, { icon: playerIcon });
playerMarker.bindTooltip("Your location");
playerMarker.addTo(map);

// Spawn Caches Nearby
board.getCellsNearPoint(ORIGIN).forEach((cell) => {
  if (setRandom() > CACHE_SPAWN_CHANCE) return;
  createCache(cell);
});

function createCache(cell: Cell) {
  const bounds: Leaflet.LatLngBounds = board.getCellBounds(cell);

  const rect = Leaflet.rectangle(bounds);
  rect.bindPopup(() => cachePopup(cell));
  rect.addTo(map);
}

function cachePopup(cell: Cell): HTMLDivElement {
  // Return popup if it already exists
  if (caches.has(cell)) {
    updateCachePopup(caches.get(cell)!);
    return caches.get(cell)!.div;
  }

  const cache: Cache = newCoinCache(cell, setRandom(0, MAX_CACHE_COINS_SPAWN));

  // Collect and Deposit Buttons
  const collect: HTMLButtonElement = document.createElement("button");
  collect.innerHTML = "Collect";
  collect.id = "collect";
  cache.div.appendChild(collect);

  const deposit: HTMLButtonElement = document.createElement("button");
  deposit.innerHTML = "Deposit";
  deposit.id = "deposit";
  cache.div.appendChild(deposit);

  updateCachePopup(cache);

  collect.addEventListener("click", () => {
    if (cache.coins.length <= 0) return;
    playerCache.coins.push(cache.coins.pop()!);
    updateCachePopup(cache);
    playerCache.div.dispatchEvent(coinsChanged);
  });

  deposit.addEventListener("click", () => {
    if (playerCache.coins.length <= 0) return;
    cache.coins.push(playerCache.coins.pop()!);
    updateCachePopup(cache);
    playerCache.div.dispatchEvent(coinsChanged);
  });

  caches.set(cell, cache);
  return cache.div;
}

function updateCachePopup(cache: Cache): void {
  const collect = cache.div.querySelector<HTMLButtonElement>("#collect")!;
  const deposit = cache.div.querySelector<HTMLButtonElement>("#deposit")!;

  // Update coin value
  cache.div.innerHTML = `Coins:<div>`;
  cache.coins.forEach((coin) => {
    cache.div.innerHTML += `${coinToString(coin)}<div>`;
  });
  cache.div.appendChild(collect);
  cache.div.appendChild(deposit);

  // Disable buttons depending on coin values
  collect.disabled = cache.coins.length <= 0;
  deposit.disabled = playerCache.coins.length <= 0;
}

function newCoinCache(cell: Cell, count: number): Cache {
  const cache: Cache = { coins: [], div: document.createElement("div") };
  for (let i = 0; i < count; i++) {
    // Create a new coin
    cache.coins.push({ cell: cell, serial: i });
  }

  return cache;
}

function coinToString(coin: Coin): string {
  return `${coin.cell.i}:${coin.cell.j}#${coin.serial}`;
}
