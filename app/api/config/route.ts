import { NextResponse } from 'next/server';
import { updateBaileysConfig } from '@/lib/baileys';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        updateBaileysConfig(body);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Invalid body' }, { status: 400 });
    }
}
