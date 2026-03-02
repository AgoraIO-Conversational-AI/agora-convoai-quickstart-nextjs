'use client';

import { useState, useEffect } from 'react';
import { IMicrophoneAudioTrack } from 'agora-rtc-react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MicrophoneSelectorProps {
  localMicrophoneTrack: IMicrophoneAudioTrack | null;
}

interface MicrophoneDevice {
  deviceId: string;
  label: string;
}

export function MicrophoneSelector({
  localMicrophoneTrack,
}: MicrophoneSelectorProps) {
  const [devices, setDevices] = useState<MicrophoneDevice[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);

  // Fetch available microphones
  const fetchMicrophones = async () => {
    try {
      // Import AgoraRTC dynamically to access getMicrophones
      const AgoraRTC = (await import('agora-rtc-react')).default;
      const microphones = await AgoraRTC.getMicrophones();
      
      const formattedDevices = microphones.map((device) => ({
        deviceId: device.deviceId,
        label: device.label || `Microphone ${device.deviceId.slice(0, 5)}...`,
      }));
      
      setDevices(formattedDevices);

      // Set current device from track
      if (localMicrophoneTrack) {
        const currentLabel = localMicrophoneTrack.getTrackLabel();
        const currentDevice = microphones.find(
          (device) => device.label === currentLabel
        );
        if (currentDevice) {
          setCurrentDeviceId(currentDevice.deviceId);
        }
      }
    } catch (error) {
      console.error('Error fetching microphones:', error);
    }
  };

  // Fetch devices on mount and when track changes
  useEffect(() => {
    if (localMicrophoneTrack) {
      fetchMicrophones();
    }
  }, [localMicrophoneTrack]);

  // Handle device change
  const handleDeviceChange = async (deviceId: string) => {
    if (!localMicrophoneTrack) return;

    try {
      await localMicrophoneTrack.setDevice(deviceId);
      setCurrentDeviceId(deviceId);
      console.log('Microphone device changed to:', deviceId);
    } catch (error) {
      console.error('Error changing microphone device:', error);
    }
  };

  // Hot-swap: Listen for device changes
  useEffect(() => {
    const setupDeviceChangeListener = async () => {
      try {
        const AgoraRTC = (await import('agora-rtc-react')).default;
        
        AgoraRTC.onMicrophoneChanged = async (changedDevice) => {
          console.log('Microphone changed:', changedDevice);
          
          // Refresh device list
          await fetchMicrophones();
          
          // Auto-switch to new device if it's active
          if (changedDevice.state === 'ACTIVE' && localMicrophoneTrack) {
            await localMicrophoneTrack.setDevice(changedDevice.device.deviceId);
            setCurrentDeviceId(changedDevice.device.deviceId);
          } else if (
            changedDevice.device.label ===
              localMicrophoneTrack?.getTrackLabel() &&
            changedDevice.state === 'INACTIVE'
          ) {
            // Switch to first available device if current device was unplugged
            const microphones = await AgoraRTC.getMicrophones();
            if (microphones[0] && localMicrophoneTrack) {
              await localMicrophoneTrack.setDevice(microphones[0].deviceId);
              setCurrentDeviceId(microphones[0].deviceId);
            }
          }
        };
      } catch (error) {
        console.error('Error setting up device change listener:', error);
      }
    };

    setupDeviceChangeListener();

    // Cleanup
    return () => {
      import('agora-rtc-react').then(({ default: AgoraRTC }) => {
        AgoraRTC.onMicrophoneChanged = undefined;
      });
    };
  }, [localMicrophoneTrack]);

  // Only show selector if there are multiple devices to choose from
  if (devices.length <= 1) {
    return null;
  }

  const currentDevice = devices.find((d) => d.deviceId === currentDeviceId);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full w-10 h-10 bg-gray-800/50 hover:bg-gray-700/50 backdrop-blur-sm border border-gray-600"
          title="Select microphone"
        >
          <Settings className="h-4 w-4 text-white" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        className="w-64 bg-gray-900 border-gray-700"
      >
        <div className="px-2 py-1.5 text-xs font-semibold text-gray-400">
          Microphone
        </div>
        {devices.map((device) => (
          <DropdownMenuItem
            key={device.deviceId}
            onClick={() => handleDeviceChange(device.deviceId)}
            className={`cursor-pointer ${
              device.deviceId === currentDeviceId
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-white hover:bg-gray-800'
            }`}
          >
            <span className="truncate">{device.label}</span>
            {device.deviceId === currentDeviceId && (
              <span className="ml-auto text-cyan-400">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

