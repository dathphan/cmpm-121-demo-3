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

class Renderer {
  public map: Leaflet.Map;
  private playerMarker: Leaflet.Marker;
  private polyline: Leaflet.Polyline;

  constructor(mapContainerId: string, origin: Leaflet.LatLng, zoom: number) {
    // Initialize the map
    this.map = Leaflet.map(mapContainerId, {
      center: origin,
      zoom: zoom,
      zoomControl: false,
      scrollWheelZoom: false,
    });

    // Add the tile layer
    Leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: zoom,
      attribution:
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(this.map);

    // Create the player marker
    const playerIcon = Leaflet.divIcon({
      html: "👤",
      iconAnchor: [22, 22],
      className: "player-icon",
    });

    this.playerMarker = Leaflet.marker(origin, { icon: playerIcon });
    this.playerMarker.bindTooltip("Your location");
    this.playerMarker.addTo(this.map);

    this.polyline = Leaflet.polyline([], { color: "blue", weight: 3 });
    this.polyline.addTo(this.map);
  }

  updatePlayerPosition(position: Leaflet.LatLng): void {
    this.playerMarker.setLatLng(position);
    this.polyline.addLatLng(position);
    console.log("MOVED TO: " + position);
  }

  getPlayerPosition(): Leaflet.LatLng {
    return this.playerMarker.getLatLng();
  }

  clearPolyLine(): void {
    this.polyline.setLatLngs([]);
  }

  displayMessage(message: string): void {
    alert(message);
  }
}

const renderer = new Renderer("map", ORIGIN, ZOOM);

// PLAYER
class Player {
  private latLng: Leaflet.LatLng;

  constructor(initialPosition: Leaflet.LatLng) {
    this.latLng = initialPosition;
  }

  move(direction: Leaflet.LatLng): void {
    const newLatLng = Leaflet.latLng(
      this.latLng.lat + direction.lat,
      this.latLng.lng + direction.lng,
    );
    this.setLatLng(newLatLng);
  }

  setLatLng(latLng: Leaflet.LatLng): void {
    this.latLng = latLng;
    dispatchEvent(playerMoved);
  }

  getLatLng(): Leaflet.LatLng {
    return this.latLng;
  }
}

const player: Player = new Player(ORIGIN);

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

    player.move(direction);
  });
});

addEventListener("player-moved", () => {
  renderer.updatePlayerPosition(player.getLatLng());
  displayCacheOnMap(player.getLatLng());
  updatePolyline(player.getLatLng());
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
  renderer.map.eachLayer((layer: Leaflet.Layer) => {
    if (layer instanceof Leaflet.Rectangle) {
      renderer.map.removeLayer(layer);
    }
  });
  caches.clear();
}

function createCacheRect(cell: Cell) {
  const bounds: Leaflet.LatLngBounds = board.getCellBounds(cell);

  const rect = Leaflet.rectangle(bounds);
  rect.bindPopup(() => cachePopup(cell));
  rect.addTo(renderer.map);
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
  renderer.clearPolyLine();

  if (usingGeolocation) {
    renderer.map.locate({
      setView: true,
      watch: true,
      enableHighAccuracy: true,
    });
  } else {
    renderer.map.stopLocate();
    updatePolyline(renderer.getPlayerPosition());
  }
});

function onLocationFound(event: Leaflet.LocationEvent) {
  player.setLatLng(event.latlng);
  dispatchEvent(playerMoved);
}

function onLocationError(event: Leaflet.ErrorEvent) {
  alert(event.message);
}

renderer.map.on("locationfound", onLocationFound);
renderer.map.on("locationerror", onLocationError);

// Polyline Trail
polyLine.addTo(renderer.map);

function updatePolyline(latLng: Leaflet.LatLng): void {
  polyLine.addLatLng(latLng);
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

  renderer.clearPolyLine();

  if (!usingGeolocation) {
    renderer.updatePlayerPosition(ORIGIN);
    dispatchEvent(playerMoved);
  }
}
