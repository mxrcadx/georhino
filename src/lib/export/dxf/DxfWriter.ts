import { DXF_VERSION, INSUNITS_FEET, MEASUREMENT_ENGLISH } from './dxfConstants';
import { DXF_LAYERS } from './dxfLayers';

/**
 * DXF Writer targeting AC1024 (AutoCAD 2010 / R2010).
 * Produces files that open cleanly in Rhino 8, AutoCAD, BricsCAD, etc.
 *
 * Required sections for a valid AC1024 file:
 *   HEADER → CLASSES → TABLES → BLOCKS → ENTITIES → OBJECTS → EOF
 *
 * Required symbol tables (all must be present even if empty):
 *   VPORT, LTYPE, LAYER, STYLE, VIEW, UCS, APPID, DIMSTYLE, BLOCK_RECORD
 *
 * Required blocks:
 *   *MODEL_SPACE, *PAPER_SPACE
 */
export class DxfWriter {
  // ── Fixed handle assignments for infrastructure objects ──
  // These must not collide with each other or with entity handles.
  private static readonly H = {
    MODEL_SPACE_BR: '2',   // BLOCK_RECORD for *MODEL_SPACE
    PAPER_SPACE_BR: '3',   // BLOCK_RECORD for *PAPER_SPACE
    VPORT_TABLE:    '4',
    LTYPE_TABLE:    '5',
    LAYER_TABLE:    '6',
    STYLE_TABLE:    '7',
    VIEW_TABLE:     '8',
    UCS_TABLE:      '9',
    APPID_TABLE:    'A',
    DIMSTYLE_TABLE: 'B',
    BLKREC_TABLE:   'C',
    ROOT_DICT:      'D',
    ACAD_GROUP:     'E',
    ACTIVE_VPORT:   'F',
    LAYER_ZERO:     '10',
    STYLE_STANDARD: '11',
    APPID_ACAD:     '12',
    LT_BYBLOCK:     '13',
    LT_BYLAYER:     '14',
    LT_CONTINUOUS:  '15',
    LT_DASHED:      '16',
    MS_BLOCK:       '1F',  // BLOCK entity for *MODEL_SPACE
    MS_ENDBLK:      '1A',  // ENDBLK entity for *MODEL_SPACE
    PS_BLOCK:       '1B',  // BLOCK entity for *PAPER_SPACE
    PS_ENDBLK:      '1C',  // ENDBLK entity for *PAPER_SPACE
  } as const;

  // Layer handles start at 0x20
  private static readonly LAYER_HANDLE_BASE = 0x20;
  // Entity handles start at 0x100 (well past infrastructure)
  private entityHandleCounter = 0x100;

  private entities: string[] = [];
  private extMin = [Infinity, Infinity, Infinity];
  private extMax = [-Infinity, -Infinity, -Infinity];

  private nextHandle(): string {
    return (this.entityHandleCounter++).toString(16).toUpperCase();
  }

  private updateExtents(x: number, y: number, z = 0) {
    this.extMin[0] = Math.min(this.extMin[0], x);
    this.extMin[1] = Math.min(this.extMin[1], y);
    this.extMin[2] = Math.min(this.extMin[2], z);
    this.extMax[0] = Math.max(this.extMax[0], x);
    this.extMax[1] = Math.max(this.extMax[1], y);
    this.extMax[2] = Math.max(this.extMax[2], z);
  }

  // ── Group-code helper: produces "  code\nvalue\n" ──
  private g(code: number, value: string | number): string {
    const codeStr = code.toString().padStart(3, ' ');
    return `${codeStr}\n${value}\n`;
  }

  // ────────────────────────────────────────────────────────
  // Public API — add geometry
  // ────────────────────────────────────────────────────────

