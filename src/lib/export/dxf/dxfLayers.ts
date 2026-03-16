import type { DxfLayerDef } from '@/types/export';
import { ACI_COLORS } from './dxfConstants';

export const DXF_LAYERS: DxfLayerDef[] = [
  { name: 'TOPO-CONTOUR-MAJOR', color: ACI_COLORS.BROWN, linetype: 'CONTINUOUS' },
  { name: 'TOPO-CONTOUR-MINOR', color: ACI_COLORS.LIGHT_BROWN, linetype: 'CONTINUOUS' },
  { name: 'TOPO-CONTOUR-LABEL', color: ACI_COLORS.BROWN, linetype: 'CONTINUOUS' },
  { name: 'SITE-BLDG', color: ACI_COLORS.DARK_GRAY, linetype: 'CONTINUOUS' },
  { name: 'SITE-ROADS-HWY', color: ACI_COLORS.WHITE, linetype: 'CONTINUOUS' },
  { name: 'SITE-ROADS-LOCAL', color: ACI_COLORS.LIGHT_GRAY, linetype: 'CONTINUOUS' },
  { name: 'SITE-WATER', color: ACI_COLORS.BLUE, linetype: 'CONTINUOUS' },
  { name: 'SITE-LANDUSE', color: ACI_COLORS.GREEN, linetype: 'CONTINUOUS' },
  { name: 'SITE-INFRA-POWER', color: ACI_COLORS.RED, linetype: 'CONTINUOUS' },
  { name: 'SITE-INFRA-TELECOM', color: ACI_COLORS.RED, linetype: 'CONTINUOUS' },
];
