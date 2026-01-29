import { NextResponse } from 'next/server';
import { getBaileysState } from '@/lib/baileys';

export const dynamic = 'force-dynamic'; // Ensure this endpoint is not cached

export async function GET() {
    const state = getBaileysState();
    return NextResponse.json(state);
}
