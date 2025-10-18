import { NextRequest, NextResponse } from 'next/server';
import { pickupPackage } from '@/lib/lockerService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pickupCode } = body ?? {};

    if (typeof pickupCode !== 'string' || pickupCode.length !== 6) {
      return NextResponse.json(
        { message: '请输入 6 位取件码' },
        { status: 400 },
      );
    }

    const result = pickupPackage(pickupCode);

    return NextResponse.json({
      locker: result.locker,
      message: `${result.locker.label} 柜门已打开，请取出包裹并确认关闭柜门。`,
    });
  } catch (error) {
    console.error('[USER_PICKUP]', error);
    const message =
      error instanceof Error ? error.message : '取件失败，请稍后重试';
    return NextResponse.json({ message }, { status: 400 });
  }
}
