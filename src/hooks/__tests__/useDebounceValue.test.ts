import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebounceValue } from '../useDebounceValue'

describe('useDebounceValue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return the initial value immediately', () => {
    const { result } = renderHook(() => useDebounceValue('hello', 300))
    expect(result.current).toBe('hello')
  })

  it('should not update the value before the delay elapses', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounceValue(value, delay),
      { initialProps: { value: 'hello', delay: 300 } },
    )

    rerender({ value: 'world', delay: 300 })

    // Advance only part of the delay
    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(result.current).toBe('hello')
  })

  it('should update the value after the delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounceValue(value, delay),
      { initialProps: { value: 'hello', delay: 300 } },
    )

    rerender({ value: 'world', delay: 300 })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current).toBe('world')
  })

  it('should reset the timer on rapid changes (debounce behaviour)', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounceValue(value, delay),
      { initialProps: { value: 'a', delay: 300 } },
    )

    // Rapid changes: only the last one should stick
    rerender({ value: 'b', delay: 300 })
    act(() => { vi.advanceTimersByTime(100) })

    rerender({ value: 'c', delay: 300 })
    act(() => { vi.advanceTimersByTime(100) })

    rerender({ value: 'd', delay: 300 })

    // Still showing initial because no timeout has completed
    expect(result.current).toBe('a')

    // Now let the final timeout elapse
    act(() => { vi.advanceTimersByTime(300) })
    expect(result.current).toBe('d')
  })

  it('should work with numeric values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounceValue(value, delay),
      { initialProps: { value: 0, delay: 500 } },
    )

    rerender({ value: 42, delay: 500 })
    act(() => { vi.advanceTimersByTime(500) })

    expect(result.current).toBe(42)
  })

  it('should handle delay changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounceValue(value, delay),
      { initialProps: { value: 'start', delay: 200 } },
    )

    // Change both value and delay
    rerender({ value: 'end', delay: 500 })
    act(() => { vi.advanceTimersByTime(200) })
    // Should NOT have updated yet because new delay is 500
    expect(result.current).toBe('start')

    act(() => { vi.advanceTimersByTime(300) })
    expect(result.current).toBe('end')
  })
})