  addLwPolyline(layer: string, vertices: number[][], closed = false) {
    const handle = this.nextHandle();
    const H = DxfWriter.H;
    let e = '';
    e += this.g(0, 'LWPOLYLINE');
    e += this.g(5, handle);
    e += this.g(330, H.MODEL_SPACE_BR);   // owner
    e += this.g(100, 'AcDbEntity');
    e += this.g(8, layer);
    e += this.g(100, 'AcDbPolyline');
    e += this.g(90, vertices.length);
    e += this.g(70, closed ? 1 : 0);
    e += this.g(43, '0.0');

    for (const [x, y] of vertices) {
      e += this.g(10, x.toFixed(4));
      e += this.g(20, y.toFixed(4));
      this.updateExtents(x, y);
    }
    this.entities.push(e);
  }

  add3dPolyline(layer: string, vertices: number[][]) {
    const H = DxfWriter.H;
    const polyHandle = this.nextHandle();
    let e = '';
    e += this.g(0, 'POLYLINE');
    e += this.g(5, polyHandle);
    e += this.g(330, H.MODEL_SPACE_BR);
    e += this.g(100, 'AcDbEntity');
    e += this.g(8, layer);
    e += this.g(100, 'AcDb3dPolyline');
    e += this.g(66, 1);
    e += this.g(70, 8);
    e += this.g(10, '0.0');
    e += this.g(20, '0.0');
    e += this.g(30, '0.0');

    for (const [x, y, z] of vertices) {
      const vHandle = this.nextHandle();
      e += this.g(0, 'VERTEX');
      e += this.g(5, vHandle);
      e += this.g(330, H.MODEL_SPACE_BR);
      e += this.g(100, 'AcDbEntity');
      e += this.g(8, layer);
      e += this.g(100, 'AcDbVertex');
      e += this.g(100, 'AcDb3dPolylineVertex');
      e += this.g(10, x.toFixed(4));
      e += this.g(20, y.toFixed(4));
      e += this.g(30, (z || 0).toFixed(4));
      e += this.g(70, 32);
      this.updateExtents(x, y, z || 0);
    }

    e += this.g(0, 'SEQEND');
    e += this.g(5, this.nextHandle());
    e += this.g(330, H.MODEL_SPACE_BR);
    e += this.g(100, 'AcDbEntity');
    e += this.g(8, layer);

    this.entities.push(e);
  }

  addText(layer: string, position: number[], text: string, height: number, rotation = 0) {
    const handle = this.nextHandle();
    const H = DxfWriter.H;
    let e = '';
    e += this.g(0, 'TEXT');
    e += this.g(5, handle);
    e += this.g(330, H.MODEL_SPACE_BR);
    e += this.g(100, 'AcDbEntity');
    e += this.g(8, layer);
    e += this.g(100, 'AcDbText');
    e += this.g(10, position[0].toFixed(4));
    e += this.g(20, position[1].toFixed(4));
    e += this.g(30, (position[2] || 0).toFixed(4));
    e += this.g(40, height.toFixed(2));
    e += this.g(1, text);
    if (rotation) {
      e += this.g(50, rotation.toFixed(2));
    }
    e += this.g(100, 'AcDbText');

    this.entities.push(e);
    this.updateExtents(position[0], position[1], position[2] || 0);
  }

  addPoint(layer: string, position: number[]) {
    const handle = this.nextHandle();
    const H = DxfWriter.H;
    let e = '';
    e += this.g(0, 'POINT');
    e += this.g(5, handle);
    e += this.g(330, H.MODEL_SPACE_BR);
    e += this.g(100, 'AcDbEntity');
    e += this.g(8, layer);
    e += this.g(100, 'AcDbPoint');
    e += this.g(10, position[0].toFixed(4));
    e += this.g(20, position[1].toFixed(4));
    e += this.g(30, (position[2] || 0).toFixed(4));

    this.entities.push(e);
    this.updateExtents(position[0], position[1], position[2] || 0);
  }

  // ────────────────────────────────────────────────────────
  // Build the complete DXF string
  // ────────────────────────────────────────────────────────

