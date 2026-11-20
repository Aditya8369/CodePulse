import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as zlib from 'zlib';

export type WhiteboardShapeType = 'box' | 'arrow' | 'text' | 'microservice' | 'database' | 'sticky_note';

export interface VectorShape {
  id: string;
  type: WhiteboardShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  color: string;
  fillColor?: string;
  fromNodeId?: string; // For arrows
  toNodeId?: string;   // For arrows
  authorId: string;
  version: number;
  updatedAt: number;
}

export interface WhiteboardSnapshot {
  battleId: string;
  shapes: Record<string, VectorShape>;
  viewport: { x: number; y: number; zoom: number };
  lastModifiedMs: number;
  version: number;
}

@Injectable()
export class WhiteboardService {
  private readonly logger = new Logger(WhiteboardService.name);
  private readonly whiteboards = new Map<string, WhiteboardSnapshot>();

  constructor(private readonly prisma: PrismaService) {}

  public getOrCreateWhiteboard(battleId: string): WhiteboardSnapshot {
    let board = this.whiteboards.get(battleId);
    if (!board) {
      board = {
        battleId,
        shapes: {},
        viewport: { x: 0, y: 0, zoom: 1 },
        lastModifiedMs: Date.now(),
        version: 1,
      };
      this.whiteboards.set(battleId, board);
    }
    return board;
  }

  /**
   * Applies an incremental shape update or batch of shapes with lock-free reconciliation
   */
  public applyShapeUpdate(
    battleId: string,
    shape: VectorShape,
  ): { shape: VectorShape; snapshotVersion: number } {
    const board = this.getOrCreateWhiteboard(battleId);
    const existing = board.shapes[shape.id];

    // Lock-free reconciliation: if incoming shape has newer or equal version/timestamp, accept it
    if (!existing || shape.version >= existing.version) {
      board.shapes[shape.id] = {
        ...shape,
        updatedAt: Date.now(),
      };
      board.version += 1;
      board.lastModifiedMs = Date.now();
    }

    return { shape: board.shapes[shape.id], snapshotVersion: board.version };
  }

