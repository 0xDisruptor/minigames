const commentAvatarTones = ['random-1', 'random-2', 'random-3', 'random-4', 'random-5'] as const;

export type CommentAvatarTone = (typeof commentAvatarTones)[number];

interface CommentAvatarPalette {
  readonly getTone: (authorName: string) => CommentAvatarTone;
  readonly reset: () => void;
}

export function createCommentAvatarPalette(): CommentAvatarPalette {
  const tonesByAuthor = new Map<string, CommentAvatarTone>();

  function getTone(authorName: string): CommentAvatarTone {
    const authorKey = authorName.trim();
    const existingTone = tonesByAuthor.get(authorKey);

    if (existingTone) {
      return existingTone;
    }

    const index = Math.floor(Math.random() * commentAvatarTones.length);
    const tone = commentAvatarTones[index] ?? 'random-1';

    tonesByAuthor.set(authorKey, tone);

    return tone;
  }

  return {
    getTone,
    reset: (): void => {
      tonesByAuthor.clear();
    },
  };
}