  build(): string {
    const parts: string[] = [];
    parts.push(this.buildHeader());
    parts.push(this.buildClasses());
    parts.push(this.buildTables());
    parts.push(this.buildBlocks());
    parts.push(this.buildEntities());
    parts.push(this.buildObjects());
    parts.push(this.g(0, 'EOF'));
    return parts.join('');
  }

  // ── HEADER section ──
  private buildHeader(): string {
    let s = '';
    s += this.g(0, 'SECTION');
    s += this.g(2, 'HEADER');

    s += this.g(9, '$ACADVER');
    s += this.g(1, DXF_VERSION);

    s += this.g(9, '$HANDSEED');
    s += this.g(5, (this.entityHandleCounter + 10).toString(16).toUpperCase());

    s += this.g(9, '$INSUNITS');
    s += this.g(70, INSUNITS_FEET);

    s += this.g(9, '$MEASUREMENT');
    s += this.g(70, MEASUREMENT_ENGLISH);

    s += this.g(9, '$LUNITS');
    s += this.g(70, 2); // decimal

    s += this.g(9, '$LUPREC');
    s += this.g(70, 4); // 4 decimal places

    if (isFinite(this.extMin[0])) {
      s += this.g(9, '$EXTMIN');
      s += this.g(10, this.extMin[0].toFixed(4));
      s += this.g(20, this.extMin[1].toFixed(4));
      s += this.g(30, this.extMin[2].toFixed(4));
      s += this.g(9, '$EXTMAX');
      s += this.g(10, this.extMax[0].toFixed(4));
      s += this.g(20, this.extMax[1].toFixed(4));
      s += this.g(30, this.extMax[2].toFixed(4));
    }

    s += this.g(0, 'ENDSEC');
    return s;
  }

  // ── CLASSES section (empty but present — required for AC1024) ──
  private buildClasses(): string {
    let s = '';
    s += this.g(0, 'SECTION');
    s += this.g(2, 'CLASSES');
    s += this.g(0, 'ENDSEC');
    return s;
  }

