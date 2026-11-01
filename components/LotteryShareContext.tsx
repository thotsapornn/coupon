'use client';

import { createContext, useCallback, useContext, useState } from 'react';

export type ShareMode = 'full' | 'summary';
export type ShareMethod = 'line' | 'copy';
type ShareHandler = (mode: ShareMode, method: ShareMethod) => void | Promise<void>;

type ShareRegistration = {
  handler: ShareHandler | null;
  disabled: Record<ShareMode, boolean>;
};

type LotteryShareContextValue = {
  registerShare: (
    handler: ShareHandler | null,
    disabled?: Record<ShareMode, boolean>,
  ) => void;
  requestShare: (mode: ShareMode, method: ShareMethod) => void | Promise<void>;
  hasShare: boolean;
  isDisabled: (mode: ShareMode) => boolean;
};

const LotteryShareContext = createContext<LotteryShareContextValue | null>(null);

export function LotteryShareProvider({ children }: { children: React.ReactNode }) {
  const [registration, setRegistration] = useState<ShareRegistration>({
    handler: null,
    disabled: { full: true, summary: true },
  });

  const registerShare = useCallback(
    (handler: ShareHandler | null, disabled: Record<ShareMode, boolean> = { full: false, summary: false }) => {
      setRegistration({ handler, disabled });
    },
    [],
  );

  const requestShare = useCallback(
    (mode: ShareMode, method: ShareMethod) => registration.handler?.(mode, method),
    [registration.handler],
  );
  const isDisabled = useCallback(
    (mode: ShareMode) => registration.disabled[mode],
    [registration.disabled],
  );

  return (
    <LotteryShareContext.Provider
      value={{
        registerShare,
        requestShare,
        hasShare: Boolean(registration.handler),
        isDisabled,
      }}
    >
      {children}
    </LotteryShareContext.Provider>
  );
}

export function useLotteryShare(): LotteryShareContextValue {
  const context = useContext(LotteryShareContext);
  if (!context) throw new Error('useLotteryShare must be used inside LotteryShareProvider');
  return context;
}
