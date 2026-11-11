import type { SoundName } from './feedbackPolicy';

export type FeedbackAudioPlayer = {
  pause: () => void;
  play: () => void;
  seekTo: (seconds: number) => Promise<void>;
};

export class AudioPlaybackCoordinator {
  private sequence = new Map<SoundName, number>();

  constructor(private readonly players: Record<SoundName, FeedbackAudioPlayer>) {}

  play(sound: SoundName, canPlay: () => boolean) {
    const sequence = (this.sequence.get(sound) ?? 0) + 1;
    this.sequence.set(sound, sequence);
    const player = this.players[sound];
    void player.seekTo(0).then(() => {
      if (this.sequence.get(sound) === sequence && canPlay()) player.play();
    }).catch(() => undefined);
  }

  cancelAll() {
    Object.entries(this.players).forEach(([sound, player]) => {
      this.sequence.set(sound as SoundName, (this.sequence.get(sound as SoundName) ?? 0) + 1);
      try { player.pause(); } catch { /* Cleanup errors are intentionally isolated. */ }
    });
  }
}

