import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, message: 'REVALIDATE_SECRET not configured' }, { status: 501 });
  }

  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  let paths: string[] = ['/'];
  try {
    const body = (await request.json()) as { paths?: string[] };
    if (body.paths?.length) paths = body.paths;
  } catch {
    // default paths
  }

  for (const p of paths) {
    revalidatePath(p);
  }

  return NextResponse.json({ ok: true, revalidated: paths });
}
