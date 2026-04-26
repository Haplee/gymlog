import { useMemo, useCallback } from 'react';
import { useSettingsStore } from '@shared/stores/settingsStore';
import {
  formatWeight,
  convertToDisplayUnit,
  convertFromDisplayUnit,
  parseWeightInput,
  formatVolume,
  kgToLb,
  lbToKg,
} from '@shared/lib/weight';

export function useWeight() {
  const unitSystem = useSettingsStore((state) => state.unitSystem);

  const unit = unitSystem;

  const format = useCallback(
    (weightInKg: number, decimals = 1): string => {
      return formatWeight(weightInKg, unit, decimals);
    },
    [unit],
  );

  const convert = useCallback(
    (weightInKg: number): number => {
      return convertToDisplayUnit(weightInKg, unit);
    },
    [unit],
  );

  const convertFromDisplay = useCallback(
    (weightInDisplayUnit: number): number => {
      return convertFromDisplayUnit(weightInDisplayUnit, unit);
    },
    [unit],
  );

  const parse = useCallback(
    (value: string): number => {
      return parseWeightInput(value, unit);
    },
    [unit],
  );

  const formatVol = useCallback(
    (volumeInKg: number, decimals = 1): string => {
      return formatVolume(volumeInKg, unit, decimals);
    },
    [unit],
  );

  const toKg = useCallback(
    (weight: number): number => {
      return unit === 'lb' ? lbToKg(weight) : weight;
    },
    [unit],
  );

  const toDisplay = useCallback(
    (weight: number): number => {
      return unit === 'lb' ? kgToLb(weight) : weight;
    },
    [unit],
  );

  return useMemo(
    () => ({
      unit,
      format,
      convert,
      convertFromDisplay,
      parse,
      formatVol,
      toKg,
      toDisplay,
    }),
    [unit, format, convert, convertFromDisplay, parse, formatVol, toKg, toDisplay],
  );
}
