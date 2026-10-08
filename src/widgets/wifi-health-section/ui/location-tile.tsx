import { MoreVertical, Plus } from 'lucide-react';
import type { CSSProperties, MouseEvent } from 'react';
import type { MeasurementLocation } from '@/entities/measurement-location';
import { useTranslation } from '@/shared/i18n';
import { cx, Icon, IconButton, SignalBars } from '@/shared/ui';
import { formatShortDate } from '../model/section-helpers';

export interface LocationTileProps {
  location: MeasurementLocation;
  onMeasure: (location: MeasurementLocation) => void;
  onMenu: (location: MeasurementLocation) => void;
  /** Extra classes from the animated grid (enter/leave). */
  className?: string;
  /** Grid position, for the first-load stagger. */
  index?: number;
  /** FLIP key of the animated grid. */
  flipKey?: string;
}

/** Grid cell (VT-04, VT-05, QD-01): name, bars and level of the latest result; never dBm/speed (QD-06). */
export function LocationTile({
  location,
  onMeasure,
  onMenu,
  className,
  index = 0,
  flipKey,
}: LocationTileProps) {
  const { t } = useTranslation('survey');
  const level = location.latestLevel ?? null;
  const measuredOn = formatShortDate(location.latestMeasuredAt);

  // Tapping the tile body opens its menu (same as ⋮); its buttons keep their own action.
  const openMenuFromTile = (event: MouseEvent<HTMLLIElement>) => {
    if ((event.target as Element).closest('button')) return;
    onMenu(location);
  };

  return (
    <li
      className={cx('location-tile', `location-tile--${level ? level.toLowerCase() : 'none'}`, className)}
      style={{ '--i': index } as CSSProperties}
      data-flip-key={flipKey}
      onClick={openMenuFromTile}
    >
      <div className="location-tile__head">
        <span className="location-tile__name" title={location.name}>
          {location.name}
        </span>
        <IconButton
          icon={MoreVertical}
          variant="ghost"
          className="location-tile__menu"
          label={t('grid.menuLabel', { name: location.name })}
          onClick={() => onMenu(location)}
        />
      </div>
      <span className="location-tile__level">
        <SignalBars level={level} />
        <span>{t(`level.${level ?? 'NONE'}`)}</span>
      </span>
      {level && measuredOn ? (
        <span className="location-tile__date">{t('grid.measuredOn', { date: measuredOn })}</span>
      ) : (
        <button
          type="button"
          className="location-tile__measure"
          aria-label={t('grid.measureNowLabel', { name: location.name })}
          onClick={() => onMeasure(location)}
        >
          {t('grid.measureNow')}
        </button>
      )}
    </li>
  );
}

export function AddLocationTile({ onAdd, index = 0 }: { onAdd: () => void; index?: number }) {
  const { t } = useTranslation('survey');
  return (
    <li
      className="location-tile location-tile--add"
      style={{ '--i': index } as CSSProperties}
      data-flip-key="add"
    >
      <button type="button" className="location-tile__add" onClick={onAdd}>
        <Icon icon={Plus} size={24} />
        <span>{t('grid.add')}</span>
      </button>
    </li>
  );
}
