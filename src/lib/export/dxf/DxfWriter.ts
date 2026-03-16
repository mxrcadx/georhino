import { DXF_VERSION, INSUNITS_FEET, MEASUREMENT_ENGLISH } from './dxfConstants';
import { DXF_LAYERS } from './dxfLayers';

export class DxfWriter {
  private handleCounter = 0x100;
  private entities: string[] = [];
  private extMin = [Infinity, Infinity, Infinity];
  private extMax = [-Infinity, -Infinity, -Infinity];

  private nextHandle(): string {
    return (this.handleCounter++).toString(16).toUpperCase();
  }

  private updateExtents(x: number, y: number, z = 0) {
    this.extMin[0] = Math.min(this.extMin[0], x);
    this.extMin[1] = Math.min(this.extMin[1], y);
    this.extMin[2] = Math.min(this.extMin[2], z);
    this.extMax[0] = Math.max(this.extMax[0], x);
    this.extMax[1] = Math.max(this.extMax[1], y);
    this.extMax[2] = Math.max(this.extMax[2], z);
  }

  addLwPolyline(layer: string, vertices: number[][], closed = false) {
    const handle = this.nextHandle();
    let entity = '';
    entity += '  0\nLWPOLYLINE\n';
    entity += `  5\n${handle}\n`;
    entity += '  100\nAcDbEntity\n';
    entity += `  8\n${layer}\n`;
    entity += '  100\nAcDbPolyline\n';
    entity += `  90\n${vertices.length}\n`;
    entity += `  70\n${closed ? 1 : 0}\n`;

    for (const [x, y] of vertices) {
      entity += `  10\n${x.toFixed(4)}\n`;
      entity += `  20\n${y.toFixed(4)}\n`;
      this.updateExtents(x, y);
    }

    this.entities.push(entity);
  }

  add3dPolyline(layer: string, vertices: number[][]) {
    const polyHandle = this.nextHandle();
    let entity = '';
    entity += '  0\nPOLYLINE\n';
    entity += `  5\n${polyHandle}\n`;
    entity += '  100\nAcDbEntity\n';
    entity += `  8\n${layer}\n`;
    entity += '  100\nAcDb3dPolyline\n';
    entity += '  66\n1\n';
    entity += '  70\n8\n';
    entity += '  10\n0.0\n  20\n0.0\n  30\n0.0\n';

    for (const [x, y, z] of vertices) {
      const vHandle = this.nextHandle();
      entity += '  0\nVERTEX\n';
      entity += `  5\n${vHandle}\n`;
      entity += '  100\nAcDbEntity\n';
      entity += `  8\n${layer}\n`;
      entity += '  100\nAcDbVertex\n';
      entity += '  100\nAcDb3dPolylineVertex\n';
      entity += `  10\n${x.toFixed(4)}\n`;
      entity += `  20\n${y.toFixed(4)}\n`;
      entity += `  30\n${(z || 0).toFixed(4)}\n`;
      entity += '  70\n32\n';
      this.updateExtents(x, y, z || 0);
    }

    entity += '  0\nSEQEND\n';
    entity += `  5\n${this.nextHandle()}\n`;
    entity += '  100\nAcDbEntity\n';
    entity += `  8\n${layer}\n`;

    this.entities.push(entity);
  }

  addText(layer: string, position: number[], text: string, height: number, rotation = 0) {
    const handle = this.nextHandle();
    let entity = '';
    entity += '  0\nTEXT\n';
    entity += `  5\n${handle}\n`;
    entity += '  100\nAcDbEntity\n';
    entity += `  8\n${layer}\n`;
    entity += '  100\nAcDbText\n';
    entity += `  10\n${position[0].toFixed(4)}\n`;
    entity += `  20\n${position[1].toFixed(4)}\n`;
    entity += `  30\n${(position[2] || 0).toFixed(4)}\n`;
    entity += `  40\n${height.toFixed(2)}\n`;
    entity += `  1\n${text}\n`;
    if (rotation) {
      entity += `  50\n${rotation.toFixed(2)}\n`;
    }
    entity += '  100\nAcDbText\n';

    this.entities.push(entity);
    this.updateExtents(position[0], position[1], position[2] || 0);
  }

  addPoint(layer: string, position: number[]) {
    const handle = this.nextHandle();
    let entity = '';
    entity += '  0\nPOINT\n';
    entity += `  5\n${handle}\n`;
    entity += '  100\nAcDbEntity\n';
    entity += `  8\n${layer}\n`;
    entity += '  100\nAcDbPoint\n';
    entity += `  10\n${position[0].toFixed(4)}\n`;
    entity += `  20\n${position[1].toFixed(4)}\n`;
    entity += `  30\n${(position[2] || 0).toFixed(4)}\n`;

    this.entities.push(entity);
    this.updateExtents(position[0], position[1], position[2] || 0);
  }

