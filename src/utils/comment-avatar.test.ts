import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCommentAvatarPalette } from './comment-avatar';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createCommentAvatarPalette', () => {
  it.each([
    [0, 'random-1'],
    [0.2, 'random-2'],
    [0.4, 'random-3'],
    [0.6, 'random-4'],
    [0.8, 'random-5'],
    [0.999, 'random-5'],
  ])('selects %s as %s', (randomValue, expectedTone) => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(randomValue);
    const palette = createCommentAvatarPalette();

    expect(palette.getTone('Alex')).toBe(expectedTone);
    expect(random).toHaveBeenCalledOnce();
  });

  it('keeps the selected color for the same trimmed author name', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const palette = createCommentAvatarPalette();

    expect(palette.getTone('Alex')).toBe('random-1');

    random.mockReturnValue(0.8);

    expect(palette.getTone('  Alex  ')).toBe('random-1');
    expect(palette.getTone('Alex')).toBe('random-1');
    expect(random).toHaveBeenCalledOnce();
  });

  it('selects and remembers a color for each new author', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0.2).mockReturnValueOnce(0.8);

    const palette = createCommentAvatarPalette();

    expect(palette.getTone('Alex')).toBe('random-2');
    expect(palette.getTone('Taylor')).toBe('random-5');

    expect(palette.getTone('Alex')).toBe('random-2');
    expect(palette.getTone('Taylor')).toBe('random-5');
    expect(random).toHaveBeenCalledTimes(2);
  });

  it('allows a new color assignment after reset', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.8);

    const palette = createCommentAvatarPalette();

    expect(palette.getTone('Alex')).toBe('random-1');

    palette.reset();

    expect(palette.getTone('Alex')).toBe('random-5');
    expect(random).toHaveBeenCalledTimes(2);
  });

  it('keeps separate color assignments for different comments views', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.8);

    const firstPalette = createCommentAvatarPalette();
    const secondPalette = createCommentAvatarPalette();

    expect(firstPalette.getTone('Alex')).toBe('random-1');
    expect(secondPalette.getTone('Alex')).toBe('random-5');
    expect(firstPalette.getTone('Alex')).toBe('random-1');
    expect(random).toHaveBeenCalledTimes(2);
  });
});
