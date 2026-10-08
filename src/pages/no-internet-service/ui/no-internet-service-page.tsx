import { X } from 'lucide-react';
import { useRef, useState } from 'react';
import { VNPT_SHOP_INTERNET_DEEPLINK } from '@/shared/config/deeplinks';
import { useTranslation } from '@/shared/i18n';
import { isBridgeError, useSuperApp } from '@/shared/super-app';
import { Button, IconButton, SpecNote, cx, useToast } from '@/shared/ui';
import { NoServiceHero } from './no-service-hero';
import './no-internet-service-page.css';

// Only slide 1 copy exists in XD; slides 2–5 reuse it until Q19 is answered.
// TODO(Q19): replace with the 5 slides from VNPT Media.
const slides = Array.from({ length: 5 }, (_, index) => ({
  id: index,
  titleKey: 'noService.slide1.title',
  subtitleKey: 'noService.slide1.subtitle',
})) satisfies ReadonlyArray<{
  id: number;
  titleKey: 'noService.slide1.title';
  subtitleKey: 'noService.slide1.subtitle';
}>;

/** "Chưa có dịch vụ Internet" (XD Mesh - Wifi - 1, LLD 7.1): carousel + "Đăng ký ngay". */
export function NoInternetServicePage() {
  const { t } = useTranslation('internet');
  const { t: tCommon } = useTranslation('common');
  const superApp = useSuperApp();
  const toast = useToast();
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  function handleScroll() {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    setActive(Math.min(Math.max(index, 0), slides.length - 1));
  }

  function goTo(index: number) {
    setActive(index);
    const track = trackRef.current;
    if (track && typeof track.scrollTo === 'function') {
      track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' });
    }
  }

  async function close() {
    try {
      await superApp.closeMiniApp();
    } catch {
      toast.show(tCommon('bridge.failed'), { tone: 'danger' });
    }
  }

  async function register() {
    if (!superApp.supports('openDeeplink')) {
      toast.show(t('noService.unsupported'), { tone: 'danger' });
      return;
    }
    try {
      await superApp.openDeeplink(VNPT_SHOP_INTERNET_DEEPLINK);
    } catch (error) {
      const unsupported = isBridgeError(error) && error.code === 'BRIDGE_UNSUPPORTED';
      toast.show(t(unsupported ? 'noService.unsupported' : 'noService.openFailed'), { tone: 'danger' });
    }
  }

  return (
    <section className="no-service" aria-labelledby="no-service-title-0">
      <IconButton
        icon={X}
        label={tCommon('action.close')}
        className="no-service__close"
        onClick={() => void close()}
      />

      <div
        ref={trackRef}
        className="no-service__track"
        role="region"
        aria-roledescription="carousel"
        aria-label={t('noService.carouselLabel')}
        onScroll={handleScroll}
      >
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className="no-service__slide"
            role="group"
            aria-roledescription="slide"
            aria-label={t('noService.slideLabel', { index: index + 1, total: slides.length })}
            aria-hidden={index !== active || undefined}
          >
            <NoServiceHero />
            <h1 className="no-service__title" id={`no-service-title-${index}`}>
              {t(slide.titleKey)}
            </h1>
            <p className="no-service__subtitle">{t(slide.subtitleKey)}</p>
          </div>
        ))}
      </div>

      <div className="no-service__dots">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            className={cx('no-service__dot', index === active && 'is-active')}
            aria-label={t('noService.goToSlide', { index: index + 1 })}
            aria-current={index === active || undefined}
            onClick={() => goTo(index)}
          />
        ))}
        <SpecNote id="noServiceSlides" />
      </div>

      <div className="no-service__footer">
        <Button fullWidth onClick={() => void register()}>
          {t('noService.cta')}
        </Button>
        <SpecNote id="internetShopDeeplink" />
      </div>
    </section>
  );
}
