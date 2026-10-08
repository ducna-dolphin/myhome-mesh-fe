import { Download, Share2 } from 'lucide-react';
import type { WifiNetwork } from '@/entities/wifi-network';
import { useErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { useSuperApp } from '@/shared/super-app';
import { Badge, Button, Icon, SectionError, Skeleton, SpecNote, useToast } from '@/shared/ui';
import { useWifiQrImage } from '../model/use-wifi-qr-image';
import './wifi-qr-share.css';

export interface WifiQrShareProps {
  serialNumber: string;
  network: WifiNetwork;
}

/** Characters that are unsafe in a download file name. */
const UNSAFE_FILE_CHARS = /[\\/:*?"<>|\s]+/g;

/**
 * "Chia sẻ Wi-Fi" (P3-01, purpose QR, XD Edit Wifi 3): QR + SSID + band, a caption warning that
 * the image contains the password, and "Lưu ảnh QR" / "Chia sẻ" through the bridge when supported
 * (S-07). Without `saveImage` the browser download link is used; without `shareImage` the button
 * is hidden.
 */
export function WifiQrShare({ serialNumber, network }: WifiQrShareProps) {
  const { t } = useTranslation('wifi');
  const toast = useToast();
  const toMessage = useErrorMessage();
  const superApp = useSuperApp();
  const qr = useWifiQrImage(serialNumber, network.wifiIndex);
  const canSave = superApp.supports('saveImage');
  const canShare = superApp.supports('shareImage');
  const ssid = network.ssid;

  const save = async (dataUrl: string) => {
    try {
      await superApp.saveImage(dataUrl);
      toast.show(t('qr.saved'));
    } catch (error) {
      toast.show(toMessage(error), { tone: 'danger' });
    }
  };

  const share = async (dataUrl: string) => {
    try {
      await superApp.shareImage(dataUrl, t('qr.shareText', { ssid }));
    } catch (error) {
      toast.show(toMessage(error), { tone: 'danger' });
    }
  };

  return (
    <div className="wifi-qr">
      <div className="wifi-qr__code" aria-busy={qr.status === 'loading' || undefined}>
        {qr.status === 'loading' && (
          <>
            <Skeleton width="100%" height="100%" />
            <span className="sr-only">{t('qr.loading')}</span>
          </>
        )}
        {qr.status === 'ready' && (
          <img className="wifi-qr__image" src={qr.dataUrl} alt={t('qr.imageAlt', { ssid })} />
        )}
      </div>
      {qr.status === 'error' && (
        <SectionError message={toMessage(qr.error)} onRetry={() => void qr.retry()} />
      )}

      <div className="wifi-qr__info">
        <p className="wifi-qr__ssid">
          <span translate="no">{ssid}</span>
          <Badge tone="neutral">{t(`band.${network.band}`)}</Badge>
        </p>
        <p className="wifi-qr__hint">{t('qr.hint')}</p>
      </div>

      {!network.enabled && (
        <p className="wifi-qr__notice" role="note">
          {t('qr.disabledNotice')}
          <SpecNote id="wifiQrDisabledNetwork" />
        </p>
      )}
      <p className="wifi-qr__warning" role="note">
        {t('qr.warning')}
      </p>

      {qr.status === 'ready' && (
        <div className="wifi-qr__actions">
          {canSave ? (
            <Button fullWidth startIcon={<Icon icon={Download} />} onClick={() => void save(qr.dataUrl)}>
              {t('qr.save')}
            </Button>
          ) : (
            <a
              className="ui-button ui-button--primary ui-button--md ui-button--full"
              href={qr.dataUrl}
              download={t('qr.fileName', { ssid: ssid.replace(UNSAFE_FILE_CHARS, '_') })}
            >
              <Icon icon={Download} />
              <span className="ui-button__label">{t('qr.save')}</span>
            </a>
          )}
          {canShare && (
            <Button
              variant="secondary"
              fullWidth
              startIcon={<Icon icon={Share2} />}
              onClick={() => void share(qr.dataUrl)}
            >
              {t('qr.share')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
