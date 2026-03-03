import { NextResponse } from 'next/server';
import { buildAgoraAuthHeader } from '@/lib/agora-token';
import { StopConversationRequest } from '@/types/conversation';

function getValidatedConfig() {
  const agoraConfig = {
    baseUrl: process.env.NEXT_AGORA_CONVO_AI_BASE_URL || '',
    appId: process.env.NEXT_PUBLIC_AGORA_APP_ID || '',
    appCertificate: process.env.NEXT_AGORA_APP_CERTIFICATE || '',
  };

  if (!agoraConfig.baseUrl || !agoraConfig.appId || !agoraConfig.appCertificate) {
    throw new Error('Missing Agora configuration. Check your .env.local file');
  }

  return agoraConfig;
}

export async function POST(request: Request) {
  try {
    const config = getValidatedConfig();
    const body: StopConversationRequest = await request.json();
    const { agent_id } = body;

    if (!agent_id) {
      throw new Error('agent_id is required');
    }

    const authHeader = await buildAgoraAuthHeader(
      config.appId,
      config.appCertificate
    );

    const response = await fetch(
      `${config.baseUrl}/${config.appId}/agents/${agent_id}/leave`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Agent stop response:', {
        status: response.status,
        body: errorText,
      });
      throw new Error(
        `Failed to stop conversation: ${response.status} ${errorText}`
      );
    }

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
      { status: 500 }
    );
  }
}
