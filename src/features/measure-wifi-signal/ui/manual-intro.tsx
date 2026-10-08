import { Wifi } from 'lucide-react';
import { Trans } from 'react-i18next';
import { useTranslation } from '@/shared/i18n';
import { Button, Icon } from '@/shared/ui';
import type { ManualIntroVariant } from '../model/manual-onboarding';

const strong = { b: <strong /> };

export function RssiGuideSteps({ ssid }: { ssid: string | null }) {
  const { t } = useTranslation('survey');
  const steps = [
    <Trans key="settings" t={t} i18nKey="manual.guide.steps.settings" components={strong} />,
    <Trans key="scan" t={t} i18nKey="manual.guide.steps.scan" components={strong} />,
    ssid ? (
      <Trans key="read" t={t} i18nKey="manual.guide.steps.read" values={{ ssid }} components={strong} />
    ) : (
      <Trans key="read" t={t} i18nKey="manual.guide.steps.readGeneric" components={strong} />
    ),
    <Trans key="enter" t={t} i18nKey="manual.guide.steps.enter" components={strong} />,
  ];
  return (
    <ol className="manual-steps">
      {steps.map((step, index) => (
        <li key={index} className="manual-steps__item">
          <span className="manual-steps__number" aria-hidden="true">
            {index + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

function AppHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="manual-app">
      <span className="manual-app__icon" aria-hidden="true">
        <Icon icon={Wifi} size={28} />
      </span>
      <span className="manual-app__text">
        <strong className="manual-app__title">{title}</strong>
        <span className="manual-app__subtitle">{subtitle}</span>
      </span>
    </div>
  );
}

export interface ManualIntroProps {
  variant: ManualIntroVariant;
  /** Came back from the App Store: "Đo bằng AirPort Utility" + "Nhập kết quả đo" (Figma 26:97). */
  returnedFromStore: boolean;
  ssid: string | null;
  onDownload: () => void;
  onHaveApp: () => void;
  onShowGuide: () => void;
  onEnter: () => void;
}

/** iPhone intro before the RSSI input (XD "Chưa có App AU", P2-04). */
export function ManualIntro({
  variant,
  returnedFromStore,
  ssid,
  onDownload,
  onHaveApp,
  onShowGuide,
  onEnter,
}: ManualIntroProps) {
  const { t } = useTranslation('survey');

  if (returnedFromStore) {
    return (
      <div className="manual-intro" data-variant="returned">
        <AppHeader title={t('manual.returned.title')} subtitle={t('manual.returned.subtitle')} />
        <RssiGuideSteps ssid={ssid} />
        <Button fullWidth onClick={onEnter}>
          {t('manual.returned.enter')}
        </Button>
      </div>
    );
  }

  if (variant === 'need-app') {
    return (
      <div className="manual-intro" data-variant="need-app">
        <AppHeader title={t('manual.needApp.title')} subtitle={t('manual.needApp.subtitle')} />
        <Button fullWidth onClick={onDownload}>
          {t('manual.needApp.download')}
        </Button>
        <button type="button" className="manual-link manual-link--center" onClick={onHaveApp}>
          {t('manual.needApp.haveApp')}
        </button>
        <h3 className="manual-intro__caps">{t('manual.guide.title')}</h3>
        <RssiGuideSteps ssid={ssid} />
      </div>
    );
  }

  if (variant === 'guide-full') {
    return (
      <div className="manual-intro" data-variant="guide-full">
        <h3 className="manual-intro__heading">{t('manual.guide.title')}</h3>
        <RssiGuideSteps ssid={ssid} />
        <Button fullWidth onClick={onEnter}>
          {t('manual.guide.enter')}
        </Button>
      </div>
    );
  }

  return (
    <div className="manual-intro" data-variant="guide-short">
      <p className="manual-intro__short">
        {ssid ? (
          <Trans t={t} i18nKey="manual.guide.short" values={{ ssid }} components={strong} />
        ) : (
          t('manual.guide.shortGeneric')
        )}
      </p>
      <button type="button" className="manual-link" onClick={onShowGuide}>
        {t('manual.guide.showGuide')}
      </button>
      <Button fullWidth onClick={onEnter}>
        {t('manual.guide.enter')}
      </Button>
    </div>
  );
}
