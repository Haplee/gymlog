const KG_TO_LB = 2.20462;

export function kgToLb(kg: number): number {
  if (typeof kg !== 'number' || isNaN(kg)) return 0;
  return kg * KG_TO_LB;
}

export function lbToKg(lb: number): number {
  if (typeof lb !== 'number' || isNaN(lb)) return 0;
  return lb / KG_TO_LB;
}

export function formatWeight(weightInKg: number, unit: 'kg' | 'lb', decimals = 1): string {
  if (typeof weightInKg !== 'number' || isNaN(weightInKg)) return '0';

  const value = unit === 'lb' ? kgToLb(weightInKg) : weightInKg;
  const formatted = decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString();

  return `${formatted} ${unit}`;
}

export function convertToDisplayUnit(weightInKg: number, unit: 'kg' | 'lb'): number {
  if (typeof weightInKg !== 'number' || isNaN(weightInKg)) return 0;
  return unit === 'lb' ? kgToLb(weightInKg) : weightInKg;
}

export function convertFromDisplayUnit(weightInDisplayUnit: number, unit: 'kg' | 'lb'): number {
  if (typeof weightInDisplayUnit !== 'number' || isNaN(weightInDisplayUnit)) return 0;
  return unit === 'lb' ? lbToKg(weightInDisplayUnit) : weightInDisplayUnit;
}

export function parseWeightInput(value: string, currentUnit: 'kg' | 'lb'): number {
  const num = parseFloat(value.replace(',', '.'));
  if (isNaN(num)) return 0;
  return currentUnit === 'lb' ? lbToKg(num) : num;
}

export function getWeightUnitLabel(unit: 'kg' | 'lb'): string {
  return unit;
}

export function getVolumeUnitLabel(unit: 'kg' | 'lb'): string {
  return unit === 'kg' ? 't' : 'k lb';
}

export function formatVolume(volumeInKg: number, unit: 'kg' | 'lb', decimals = 1): string {
  if (typeof volumeInKg !== 'number' || isNaN(volumeInKg)) return '0';

  const value = unit === 'lb' ? kgToLb(volumeInKg) / 1000 : volumeInKg / 1000;
  const unitLabel = unit === 'kg' ? 't' : 'k lb';
  const formatted = decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString();

  return `${formatted}${unitLabel}`;
}
