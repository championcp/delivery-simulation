'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type LockerSize = 'small' | 'medium' | 'large';
type LockerStatus = 'empty' | 'occupied';

interface Locker {
  id: number;
  label: string;
  size: LockerSize;
  status: LockerStatus;
}

type ScreenState =
  | { view: 'home' }
  | { view: 'courierForm' }
  | {
      view: 'courierSuccess';
      data: { lockerId: number; lockerLabel: string; pickupCode: string };
    }
  | { view: 'pickupForm' }
  | {
      view: 'pickupSuccess';
      data: { lockerId: number; lockerLabel: string; message: string };
    };

const SIZE_OPTIONS: { value: LockerSize; label: string; hint: string }[] = [
  { value: 'small', label: '小格', hint: '适合眼镜盒、轻薄包裹' },
  { value: 'medium', label: '中格', hint: '适合鞋盒、衣物等' },
  { value: 'large', label: '大格', hint: '适合体积较大的包裹' },
];

const INTERIOR_SCALE: Record<LockerSize, number> = {
  small: 0.56,
  medium: 0.7,
  large: 0.85,
};

const PACKAGE_SCALE: Record<LockerSize, number> = {
  small: 0.48,
  medium: 0.58,
  large: 0.66,
};

type LockerAnimation = {
  direction: 'incoming' | 'outgoing';
  key: number;
};

interface CourierFormState {
  recipientName: string;
  recipientPhone: string;
  size: LockerSize;
}

const INITIAL_COURIER_FORM: CourierFormState = {
  recipientName: '',
  recipientPhone: '',
  size: 'medium',
};

