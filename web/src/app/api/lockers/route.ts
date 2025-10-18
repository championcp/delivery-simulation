import { NextResponse } from 'next/server';
import { listLockers } from '@/lib/lockerService';

export async function GET() {
  try {
    const lockers = listLockers();
    return NextResponse.json({ lockers });
  } catch (error) {
    console.error('[LOCKERS_GET]', error);
    return NextResponse.json(
      { message: '读取柜体状态失败，请稍后再试' },
      { status: 500 },
    );
  }
}
