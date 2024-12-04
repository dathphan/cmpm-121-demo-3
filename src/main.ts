// Imports
import Leaflet from "leaflet";
import "./leafletWorkaround.ts";
import "leaflet/dist/leaflet.css";
import luck from "./luck.ts";
import "./style.css";
import { Board, Cell } from "./board.ts";

interface Momento {
  toMomento(): string;
  fromMomento(momento: string): void;
}

interface Cache {
  coins: Coin[];
  div: HTMLDivElement;
}

interface Coin {
  cell: Cell;
  serial: number;
}

class Geocache implements Momento, Cache {
  coins: Coin[] = [];
  div: HTMLDivElement = document.createElement("div");

  constructor(cell: Cell, coinCount: number) {
    for (let i = 0; i < coinCount; i++) {
      // Create a new coin
      this.coins.push({ cell: cell, serial: i });
    }
  }

  toMomento(): string {
    return JSON.stringify(this.coins);
  }

  fromMomento(momento: string) {
    this.coins = JSON.parse(momento);
  }
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

// Variables
const playerCache: Cache = { coins: [], div: document.createElement("div") };
const caches: Map<Cell, Geocache> = new Map();
let modifiedCaches: Map<Cell, string> = new Map();
let usingGeolocation: boolean = false;
const polyLine: Leaflet.Polyline = Leaflet.polyline([ORIGIN], {
  color: "blue",
  weight: 3,
});

// Events
const coinsChanged: Event = new Event("coins-changed");
const playerMoved: Event = new Event("player-moved");

// Create Board and Map
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

// PLAYER

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
  iconAnchor: [22, 22],
  className: "player-icon",
});
const playerMarker = Leaflet.marker(ORIGIN, { icon: playerIcon });
playerMarker.bindTooltip("Your location");
playerMarker.addTo(map);

// Move Player
const movementDirections: Map<string, Leaflet.LatLng> = new Map([
  ["north", Leaflet.latLng(TILE_WIDTH, 0)],
  ["south", Leaflet.latLng(-TILE_WIDTH, 0)],
  ["west", Leaflet.latLng(0, -TILE_WIDTH)],
  ["east", Leaflet.latLng(0, TILE_WIDTH)],
]);
movementDirections.forEach((direction: Leaflet.LatLng, name: string) => {
  document.getElementById(name)!.addEventListener("click", () => {
    if (usingGeolocation) return;

    const oldLatLng = playerMarker.getLatLng();
    const newLatLng = Leaflet.latLng(
      oldLatLng.lat + direction.lat,
      oldLatLng.lng + direction.lng,
    );
    playerMarker.setLatLng(newLatLng);
    dispatchEvent(playerMoved);
  });
});

addEventListener("player-moved", () => {
  displayCacheOnMap(playerMarker.getLatLng());
  updatePolyline(playerMarker.getLatLng());
});

// CACHE

displayCacheOnMap(ORIGIN);

// Display Nearby Caches
function displayCacheOnMap(position: Leaflet.LatLng) {
  clearMapCaches();

  board.getCellsNearPoint(position).forEach((cell) => {
    if (luck((cell.i * cell.j).toString()) > CACHE_SPAWN_CHANCE) return;
    createCacheRect(cell);
  });
}

// Clear Map
function clearMapCaches() {
  map.eachLayer((layer: Leaflet.Layer) => {
    if (layer instanceof Leaflet.Rectangle) {
      map.removeLayer(layer);
    }
  });
  caches.clear();
}

function createCacheRect(cell: Cell) {
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

  // If new, create a new
  const cache = assignCache(cell);

  // Collect and Deposit Buttons
  createPopupButtons(cell, cache);

  caches.set(cell, cache);
  return cache.div;
}

function assignCache(cell: Cell): Geocache {
  const count: number = Math.ceil(
    luck((cell.i / cell.j).toString()) * MAX_CACHE_COINS_SPAWN,
  );
  const cache: Geocache = new Geocache(cell, count);

  if (modifiedCaches.has(cell)) {
    cache.fromMomento(modifiedCaches.get(cell)!);
  }
  return cache;
}

function createPopupButtons(cell: Cell, cache: Geocache): void {
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
    transferCoin(cache, playerCache);
    updateCachePopup(cache);
    momentoCache(cell, cache);
  });

  deposit.addEventListener("click", () => {
    transferCoin(playerCache, cache);
    updateCachePopup(cache);
    momentoCache(cell, cache);
  });
}

function transferCoin(sender: Cache, reciever: Cache) {
  if (sender.coins.length <= 0) return;
  reciever.coins.push(sender.coins.pop()!);
  playerCache.div.dispatchEvent(coinsChanged);
}

function momentoCache(cell: Cell, cache: Geocache): void {
  modifiedCaches.set(cell, cache.toMomento());
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

function coinToString(coin: Coin): string {
  return `${coin.cell.i}:${coin.cell.j}#${coin.serial}`;
}

// Geolocation
document.getElementById("geolocation")!.addEventListener("click", () => {
  usingGeolocation = !usingGeolocation;
  clearPolyLine();

  if (usingGeolocation) {
    map.locate({
      setView: true,
      watch: true,
      enableHighAccuracy: true,
    });
  } else {
    map.stopLocate();
    updatePolyline(playerMarker.getLatLng());
  }
});

function onLocationFound(event: Leaflet.LocationEvent) {
  playerMarker.setLatLng(event.latlng);
  dispatchEvent(playerMoved);
}

function onLocationError(event: Leaflet.ErrorEvent) {
  alert(event.message);
}

map.on("locationfound", onLocationFound);
map.on("locationerror", onLocationError);

// Polyline Trail
polyLine.addTo(map);

function updatePolyline(latLng: Leaflet.LatLng): void {
  polyLine.addLatLng(latLng);
}

function clearPolyLine(): void {
  polyLine.setLatLngs([]);
}

// Reset Game Progress
document.getElementById("reset")!.addEventListener("click", () => {
  const resetPrompt = prompt(
    "Are you sure you want to reset your progress?",
    "Yes",
  );
  if (resetPrompt == "Yes") {
    reset();
  }
});

function reset(): void {
  modifiedCaches = new Map();
  playerCache.coins = [];
  playerCache.div.dispatchEvent(coinsChanged);

  clearPolyLine();

  if (!usingGeolocation) {
    playerMarker.setLatLng(ORIGIN);
    dispatchEvent(playerMoved);
  }
}
