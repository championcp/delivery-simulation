'use client';

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

const DOOR_SIZE_CLASS: Record<LockerSize, string> = {
  small: 'w-[46%] max-w-[56px]',
  medium: 'w-[62%] max-w-[68px]',
  large: 'w-[78%] max-w-[80px]',
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
  };

  const handleDoorClosed = async () => {
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
  onSelectLocker,
}: {
  lockers: Locker[];
  openLockerId: number | null;
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
        const isOccupied = locker.status === 'occupied';
        return (
          <button
            key={locker.id}
            className="relative rounded-lg border-2 border-emerald-600 bg-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-400/60 overflow-hidden transition-transform hover:scale-[1.01]"
            onClick={() => onSelectLocker(locker.id)}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className={`relative rounded-md border border-emerald-700 bg-gradient-to-br from-emerald-100 to-emerald-200 shadow-inner transition-all duration-500 ease-in-out ${DOOR_SIZE_CLASS[locker.size]}`}
              >
                <div
                  className="absolute inset-0 rounded-md origin-left transition-transform duration-500 ease-in-out"
                  style={{
                    transform: isOpen ? 'scaleX(0)' : 'scaleX(1)',
                    backgroundColor: isOccupied ? '#7ed957' : '#b9f2a1',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.15)',
                  }}
                />
                <div className="absolute inset-0 rounded-md pointer-events-none border border-emerald-500/60" />
              </div>
            </div>
            <div className="relative z-10 flex h-full w-full flex-col px-1 pb-1 pt-1.5 text-emerald-900">
              <div className="flex flex-1 items-center justify-center">
                <div
                  className={`relative aspect-square ${DOOR_SIZE_CLASS[locker.size]} rounded-md border border-emerald-700 bg-gradient-to-br from-emerald-100 to-emerald-200 shadow-inner transition-all duration-500 ease-in-out`}
                >
                  <div
                    className="absolute inset-0 rounded-md origin-left transition-transform duration-500 ease-in-out"
                    style={{
                      transform: isOpen ? 'scaleX(0)' : 'scaleX(1)',
                      backgroundColor: isOccupied ? '#7ed957' : '#b9f2a1',
                      boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.15)',
                    }}
                  />
                  <div className="absolute inset-0 rounded-md pointer-events-none border border-emerald-500/60" />
                </div>
              </div>
              <div className="mt-1 flex items-end justify-between text-[10px] font-semibold leading-none opacity-80">
                <span>{locker.label}</span>
                <span>
                  {locker.size === 'small'
                    ? '小格'
                    : locker.size === 'medium'
                      ? '中格'
                      : '大格'}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
