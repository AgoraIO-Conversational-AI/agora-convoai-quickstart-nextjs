import { NextResponse } from 'next/server';
import { StopConversationRequest } from '@/types/conversation';

// Helper function to validate and get Agora configuration
function getValidatedConfig() {
  const agoraConfig = {
    baseUrl: process.env.NEXT_AGORA_CONVO_AI_BASE_URL,
    appId: process.env.NEXT_PUBLIC_AGORA_APP_ID || '',
    customerId: process.env.NEXT_AGORA_CUSTOMER_ID || '',
    customerSecret: process.env.NEXT_AGORA_CUSTOMER_SECRET || '',
  };

  if (Object.values(agoraConfig).some((v) => !v || v.trim() === '')) {
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

    const plainCredential = `${config.customerId}:${config.customerSecret}`;
    const encodedCredential = Buffer.from(plainCredential).toString('base64');
    const authorizationHeader = `Basic ${encodedCredential}`;

    const response = await fetch(
      `${config.baseUrl}/${config.appId}/agents/${agent_id}/leave`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authorizationHeader,
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
