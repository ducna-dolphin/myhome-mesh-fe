import { Component, type ErrorInfo, type PropsWithChildren } from 'react';
import { Translation } from 'react-i18next';

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<PropsWithChildren, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Miniapp render error', error, info);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <Translation ns="common">
          {(t) => <div className="fatal-error">{t('app.fatalError')}</div>}
        </Translation>
      );
    }
    return this.props.children;
  }
}
