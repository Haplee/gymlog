import React from 'react';
import { Icon } from '@iconify/react';

interface MuscleIconProps {
  className?: string;
  style?: React.CSSProperties;
}

export const ChestIcon: React.FC<MuscleIconProps> = (props) => (
  <Icon icon="tabler:barbell" {...props} />
);

export const BackIcon: React.FC<MuscleIconProps> = (props) => (
  <Icon icon="hugeicons:gymnastic" {...props} />
);

export const LegIcon: React.FC<MuscleIconProps> = (props) => (
  <Icon icon="mingcute:squats-fill" {...props} />
);

export const ShoulderIcon: React.FC<MuscleIconProps> = (props) => (
  <Icon icon="solar:dumbbells-2-bold" {...props} />
);

export const ArmIcon: React.FC<MuscleIconProps> = (props) => <Icon icon="temaki:gym" {...props} />;

export const GluteIcon: React.FC<MuscleIconProps> = (props) => (
  <Icon icon="mingcute:squats-fill" {...props} />
);

export const CoreIcon: React.FC<MuscleIconProps> = (props) => (
  <Icon icon="arcticons:mymaxfitness" {...props} />
);

export const CardioIcon: React.FC<MuscleIconProps> = (props) => (
  <Icon icon="solar:treadmill-round-bold" {...props} />
);

export const DumbbellIcon: React.FC<MuscleIconProps> = (props) => (
  <Icon icon="hugeicons:kettlebell" {...props} />
);
