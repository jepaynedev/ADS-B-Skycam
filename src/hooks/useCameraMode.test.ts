import { act, renderHook } from '@testing-library/react';
import { CameraMode } from '../types/camera';
import { useCameraMode } from './useCameraMode';

describe('useCameraMode', () => {
  it('starts in COCKPIT mode', () => {
    const { result } = renderHook(() => useCameraMode());
    expect(result.current.mode).toBe(CameraMode.COCKPIT);
  });

  it('changes mode with setMode', () => {
    const { result } = renderHook(() => useCameraMode());
    act(() => result.current.setMode(CameraMode.FREE_LOOK));
    expect(result.current.mode).toBe(CameraMode.FREE_LOOK);
  });

  it('initializes userHeading to 0', () => {
    const { result } = renderHook(() => useCameraMode());
    expect(result.current.userHeading).toBe(0);
  });

  it('initializes userTilt to 85', () => {
    const { result } = renderHook(() => useCameraMode());
    expect(result.current.userTilt).toBe(85);
  });

  it('updates userHeading independently', () => {
    const { result } = renderHook(() => useCameraMode());
    act(() => result.current.setUserHeading(270));
    expect(result.current.userHeading).toBe(270);
    expect(result.current.mode).toBe(CameraMode.COCKPIT);
  });

  it('updates userTilt independently', () => {
    const { result } = renderHook(() => useCameraMode());
    act(() => result.current.setUserTilt(45));
    expect(result.current.userTilt).toBe(45);
    expect(result.current.mode).toBe(CameraMode.COCKPIT);
  });

  it('mode and heading are independent state slices', () => {
    const { result } = renderHook(() => useCameraMode());
    act(() => {
      result.current.setMode(CameraMode.CHASE);
      result.current.setUserHeading(180);
    });
    expect(result.current.mode).toBe(CameraMode.CHASE);
    expect(result.current.userHeading).toBe(180);
  });
});
