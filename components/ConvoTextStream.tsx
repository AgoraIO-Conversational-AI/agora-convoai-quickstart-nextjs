'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  MessageCircle,
  X,
} from 'lucide-react';
import { cn, renderMarkdownToHtml } from '@/lib/utils';
import { IMessageListItem, EMessageStatus } from '@/lib/message';
import { useIsMobile } from '@/hooks/use-mobile';

interface ConvoTextStreamProps {
  messageList: IMessageListItem[];
  currentInProgressMessage?: IMessageListItem | null;
  agentUID: string | undefined;
}

export default function ConvoTextStream({
  messageList,
  currentInProgressMessage = null,
  agentUID,
}: ConvoTextStreamProps) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const prevMessageLengthRef = useRef(messageList.length);
  const prevMessageTextRef = useRef('');
  const hasSeenFirstMessageRef = useRef(false);

  // Debug log for message detection
  useEffect(() => {
    if (messageList.length > 0 || currentInProgressMessage) {
      console.log(
        'ConvoTextStream - Messages:',
        messageList.map((m) => ({
          uid: m.uid,
          text: m.text,
          status: m.status,
        })),
        'Current in progress:',
        currentInProgressMessage,
        'Agent UID:',
        agentUID
      );
    }
  }, [messageList, currentInProgressMessage, agentUID]);

  // Scroll to bottom function for direct calls
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollHeight, scrollTop, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShouldAutoScroll(isAtBottom);
    }
  };

  // Check if streaming content has significantly changed
  const hasContentChanged = () => {
    if (!currentInProgressMessage) return false;

    const currentText = currentInProgressMessage.text || '';
    const textLengthDiff =
      currentText.length - prevMessageTextRef.current.length;

    // Consider significant change if more than 20 new characters
    const hasSignificantChange = textLengthDiff > 20;

    // Update reference
    if (hasSignificantChange) {
      prevMessageTextRef.current = currentText;
    }

    return hasSignificantChange;
  };

  // Effect for auto-opening chat when first streaming message arrives (desktop only)
  useEffect(() => {
    // Check if this is the first message and chat should be opened
    const hasNewMessage = messageList.length > 0;
    const hasInProgressMessage =
      shouldShowStreamingMessage() && currentInProgressMessage !== null;

    // Desktop: auto-open on first message
    // Mobile: keep closed but indicate new messages
    if (
      (hasNewMessage || hasInProgressMessage) &&
      !hasSeenFirstMessageRef.current
    ) {
      if (!isMobile && !isOpen) {
        setIsOpen(true);
      }
      setHasNewMessages(true);
      hasSeenFirstMessageRef.current = true;
    }
  }, [messageList, currentInProgressMessage, isMobile, isOpen]);

  useEffect(() => {
    // Auto-scroll in these cases:
    // 1. New complete message arrived
    // 2. User is already at bottom
    // 3. Streaming content has changed significantly
    const hasNewMessage = messageList.length > prevMessageLengthRef.current;
    const hasStreamingChange = hasContentChanged();

    if (
      (hasNewMessage || shouldAutoScroll || hasStreamingChange) &&
      scrollRef.current
    ) {
      // Use direct scroll to bottom for more reliable scrolling
      scrollToBottom();
    }

    prevMessageLengthRef.current = messageList.length;
  }, [messageList, currentInProgressMessage?.text, shouldAutoScroll]);

  // Extra safety: ensure scroll happens after content renders during active streaming
  useEffect(() => {
    if (
      currentInProgressMessage?.status === EMessageStatus.IN_PROGRESS &&
      shouldAutoScroll
    ) {
      const timer = setTimeout(scrollToBottom, 100);
      return () => clearTimeout(timer);
    }
  }, [currentInProgressMessage?.text]);

  const shouldShowStreamingMessage = () => {
    return (
      currentInProgressMessage !== null &&
      currentInProgressMessage.status === EMessageStatus.IN_PROGRESS &&
      currentInProgressMessage.text.trim().length > 0
    );
  };

  // Toggle chat open/closed
  const toggleChat = () => {
    setIsOpen(!isOpen);
    // If opening the chat, consider it as having seen the first message
    if (!isOpen) {
      hasSeenFirstMessageRef.current = true;
      setHasNewMessages(false); // Clear pulse indicator when opened
    }
  };

  // Helper to determine if message is from AI
  const isAIMessage = (message: IMessageListItem) => {
    // The AI should be uid=0 (agent) OR matching the agentUID if provided
    return (
      message.uid === 0 || (agentUID && message.uid.toString() === agentUID)
    );
  };

  // Combine complete messages with in-progress message for rendering
  const allMessages = [...messageList];
  if (shouldShowStreamingMessage() && currentInProgressMessage) {
    allMessages.push(currentInProgressMessage);
  }

  return (
    <div id="chatbox" className={cn(
      "fixed z-50",
      isOpen
        ? "left-4 right-4 bottom-32 md:left-auto md:right-8 md:bottom-24"
        : "right-4 md:right-8 bottom-6 md:bottom-8"
    )}>
      {isOpen ? (
        <div
          className="shadow-lg w-full max-w-96 mx-auto flex flex-col chatbox expanded md:mx-0"
          style={{ backgroundColor: '#171717', borderRadius: '15px' }}
        >
          <div className="p-2 flex justify-end items-center shrink-0">
            <h3 className="font-semibold mr-auto ml-2">Transcription</h3>
            <Button variant="ghost" size="icon" onClick={toggleChat}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div
            className="flex-1 overflow-auto"
            ref={scrollRef}
            onScroll={handleScroll}
          >
            <div className="p-4 space-y-4">
              {allMessages.map((message, index) => (
                <div
                  key={`${message.turn_id}-${message.uid}-${message.status}`}
                  ref={index === allMessages.length - 1 ? lastMessageRef : null}
                  className={cn(
                    'flex items-start gap-2 w-full',
                    isAIMessage(message) ? 'flex-row' : 'flex-row-reverse'
                  )}
                >
                  {/* Avatar */}
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium"
                    style={{
                      backgroundColor: isAIMessage(message) ? '#A0FAFF' : '#333333',
                      color: isAIMessage(message) ? '#000000' : '#FFFFFF',
                    }}
                  >
                    {isAIMessage(message) ? 'AI' : 'U'}
                  </div>

                  {/* Message content */}
                  <div
                    className={cn(
                      'flex',
                      isAIMessage(message)
                        ? 'flex-col items-start'
                        : 'flex-col items-end'
                    )}
                  >
                    <div
                      className={cn(
                        'rounded-[15px] px-3 py-2',
                        isAIMessage(message) ? 'text-left' : 'text-right',
                        message.status === EMessageStatus.IN_PROGRESS &&
                          'animate-pulse'
                      )}
                      style={{
                        backgroundColor: isAIMessage(message)
                          ? 'transparent'
                          : '#333333',
                        color: isAIMessage(message) ? '#A0FAFF' : '#FFFFFF',
                      }}
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdownToHtml(message.text),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 pt-2 shrink-0 flex justify-center">
            <Button
              className="rounded-full px-6 py-2 font-medium hover:scale-105 transition-transform duration-200 border-2"
              style={{
                backgroundColor: 'transparent',
                borderColor: '#A0FAFF',
                color: '#FFFFFF',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#A0FAFF';
                e.currentTarget.style.color = '#000000';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#FFFFFF';
              }}
              onClick={() => window.open('https://sso2.agora.io/en/v6/signup', '_blank')}
            >
              Start Building
            </Button>
          </div>
        </div>
      ) : (
        <Button
          onClick={toggleChat}
          className={cn(
            "group rounded-full w-12 h-12 flex items-center justify-center border-2 hover:scale-110 transition-all duration-300 ease-in-out mr-2",
            hasNewMessages && "animate-chat-pulse"
          )}
          style={{
            backgroundColor: '#333333',
            borderColor: '#FFFFFF',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#FFFFFF';
            e.currentTarget.style.borderColor = '#FFFFFF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#333333';
            e.currentTarget.style.borderColor = '#FFFFFF';
          }}
        >
          <MessageCircle className="h-6 w-6 text-white group-hover:text-black transition-colors duration-300 ease-in-out" />
        </Button>
      )}
    </div>
  );
}