  // ── TABLES section ──
  private buildTables(): string {
    const H = DxfWriter.H;
    let s = '';
    s += this.g(0, 'SECTION');
    s += this.g(2, 'TABLES');

    // ─── VPORT table ───
    s += this.g(0, 'TABLE');
    s += this.g(2, 'VPORT');
    s += this.g(5, H.VPORT_TABLE);
    s += this.g(330, '0');
    s += this.g(100, 'AcDbSymbolTable');
    s += this.g(70, 1);
    // *ACTIVE viewport
    s += this.g(0, 'VPORT');
    s += this.g(5, H.ACTIVE_VPORT);
    s += this.g(330, H.VPORT_TABLE);
    s += this.g(100, 'AcDbSymbolTableRecord');
    s += this.g(100, 'AcDbViewportTableRecord');
    s += this.g(2, '*ACTIVE');
    s += this.g(70, 0);
    s += this.g(10, '0.0'); s += this.g(20, '0.0');   // lower-left
    s += this.g(11, '1.0'); s += this.g(21, '1.0');   // upper-right
    s += this.g(12, '0.0'); s += this.g(22, '0.0');   // center
    s += this.g(13, '0.0'); s += this.g(23, '0.0');   // snap base
    s += this.g(14, '10.0'); s += this.g(24, '10.0'); // snap spacing
    s += this.g(15, '10.0'); s += this.g(25, '10.0'); // grid spacing
    s += this.g(16, '0.0'); s += this.g(26, '0.0'); s += this.g(36, '1.0'); // view dir
    s += this.g(17, '0.0'); s += this.g(27, '0.0'); s += this.g(37, '0.0'); // target
    s += this.g(40, '1000.0');  // view height
    s += this.g(41, '1.0');     // aspect ratio
    s += this.g(42, '50.0');    // lens length
    s += this.g(43, '0.0');     // front clip
    s += this.g(44, '0.0');     // back clip
    s += this.g(50, '0.0');     // twist angle
    s += this.g(51, '0.0');     // snap rotation
    s += this.g(71, 0);  s += this.g(72, 100);
    s += this.g(73, 1);  s += this.g(74, 3);
    s += this.g(75, 0);  s += this.g(76, 0);
    s += this.g(77, 0);  s += this.g(78, 0);
    s += this.g(0, 'ENDTAB');

    // ─── LTYPE table ───
    s += this.g(0, 'TABLE');
    s += this.g(2, 'LTYPE');
    s += this.g(5, H.LTYPE_TABLE);
    s += this.g(330, '0');
    s += this.g(100, 'AcDbSymbolTable');
    s += this.g(70, 4);
    // ByBlock
    s += this.g(0, 'LTYPE');
    s += this.g(5, H.LT_BYBLOCK);
    s += this.g(330, H.LTYPE_TABLE);
    s += this.g(100, 'AcDbSymbolTableRecord');
    s += this.g(100, 'AcDbLinetypeTableRecord');
    s += this.g(2, 'ByBlock');
    s += this.g(70, 0);
    s += this.g(3, '');
    s += this.g(72, 65);
    s += this.g(73, 0);
    s += this.g(40, '0.0');
    // ByLayer
    s += this.g(0, 'LTYPE');
    s += this.g(5, H.LT_BYLAYER);
    s += this.g(330, H.LTYPE_TABLE);
    s += this.g(100, 'AcDbSymbolTableRecord');
    s += this.g(100, 'AcDbLinetypeTableRecord');
    s += this.g(2, 'ByLayer');
    s += this.g(70, 0);
    s += this.g(3, '');
    s += this.g(72, 65);
    s += this.g(73, 0);
    s += this.g(40, '0.0');
    // CONTINUOUS
    s += this.g(0, 'LTYPE');
    s += this.g(5, H.LT_CONTINUOUS);
    s += this.g(330, H.LTYPE_TABLE);
    s += this.g(100, 'AcDbSymbolTableRecord');
    s += this.g(100, 'AcDbLinetypeTableRecord');
    s += this.g(2, 'CONTINUOUS');
    s += this.g(70, 0);
    s += this.g(3, 'Solid line');
    s += this.g(72, 65);
    s += this.g(73, 0);
    s += this.g(40, '0.0');
    // DASHED
    s += this.g(0, 'LTYPE');
    s += this.g(5, H.LT_DASHED);
    s += this.g(330, H.LTYPE_TABLE);
    s += this.g(100, 'AcDbSymbolTableRecord');
    s += this.g(100, 'AcDbLinetypeTableRecord');
    s += this.g(2, 'DASHED');
    s += this.g(70, 0);
    s += this.g(3, 'Dashed');
    s += this.g(72, 65);
    s += this.g(73, 2);
    s += this.g(40, '0.75');
    s += this.g(49, '0.5');
    s += this.g(74, 0);
    s += this.g(49, '-0.25');
    s += this.g(74, 0);
    s += this.g(0, 'ENDTAB');

    // ─── LAYER table ───
    s += this.g(0, 'TABLE');
    s += this.g(2, 'LAYER');
    s += this.g(5, H.LAYER_TABLE);
    s += this.g(330, '0');
    s += this.g(100, 'AcDbSymbolTable');
    s += this.g(70, DXF_LAYERS.length + 1);
    // Layer 0
    s += this.g(0, 'LAYER');
    s += this.g(5, H.LAYER_ZERO);
    s += this.g(330, H.LAYER_TABLE);
    s += this.g(100, 'AcDbSymbolTableRecord');
    s += this.g(100, 'AcDbLayerTableRecord');
    s += this.g(2, '0');
    s += this.g(70, 0);
    s += this.g(62, 7);
    s += this.g(6, 'CONTINUOUS');
    s += this.g(370, 25);    // default lineweight
    s += this.g(390, '0');   // plot style handle
    // Custom layers
    for (let i = 0; i < DXF_LAYERS.length; i++) {
      const layer = DXF_LAYERS[i];
      const handle = (DxfWriter.LAYER_HANDLE_BASE + i).toString(16).toUpperCase();
      s += this.g(0, 'LAYER');
      s += this.g(5, handle);
      s += this.g(330, H.LAYER_TABLE);
      s += this.g(100, 'AcDbSymbolTableRecord');
      s += this.g(100, 'AcDbLayerTableRecord');
      s += this.g(2, layer.name);
      s += this.g(70, 0);
      s += this.g(62, layer.color);
      s += this.g(6, layer.linetype);
      s += this.g(370, -3);   // default lineweight
      s += this.g(390, '0');
    }
    s += this.g(0, 'ENDTAB');

    // ─── STYLE table ───
    s += this.g(0, 'TABLE');
    s += this.g(2, 'STYLE');
    s += this.g(5, H.STYLE_TABLE);
    s += this.g(330, '0');
    s += this.g(100, 'AcDbSymbolTable');
    s += this.g(70, 1);
    s += this.g(0, 'STYLE');
    s += this.g(5, H.STYLE_STANDARD);
    s += this.g(330, H.STYLE_TABLE);
    s += this.g(100, 'AcDbSymbolTableRecord');
    s += this.g(100, 'AcDbTextStyleTableRecord');
    s += this.g(2, 'STANDARD');
    s += this.g(70, 0);
    s += this.g(40, '0.0');
    s += this.g(41, '1.0');
    s += this.g(50, '0.0');
    s += this.g(71, 0);
    s += this.g(42, '0.2');
    s += this.g(3, 'txt');
    s += this.g(4, '');
    s += this.g(0, 'ENDTAB');

    // ─── VIEW table (empty) ───
    s += this.g(0, 'TABLE');
    s += this.g(2, 'VIEW');
    s += this.g(5, H.VIEW_TABLE);
    s += this.g(330, '0');
    s += this.g(100, 'AcDbSymbolTable');
    s += this.g(70, 0);
    s += this.g(0, 'ENDTAB');

    // ─── UCS table (empty) ───
    s += this.g(0, 'TABLE');
    s += this.g(2, 'UCS');
    s += this.g(5, H.UCS_TABLE);
    s += this.g(330, '0');
    s += this.g(100, 'AcDbSymbolTable');
    s += this.g(70, 0);
    s += this.g(0, 'ENDTAB');

    // ─── APPID table ───
    s += this.g(0, 'TABLE');
    s += this.g(2, 'APPID');
    s += this.g(5, H.APPID_TABLE);
    s += this.g(330, '0');
    s += this.g(100, 'AcDbSymbolTable');
    s += this.g(70, 1);
    s += this.g(0, 'APPID');
    s += this.g(5, H.APPID_ACAD);
    s += this.g(330, H.APPID_TABLE);
    s += this.g(100, 'AcDbSymbolTableRecord');
    s += this.g(100, 'AcDbRegAppTableRecord');
    s += this.g(2, 'ACAD');
    s += this.g(70, 0);
    s += this.g(0, 'ENDTAB');

    // ─── DIMSTYLE table (empty) ───
    s += this.g(0, 'TABLE');
    s += this.g(2, 'DIMSTYLE');
    s += this.g(5, H.DIMSTYLE_TABLE);
    s += this.g(330, '0');
    s += this.g(100, 'AcDbSymbolTable');
    s += this.g(70, 0);
    s += this.g(100, 'AcDbDimStyleTable');
    s += this.g(0, 'ENDTAB');

    // ─── BLOCK_RECORD table ───
    s += this.g(0, 'TABLE');
    s += this.g(2, 'BLOCK_RECORD');
    s += this.g(5, H.BLKREC_TABLE);
    s += this.g(330, '0');
    s += this.g(100, 'AcDbSymbolTable');
    s += this.g(70, 2);
    // *MODEL_SPACE
    s += this.g(0, 'BLOCK_RECORD');
    s += this.g(5, H.MODEL_SPACE_BR);
    s += this.g(330, H.BLKREC_TABLE);
    s += this.g(100, 'AcDbSymbolTableRecord');
    s += this.g(100, 'AcDbBlockTableRecord');
    s += this.g(2, '*MODEL_SPACE');
    // *PAPER_SPACE
    s += this.g(0, 'BLOCK_RECORD');
    s += this.g(5, H.PAPER_SPACE_BR);
    s += this.g(330, H.BLKREC_TABLE);
    s += this.g(100, 'AcDbSymbolTableRecord');
    s += this.g(100, 'AcDbBlockTableRecord');
    s += this.g(2, '*PAPER_SPACE');
    s += this.g(0, 'ENDTAB');

    s += this.g(0, 'ENDSEC');
    return s;
  }

