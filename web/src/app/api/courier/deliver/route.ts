import { NextRequest, NextResponse } from 'next/server';
import { assignLocker, LockerSize } from '@/lib/lockerService';

function validatePhoneNumber(phone: string) {
  return /^\d{11}$/.test(phone);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recipientName, recipientPhone, size } = body ?? {};

    if (!validatePhoneNumber(recipientPhone)) {
      return NextResponse.json(
        { message: '请输入 11 位收件人手机号' },
        { status: 400 },
      );
    }

    if (!['small', 'medium', 'large'].includes(size)) {
      return NextResponse.json(
        { message: '请选择正确的柜格尺寸' },
        { status: 400 },
      );
    }

    const result = assignLocker({
      recipientName: recipientName ?? null,
      recipientPhone,
      size: size as LockerSize,
    });

    return NextResponse.json({
      locker: result.locker,
      pickupCode: result.pickupCode,
      instructions: `${result.locker.label} 柜门已打开，请放入包裹并关闭柜门。取件码：${result.pickupCode}，请及时通知收件人。`,
    });
  } catch (error) {
    console.error('[COURIER_DELIVER]', error);
    const message =
      error instanceof Error ? error.message : '投件失败，请稍后再试';
    return NextResponse.json({ message }, { status: 400 });
  }
}
