import { NextResponse } from 'next/server';
import { AgoraClient, Area } from 'agent-server-sdk-ts';
import { StopConversationRequest } from '@/types/conversation';

export async function POST(request: Request) {
  try {
    const body: StopConversationRequest = await request.json();
    const { agent_id } = body;

    if (!agent_id) {
      return NextResponse.json(
        { error: 'agent_id is required' },
        { status: 400 },
      );
    }

    const appId =
      process.env.NEXT_PUBLIC_AGORA_APP_ID || process.env.NEXT_AGORA_APP_ID;
    const appCertificate = process.env.NEXT_AGORA_APP_CERTIFICATE;
    if (!appId || !appCertificate) {
      throw new Error(
        'Missing Agora configuration. Set NEXT_PUBLIC_AGORA_APP_ID and NEXT_AGORA_APP_CERTIFICATE.',
      );
    }

    const client = new AgoraClient({
      area: Area.US,
      appId,
      appCertificate,
    });
    await client.stopAgent(agent_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error stopping conversation:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to stop conversation',
      },
      { status: 500 },
    );
  }
}