  build(): string {
    const sections: string[] = [];

    // HEADER
    sections.push(this.buildHeader());

    // TABLES
    sections.push(this.buildTables());

    // BLOCKS
    sections.push(this.buildBlocks());

    // ENTITIES
    sections.push(this.buildEntities());

    // EOF
    sections.push('  0\nEOF\n');

    return sections.join('');
  }

  private buildHeader(): string {
    let h = '';
    h += '  0\nSECTION\n';
    h += '  2\nHEADER\n';

    h += '  9\n$ACADVER\n  1\n' + DXF_VERSION + '\n';
    h += '  9\n$INSUNITS\n  70\n' + INSUNITS_FEET + '\n';
    h += '  9\n$MEASUREMENT\n  70\n' + MEASUREMENT_ENGLISH + '\n';

    if (isFinite(this.extMin[0])) {
      h += '  9\n$EXTMIN\n';
      h += `  10\n${this.extMin[0].toFixed(4)}\n`;
      h += `  20\n${this.extMin[1].toFixed(4)}\n`;
      h += `  30\n${this.extMin[2].toFixed(4)}\n`;
      h += '  9\n$EXTMAX\n';
      h += `  10\n${this.extMax[0].toFixed(4)}\n`;
      h += `  20\n${this.extMax[1].toFixed(4)}\n`;
      h += `  30\n${this.extMax[2].toFixed(4)}\n`;
    }

    h += '  0\nENDSEC\n';
    return h;
  }

  private buildTables(): string {
    let t = '';
    t += '  0\nSECTION\n';
    t += '  2\nTABLES\n';

    // LTYPE table
    t += '  0\nTABLE\n  2\nLTYPE\n  70\n2\n';
    // CONTINUOUS
    t += '  0\nLTYPE\n  5\n14\n  100\nAcDbSymbolTableRecord\n  100\nAcDbLinetypeTableRecord\n';
    t += '  2\nCONTINUOUS\n  70\n0\n  3\nSolid line\n  72\n65\n  73\n0\n  40\n0.0\n';
    // DASHED
    t += '  0\nLTYPE\n  5\n15\n  100\nAcDbSymbolTableRecord\n  100\nAcDbLinetypeTableRecord\n';
    t += '  2\nDASHED\n  70\n0\n  3\nDashed\n  72\n65\n  73\n2\n  40\n0.75\n  49\n0.5\n  74\n0\n  49\n-0.25\n  74\n0\n';
    t += '  0\nENDTAB\n';

    // LAYER table
    t += `  0\nTABLE\n  2\nLAYER\n  70\n${DXF_LAYERS.length + 1}\n`;
    // Layer 0
    t += '  0\nLAYER\n  5\n10\n  100\nAcDbSymbolTableRecord\n  100\nAcDbLayerTableRecord\n';
    t += '  2\n0\n  70\n0\n  62\n7\n  6\nCONTINUOUS\n';

    for (let i = 0; i < DXF_LAYERS.length; i++) {
      const layer = DXF_LAYERS[i];
      const handle = (0x20 + i).toString(16).toUpperCase();
      t += `  0\nLAYER\n  5\n${handle}\n  100\nAcDbSymbolTableRecord\n  100\nAcDbLayerTableRecord\n`;
      t += `  2\n${layer.name}\n  70\n0\n  62\n${layer.color}\n  6\n${layer.linetype}\n`;
    }
    t += '  0\nENDTAB\n';

    // STYLE table
    t += '  0\nTABLE\n  2\nSTYLE\n  70\n1\n';
    t += '  0\nSTYLE\n  5\n11\n  100\nAcDbSymbolTableRecord\n  100\nAcDbTextStyleTableRecord\n';
    t += '  2\nSTANDARD\n  70\n0\n  40\n0.0\n  41\n1.0\n  50\n0.0\n  71\n0\n  42\n0.2\n  3\ntxt\n';
    t += '  0\nENDTAB\n';

    t += '  0\nENDSEC\n';
    return t;
  }

  private buildBlocks(): string {
    let b = '';
    b += '  0\nSECTION\n';
    b += '  2\nBLOCKS\n';
    b += '  0\nENDSEC\n';
    return b;
  }

  private buildEntities(): string {
    let e = '';
    e += '  0\nSECTION\n';
    e += '  2\nENTITIES\n';
    e += this.entities.join('');
    e += '  0\nENDSEC\n';
    return e;
  }
}