  // ── BLOCKS section ──
  private buildBlocks(): string {
    const H = DxfWriter.H;
    let s = '';
    s += this.g(0, 'SECTION');
    s += this.g(2, 'BLOCKS');

    // *MODEL_SPACE
    s += this.g(0, 'BLOCK');
    s += this.g(5, H.MS_BLOCK);
    s += this.g(330, H.MODEL_SPACE_BR);
    s += this.g(100, 'AcDbEntity');
    s += this.g(8, '0');
    s += this.g(100, 'AcDbBlockBegin');
    s += this.g(2, '*MODEL_SPACE');
    s += this.g(70, 0);
    s += this.g(10, '0.0');
    s += this.g(20, '0.0');
    s += this.g(30, '0.0');
    s += this.g(3, '*MODEL_SPACE');
    s += this.g(1, '');
    s += this.g(0, 'ENDBLK');
    s += this.g(5, H.MS_ENDBLK);
    s += this.g(330, H.MODEL_SPACE_BR);
    s += this.g(100, 'AcDbEntity');
    s += this.g(8, '0');
    s += this.g(100, 'AcDbBlockEnd');

    // *PAPER_SPACE
    s += this.g(0, 'BLOCK');
    s += this.g(5, H.PS_BLOCK);
    s += this.g(330, H.PAPER_SPACE_BR);
    s += this.g(100, 'AcDbEntity');
    s += this.g(8, '0');
    s += this.g(100, 'AcDbBlockBegin');
    s += this.g(2, '*PAPER_SPACE');
    s += this.g(70, 0);
    s += this.g(10, '0.0');
    s += this.g(20, '0.0');
    s += this.g(30, '0.0');
    s += this.g(3, '*PAPER_SPACE');
    s += this.g(1, '');
    s += this.g(0, 'ENDBLK');
    s += this.g(5, H.PS_ENDBLK);
    s += this.g(330, H.PAPER_SPACE_BR);
    s += this.g(100, 'AcDbEntity');
    s += this.g(8, '0');
    s += this.g(100, 'AcDbBlockEnd');

    s += this.g(0, 'ENDSEC');
    return s;
  }

  // ── ENTITIES section ──
  private buildEntities(): string {
    let s = '';
    s += this.g(0, 'SECTION');
    s += this.g(2, 'ENTITIES');
    s += this.entities.join('');
    s += this.g(0, 'ENDSEC');
    return s;
  }

  // ── OBJECTS section (minimal root dictionary) ──
  private buildObjects(): string {
    const H = DxfWriter.H;
    let s = '';
    s += this.g(0, 'SECTION');
    s += this.g(2, 'OBJECTS');

    // Root dictionary
    s += this.g(0, 'DICTIONARY');
    s += this.g(5, H.ROOT_DICT);
    s += this.g(330, '0');
    s += this.g(100, 'AcDbDictionary');
    s += this.g(281, 1);
    s += this.g(3, 'ACAD_GROUP');
    s += this.g(350, H.ACAD_GROUP);

    // ACAD_GROUP dictionary
    s += this.g(0, 'DICTIONARY');
    s += this.g(5, H.ACAD_GROUP);
    s += this.g(330, H.ROOT_DICT);
    s += this.g(100, 'AcDbDictionary');
    s += this.g(281, 1);

    s += this.g(0, 'ENDSEC');
    return s;
  }
}
