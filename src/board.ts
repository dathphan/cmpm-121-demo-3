import Leaflet from "leaflet";

export interface Cell {
  readonly i: number;
  readonly j: number;
}

export class Board {
  readonly tileWidth: number;
  readonly tileVisibilityRadius: number;

  public readonly knownCells: Map<string, Cell>;

  constructor(tileWidth: number, tileVisibilityRadius: number) {
    this.tileWidth = tileWidth;
    this.tileVisibilityRadius = tileVisibilityRadius;
    this.knownCells = new Map();
  }

  private getCanonicalCell(cell: Cell): Cell {
    const { i, j } = cell;
    const key = [i, j].toString();

    if (!this.knownCells.has(key)) {
      this.knownCells.set(key, cell);
    }

    return this.knownCells.get(key)!;
  }

  getCellForPoint(point: Leaflet.LatLng): Cell {
    const cell: Cell = this.getCanonicalCell({
      i: Math.floor(point.lat / this.tileWidth),
      j: Math.floor(point.lng / this.tileWidth),
    });
    return cell;
  }

  getCellBounds(cell: Cell): Leaflet.LatLngBounds {
    const lowerBound: Leaflet.LatLng = Leaflet.latLng(
      cell.i * this.tileWidth,
      cell.j * this.tileWidth,
    );
    const upperBound: number = Leaflet.latLng(
      lowerBound.lat + this.tileWidth,
      lowerBound.lng + this.tileWidth,
    );
    return Leaflet.latLngBounds(lowerBound, upperBound);
  }

  getCellsNearPoint(point: Leaflet.LatLng): Cell[] {
    const resultCells: Cell[] = [];
    const originCell: Cell = this.getCellForPoint(point);

    for (
      let i = -this.tileVisibilityRadius;
      i < this.tileVisibilityRadius;
      i++
    ) {
      for (
        let j = -this.tileVisibilityRadius;
        j < this.tileVisibilityRadius;
        j++
      ) {
        const cell = { i: originCell.i + i, j: originCell.j + j };
        resultCells.push(this.getCanonicalCell(cell));
      }
    }

    return resultCells;
  }

  private isCellNextTo(cellA: Cell, cellB: Cell): boolean {
    return Math.abs(cellA.i - cellB.i) == 1 || Math.abs(cellA.j - cellB.j) == 1;
  }
}