export default function LockerSimulation() {
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [loading, setLoading] = useState(false);
  const [screen, setScreen] = useState<ScreenState>({ view: 'home' });
  const [courierForm, setCourierForm] = useState<CourierFormState>(
    INITIAL_COURIER_FORM,
  );
  const [pickupInput, setPickupInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [openLockerId, setOpenLockerId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [lockerAnimations, setLockerAnimations] = useState<
    Record<number, LockerAnimation>
  >({});
  const animationTimeoutsRef = useRef<Record<number, number>>({});

  const fetchLockers = useCallback(async () => {
    try {
      const res = await fetch('/api/lockers', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('无法获取柜体状态，请稍后再试');
      }
      const data: { lockers: Locker[] } = await res.json();
      setLockers(data.lockers);
    } catch (err) {
      console.error(err);
      setError('读取柜体状态失败，请刷新页面或稍后重试');
    }
  }, []);

  useEffect(() => {
    fetchLockers();
  }, [fetchLockers]);

  useEffect(() => {
    return () => {
      Object.values(animationTimeoutsRef.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
    };
  }, []);

  const availableStats = useMemo(() => {
    const total = lockers.length;
    const occupied = lockers.filter((locker) => locker.status === 'occupied')
      .length;
    return { total, occupied, available: total - occupied };
  }, [lockers]);

  const ensureAudioContext = useCallback(async () => {
    if (typeof window === 'undefined') return null;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const playChime = useCallback(async () => {
    const context = await ensureAudioContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(880, context.currentTime);

    gainNode.gain.setValueAtTime(0, context.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.6, context.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      context.currentTime + 0.6,
    );

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start();
    oscillator.stop(context.currentTime + 0.6);
  }, [ensureAudioContext]);

  const triggerPackageAnimation = useCallback(
    (lockerId: number, direction: 'incoming' | 'outgoing') => {
      const key = Date.now() + Math.random();
      setLockerAnimations((prev) => ({
        ...prev,
        [lockerId]: { direction, key },
      }));
      if (animationTimeoutsRef.current[lockerId]) {
        window.clearTimeout(animationTimeoutsRef.current[lockerId]);
      }
      const duration = direction === 'incoming' ? 1100 : 900;
      animationTimeoutsRef.current[lockerId] = window.setTimeout(() => {
        setLockerAnimations((prev) => {
          const current = prev[lockerId];
          if (!current || current.key !== key) {
            return prev;
          }
          const copy = { ...prev };
          delete copy[lockerId];
          return copy;
        });
        delete animationTimeoutsRef.current[lockerId];
      }, duration);
    },
    [],
  );

  const handleCourierSubmit = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/courier/deliver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(courierForm),
      });
      if (!res.ok) {
        const problem = await res.json().catch(() => null);
        throw new Error(problem?.message ?? '投件失败，请稍后再试');
      }
      const data: {
        locker: Locker;
        pickupCode: string;
        instructions: string;
      } = await res.json();
      setScreen({
        view: 'courierSuccess',
        data: {
          lockerId: data.locker.id,
          lockerLabel: data.locker.label,
          pickupCode: data.pickupCode,
        },
      });
      setMessage(data.instructions);
      setOpenLockerId(data.locker.id);
      triggerPackageAnimation(data.locker.id, 'incoming');
      await fetchLockers();
      await playChime();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : '投件失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  const handlePickupConfirm = async () => {
    if (pickupInput.length < 6) {
      setError('请输入 6 位取件码');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/user/pickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickupCode: pickupInput }),
      });
      if (!res.ok) {
        const problem = await res.json().catch(() => null);
        throw new Error(problem?.message ?? '取件失败，请核对取件码');
      }
      const data: {
        locker: Locker;
        message: string;
      } = await res.json();
      setScreen({
        view: 'pickupSuccess',
        data: {
          lockerId: data.locker.id,
          lockerLabel: data.locker.label,
          message: data.message,
        },
      });
      setMessage(data.message);
      setOpenLockerId(data.locker.id);
      triggerPackageAnimation(data.locker.id, 'outgoing');
      setPickupInput('');
      await fetchLockers();
      await playChime();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : '取件失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const resetToHome = () => {
    setScreen({ view: 'home' });
    setCourierForm(INITIAL_COURIER_FORM);
    setPickupInput('');
    setOpenLockerId(null);
    setMessage(null);
    setError(null);
    Object.values(animationTimeoutsRef.current).forEach((timerId) =>
      window.clearTimeout(timerId),
    );
    animationTimeoutsRef.current = {};
    setLockerAnimations({});
  };

  const handleDoorClosed = async () => {
    const closingLockerId = openLockerId;
    if (closingLockerId != null) {
      if (animationTimeoutsRef.current[closingLockerId]) {
        window.clearTimeout(animationTimeoutsRef.current[closingLockerId]);
        delete animationTimeoutsRef.current[closingLockerId];
      }
      setLockerAnimations((prev) => {
        if (!prev[closingLockerId]) return prev;
        const copy = { ...prev };
        delete copy[closingLockerId];
        return copy;
      });
    }
    setOpenLockerId(null);
    setMessage('柜门已关闭，欢迎再次使用！');
    setTimeout(() => {
      resetToHome();
      fetchLockers();
    }, 800);
  };

  const keypadNumbers = useMemo(() => ['1', '2', '3', '4', '5', '6', '7', '8', '9', '清空', '0', '删除'], []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-emerald-50 to-emerald-100 flex flex-col items-center py-8 px-4">
      <h1 className="text-3xl md:text-4xl font-bold text-emerald-700 mb-6">
        信息科技小课堂快递柜体验系统 V1.0
      </h1>

      <div className="w-full max-w-6xl bg-emerald-200 rounded-3xl shadow-2xl border-4 border-emerald-400 overflow-hidden">
        <div className="bg-sky-300 text-center py-4 text-2xl font-semibold tracking-[.4em] text-emerald-900">
          快递柜
        </div>

        <div className="flex flex-col md:flex-row md:min-h-[640px] xl:min-h-[700px] md:items-stretch">
          <div className="flex-1 bg-gradient-to-br from-emerald-200 to-lime-200 p-3 md:p-6 md:flex md:flex-col">
            <LockerGrid
              lockers={lockers}
              openLockerId={openLockerId}
              lockerAnimations={lockerAnimations}
              onSelectLocker={(lockerId) => {
                const locker = lockers.find((item) => item.id === lockerId);
                if (locker) {
                  setMessage(`${locker.label} 当前状态：${locker.status === 'occupied' ? '已占用' : '可用'}`);
                }
              }}
            />
          </div>

          <div className="w-full md:w-[320px] bg-slate-900 text-slate-100 p-5 flex flex-col gap-4 md:min-h-full">
            <ScreenHeader
              availableStats={availableStats}
              isLoading={loading}
            />

            <div className="flex-1 overflow-y-auto pr-1 pb-3">
              <ScreenContent
                screen={screen}
                courierForm={courierForm}
                onCourierFormChange={setCourierForm}
                pickupInput={pickupInput}
                onCourierSubmit={handleCourierSubmit}
                onPickupConfirm={handlePickupConfirm}
                onShowCourier={() => setScreen({ view: 'courierForm' })}
                onShowPickup={() => setScreen({ view: 'pickupForm' })}
                onCloseDoor={handleDoorClosed}
                onBackHome={resetToHome}
                keypadNumbers={keypadNumbers}
                onKeypadClick={(value) => {
                  if (value === '清空') {
                    setPickupInput('');
                  } else if (value === '删除') {
                    setPickupInput((prev) => prev.slice(0, -1));
                  } else if (pickupInput.length < 6) {
                    setPickupInput((prev) => prev + value);
                  }
                }}
              />
            </div>

            {message && (
              <div className="bg-emerald-200 text-emerald-900 rounded-lg p-3 text-sm font-medium shadow-inner">
                {message}
              </div>
            )}
            {error && (
              <div className="bg-red-200 text-red-900 rounded-lg p-3 text-sm font-semibold shadow-inner">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="mt-6 text-sm text-emerald-700 text-center">
        <p>请遵守老师指导，体验结束后记得归还鼠标和耳机。</p>
      </footer>
    </div>
  );
}

function ScreenHeader({
  availableStats,
  isLoading,
}: {
  availableStats: { total: number; occupied: number; available: number };
  isLoading: boolean;
}) {
  return (
    <div className="bg-slate-800 rounded-xl px-4 py-3 flex flex-col gap-2">
      <div className="flex justify-between text-sm">
        <span>柜体总数</span>
        <span>{availableStats.total}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span>已占用</span>
        <span>{availableStats.occupied}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span>可用柜</span>
        <span>{availableStats.available}</span>
      </div>
      <div className="text-xs text-slate-400 text-right">
        {isLoading ? '处理中...' : '请选择操作'}
      </div>
    </div>
  );
}

function ScreenContent(props: {
  screen: ScreenState;
  courierForm: CourierFormState;
  onCourierFormChange: (value: CourierFormState) => void;
  pickupInput: string;
  onCourierSubmit: () => void;
  onPickupConfirm: () => void;
  onShowCourier: () => void;
  onShowPickup: () => void;
  onCloseDoor: () => void;
  onBackHome: () => void;
  keypadNumbers: string[];
  onKeypadClick: (value: string) => void;
}) {
  const {
    screen,
    courierForm,
    onCourierFormChange,
    pickupInput,
    onCourierSubmit,
    onPickupConfirm,
    onShowCourier,
    onShowPickup,
    onCloseDoor,
    onBackHome,
    keypadNumbers,
    onKeypadClick,
  } = props;

  if (screen.view === 'home') {
    return (
      <div className="flex flex-col gap-3">
        <button
          className="bg-emerald-400 hover:bg-emerald-300 text-slate-900 font-bold text-lg rounded-xl py-3 transition-colors"
          onClick={onShowCourier}
        >
          快递员投件
        </button>
        <button
          className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-lg rounded-xl py-3 transition-colors"
          onClick={onShowPickup}
        >
          用户取件
        </button>
      </div>
    );
  }

  if (screen.view === 'courierForm') {
    return (
      <div className="flex min-h-full flex-col gap-3 pb-2">
        <h2 className="text-lg font-semibold text-emerald-200">
          投件信息填写
        </h2>
        <label className="text-sm flex flex-col gap-1">
          收件人姓名（选填）
          <input
            className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-slate-100"
            placeholder="请输入收件人姓名"
            value={courierForm.recipientName}
            onChange={(event) =>
              onCourierFormChange({
                ...courierForm,
                recipientName: event.target.value,
              })
            }
          />
        </label>
        <label className="text-sm flex flex-col gap-1">
          收件人手机号
          <input
            className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-slate-100"
            placeholder="请输入 11 位手机号"
            value={courierForm.recipientPhone}
            maxLength={11}
            onChange={(event) => {
              const value = event.target.value.replace(/[^\d]/g, '');
              onCourierFormChange({
                ...courierForm,
                recipientPhone: value.slice(0, 11),
              });
            }}
          />
        </label>
        <div className="text-sm flex flex-col gap-2">
          选择柜格大小
          <div className="grid grid-cols-3 gap-2">
            {SIZE_OPTIONS.map((option) => {
              const checked = courierForm.size === option.value;
              return (
                <button
                  key={option.value}
                  className={`rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                    checked
                      ? 'bg-emerald-500 text-slate-900'
                      : 'bg-slate-800 text-slate-200 border border-slate-600 hover:bg-slate-700'
                  }`}
                  onClick={() =>
                    onCourierFormChange({ ...courierForm, size: option.value })
                  }
                  type="button"
                >
                  <div>{option.label}</div>
                  <div className="text-[10px] font-normal opacity-80 mt-1">
                    {option.hint}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-auto flex gap-2 pt-1">
          <button
            className="flex-1 bg-slate-700 hover:bg-slate-600 rounded-lg py-2 font-semibold"
            onClick={onBackHome}
          >
            返回首页
          </button>
          <button
            className="flex-1 bg-emerald-400 hover:bg-emerald-300 text-slate-900 rounded-lg py-2 font-semibold"
            onClick={onCourierSubmit}
            disabled={courierForm.recipientPhone.length !== 11}
          >
            打开柜门
          </button>
        </div>
      </div>
    );
  }

  if (screen.view === 'courierSuccess') {
    return (
      <div className="flex min-h-full flex-col gap-3 pb-2">
        <h2 className="text-lg font-semibold text-emerald-200">
          柜门已打开，请投件
        </h2>
        <div className="bg-slate-800 rounded-lg p-3 text-sm leading-6">
          <p>柜体编号：{screen.data.lockerLabel}</p>
          <p>系统生成的取件码：{screen.data.pickupCode}</p>
          <p className="text-emerald-200 mt-2 font-medium">
            请放入包裹并关闭柜门，取件码务必通知收件人！
          </p>
        </div>
        <button
          className="mt-auto bg-emerald-400 hover:bg-emerald-300 text-slate-900 rounded-lg py-2 font-semibold"
          onClick={onCloseDoor}
        >
          已放入包裹，关闭柜门
        </button>
      </div>
    );
  }

  if (screen.view === 'pickupForm') {
    return (
      <div className="flex min-h-full flex-col gap-3 pb-2">
        <h2 className="text-lg font-semibold text-amber-200">
          请输入 6 位取件码
        </h2>
        <div className="bg-slate-800 rounded-xl py-3 px-4 text-2xl tracking-[0.4em] text-center font-mono">
          {pickupInput.padEnd(6, '•')}
        </div>
        <div className="grid flex-1 grid-cols-3 gap-2">
          {keypadNumbers.map((value) => (
            <button
              key={value}
              className={`rounded-lg py-2 text-lg font-semibold transition-colors ${
                value === '清空'
                  ? 'bg-slate-700 hover:bg-slate-600'
                  : value === '删除'
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-900'
                    : 'bg-slate-800 hover:bg-slate-700'
              }`}
              onClick={() => onKeypadClick(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="mt-auto flex gap-2">
          <button
            className="flex-1 bg-slate-700 hover:bg-slate-600 rounded-lg py-2 font-semibold"
            onClick={onBackHome}
          >
            返回首页
          </button>
          <button
            className="flex-1 bg-amber-400 hover:bg-amber-300 text-slate-900 rounded-lg py-2 font-semibold"
            onClick={onPickupConfirm}
          >
            打开柜门
          </button>
        </div>
      </div>
    );
  }

  if (screen.view === 'pickupSuccess') {
    return (
      <div className="flex min-h-full flex-col gap-3 pb-2">
        <h2 className="text-lg font-semibold text-amber-200">
          柜门已打开，请取件
        </h2>
        <div className="bg-slate-800 rounded-lg p-3 text-sm leading-6">
          <p>柜体编号：{screen.data.lockerLabel}</p>
          <p className="text-amber-200 mt-2 font-medium">
            {screen.data.message}
          </p>
        </div>
        <button
          className="mt-auto bg-amber-400 hover:bg-amber-300 text-slate-900 rounded-lg py-2 font-semibold"
          onClick={onCloseDoor}
        >
          已取出包裹，关闭柜门
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-200">正在处理中，请稍候...</p>
      <button
        className="bg-slate-700 hover:bg-slate-600 rounded-lg py-2 font-semibold"
        onClick={onBackHome}
      >
        返回首页
      </button>
    </div>
  );
}

function LockerGrid({
  lockers,
  openLockerId,
  lockerAnimations,
  onSelectLocker,
}: {
  lockers: Locker[];
  openLockerId: number | null;
  lockerAnimations: Record<number, LockerAnimation>;
  onSelectLocker: (lockerId: number) => void;
}) {
  if (!lockers.length) {
    return (
      <div className="h-full flex items-center justify-center text-emerald-900 text-lg font-semibold bg-emerald-100 rounded-2xl border-2 border-emerald-300">
        正在加载柜体...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-6 grid-rows-4 gap-2 md:gap-3 h-full">
      {lockers.map((locker) => {
        const isOpen = openLockerId === locker.id;
        const hasStoredPackage = locker.status === 'occupied';
        const animation = lockerAnimations[locker.id];
        const showPackage =
          (isOpen && (hasStoredPackage || Boolean(animation))) ||
          Boolean(animation && animation.direction === 'outgoing');
        const packageAnimationClass = animation
          ? animation.direction === 'incoming'
            ? 'animate-package-in'
            : 'animate-package-out'
          : '';
        const packageKey =
          animation?.key ?? (hasStoredPackage ? 'stored' : 'empty');
        const interiorScale = INTERIOR_SCALE[locker.size];
        const interiorStyle: CSSProperties = {
          width: `${interiorScale * 100}%`,
          height: `${interiorScale * 100}%`,
        };
        const packageWidthScale = PACKAGE_SCALE[locker.size];
        const packageHeightScale = PACKAGE_SCALE[locker.size] * 0.72;
        const packageStyle: CSSProperties = {
          width: `${packageWidthScale * 100}%`,
          height: `${packageHeightScale * 100}%`,
        };
        const doorBackground = hasStoredPackage
          ? 'linear-gradient(135deg, rgba(14, 130, 100, 0.32), rgba(8, 94, 75, 0.18))'
          : 'linear-gradient(135deg, rgba(255, 255, 255, 0.92), rgba(226, 255, 244, 0.66))';
        const doorShadow = hasStoredPackage
          ? '0 3px 8px rgba(0, 90, 70, 0.22)'
          : '0 3px 8px rgba(0, 0, 0, 0.16)';

        return (
          <button
            key={locker.id}
            className="relative rounded-lg border-2 border-emerald-600 bg-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-400/60 overflow-hidden transition-transform hover:scale-[1.01]"
            onClick={() => onSelectLocker(locker.id)}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="relative flex items-center justify-center"
                style={interiorStyle}
              >
                <div className="absolute inset-0 rounded-lg border border-emerald-500/45 bg-gradient-to-br from-white/75 to-emerald-100/60 shadow-inner" />
                {showPackage && (
                  <div
                    key={packageKey}
                    className={`relative z-20 flex items-center justify-center rounded-sm border border-amber-500/70 bg-amber-300 shadow-md shadow-amber-700/30 ${packageAnimationClass}`}
                    style={packageStyle}
                  >
                    <div className="absolute inset-0 rounded-[3px] border border-white/40 opacity-60" />
                    <div className="absolute inset-x-1 top-[34%] h-[30%] rounded-[2px] bg-amber-500/75" />
                  </div>
                )}
              </div>
            </div>

            <div
              className="absolute inset-0 rounded-lg origin-left transition-transform duration-500 ease-in-out"
              style={{
                transform: isOpen ? 'scaleX(0)' : 'scaleX(1)',
                background: doorBackground,
                border: '1px solid rgba(18, 114, 94, 0.55)',
                boxShadow: doorShadow,
              }}
            >
              {hasStoredPackage && !isOpen && (
                <div className="absolute inset-1 rounded-md bg-emerald-900/12 backdrop-blur-[1px]" />
              )}
            </div>

            <div className="relative z-30 flex h-full w-full flex-col px-1 pb-1 pt-1.5 text-emerald-900">
              <span className="text-[10px] font-semibold opacity-80">
                {locker.label}
              </span>
              <div className="flex-1" />
              <span className="text-[10px] font-semibold opacity-80 self-end">
                {locker.size === 'small'
                  ? '小格'
                  : locker.size === 'medium'
                    ? '中格'
                    : '大格'}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