  /**
   * Deletes a vector shape from the whiteboard
   */
  public deleteShape(battleId: string, shapeId: string): boolean {
    const board = this.getOrCreateWhiteboard(battleId);
    if (board.shapes[shapeId]) {
      delete board.shapes[shapeId];
      board.version += 1;
      board.lastModifiedMs = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Compresses binary shape delta updates for high-throughput streaming
   */
  public compressDelta(shapes: VectorShape[]): Buffer {
    const jsonStr = JSON.stringify(shapes);
    return zlib.deflateRawSync(Buffer.from(jsonStr, 'utf8'));
  }

  /**
   * Decompresses binary shape delta updates
   */
  public decompressDelta(buffer: Buffer): VectorShape[] {
    const decompressed = zlib.inflateRawSync(buffer);
    return JSON.parse(decompressed.toString('utf8'));
  }

  /**
   * Spatial indexing: returns shapes that intersect or are near a viewer's bounding box
   */
  public getShapesInViewport(
    battleId: string,
    bbox: { minX: number; minY: number; maxX: number; maxY: number },
  ): VectorShape[] {
    const board = this.getOrCreateWhiteboard(battleId);
    return Object.values(board.shapes).filter((s) => {
      // Bounding box intersection check
      return (
        s.x + s.width >= bbox.minX &&
        s.x <= bbox.maxX &&
        s.y + s.height >= bbox.minY &&
        s.y <= bbox.maxY
      );
    });
  }

  /**
   * Exports completed whiteboard design to SVG string
   */
  public exportToSvg(battleId: string): string {
    const board = this.getOrCreateWhiteboard(battleId);
    const shapes = Object.values(board.shapes);

    let maxX = 800;
    let maxY = 600;
    shapes.forEach((s) => {
      maxX = Math.max(maxX, s.x + s.width + 50);
      maxY = Math.max(maxY, s.y + s.height + 50);
    });

    const elements = shapes.map((s) => {
      switch (s.type) {
        case 'box':
        case 'sticky_note':
          return `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" fill="${s.fillColor || '#1e293b'}" stroke="${s.color}" stroke-width="2" rx="6"/><text x="${s.x + 10}" y="${s.y + s.height / 2 + 5}" fill="#f8fafc" font-size="14" font-family="sans-serif">${s.label || ''}</text>`;
        case 'microservice':
          return `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" fill="${s.fillColor || '#0369a1'}" stroke="${s.color}" stroke-width="3" rx="12"/><text x="${s.x + 12}" y="${s.y + s.height / 2 + 5}" fill="#ffffff" font-size="14" font-weight="bold" font-family="sans-serif">⚙️ ${s.label || 'Service'}</text>`;
        case 'database':
          return `<g><ellipse cx="${s.x + s.width / 2}" cy="${s.y + 15}" rx="${s.width / 2}" ry="15" fill="${s.fillColor || '#065f46'}" stroke="${s.color}" stroke-width="2"/><rect x="${s.x}" y="${s.y + 15}" width="${s.width}" height="${s.height - 30}" fill="${s.fillColor || '#065f46'}" stroke="${s.color}" stroke-width="2"/><ellipse cx="${s.x + s.width / 2}" cy="${s.y + s.height - 15}" rx="${s.width / 2}" ry="15" fill="${s.fillColor || '#065f46'}" stroke="${s.color}" stroke-width="2"/><text x="${s.x + 10}" y="${s.y + s.height / 2 + 5}" fill="#ffffff" font-size="14" font-weight="bold" font-family="sans-serif">🗄️ ${s.label || 'DB'}</text></g>`;
        case 'arrow':
          return `<line x1="${s.x}" y1="${s.y}" x2="${s.x + s.width}" y2="${s.y + s.height}" stroke="${s.color}" stroke-width="3" marker-end="url(#arrowhead)"/>`;
        case 'text':
          return `<text x="${s.x}" y="${s.y + 15}" fill="${s.color}" font-size="16" font-family="monospace">${s.label || ''}</text>`;
        default:
          return '';
      }
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${maxX} ${maxY}" width="${maxX}" height="${maxY}">
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#38bdf8" />
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="#0a0d14"/>
  ${elements.join('\n  ')}
</svg>`;
  }

  /**
   * Exports architecture layout to Mermaid.js graph format
   */
  public exportToMermaid(battleId: string): string {
    const board = this.getOrCreateWhiteboard(battleId);
    const shapes = Object.values(board.shapes);
    const lines = ['flowchart TD'];

    const nodeShapes = shapes.filter((s) => s.type !== 'arrow');
    const arrows = shapes.filter((s) => s.type === 'arrow');

    nodeShapes.forEach((s) => {
      const cleanId = s.id.replace(/[^a-zA-Z0-9_]/g, '_');
      const label = s.label || s.type;
      if (s.type === 'database') {
        lines.push(`  ${cleanId}[("${label}")]`);
      } else if (s.type === 'microservice') {
        lines.push(`  ${cleanId}["⚙️ ${label}"]`);
      } else {
        lines.push(`  ${cleanId}["${label}"]`);
      }
    });

    arrows.forEach((a) => {
      if (a.fromNodeId && a.toNodeId) {
        const from = a.fromNodeId.replace(/[^a-zA-Z0-9_]/g, '_');
        const to = a.toNodeId.replace(/[^a-zA-Z0-9_]/g, '_');
        const label = a.label ? `|${a.label}|` : '';
        lines.push(`  ${from} -->${label} ${to}`);
      }
    });

    return lines.join('\n');
  }

  /**
   * Saves completed whiteboard snapshot to PostgreSQL BattleWhiteboard model
   */
  public async saveSnapshotToDb(battleId: string): Promise<any> {
    const board = this.getOrCreateWhiteboard(battleId);
    const svgExport = this.exportToSvg(battleId);
    const mermaidSpec = this.exportToMermaid(battleId);

    const record = await this.prisma.battleWhiteboard.upsert({
      where: { battleId },
      update: {
        snapshot: JSON.parse(JSON.stringify(board)),
        svgExport,
        mermaidSpec,
        version: board.version,
      },
      create: {
        battleId,
        snapshot: JSON.parse(JSON.stringify(board)),
        svgExport,
        mermaidSpec,
        version: board.version,
      },
    });

    this.logger.log(`Persisted BattleWhiteboard snapshot for battle ${battleId}`);
    return record;
  }
}
