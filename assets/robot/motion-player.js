// Deterministic timeline shared by autoplay, pointer input and keyboard input.
export class MotionPlayer {
  constructor(data, onChange = () => {}) {
    this.data = data;
    this.onChange = onChange;
    this.q = [...data.home];
    this.grip = 0.04;
    this.states = Object.fromEntries(data.objects.map(object => [object.id, 'available']));
    this.active = null;
    this.queued = null;
    this.held = null;
    this.segmentIndex = 0;
    this.elapsed = 0;
    this.wait = 2.5;
    this.autoplay = true;
    this.paused = false;
    this.resetTime = null;
    this.resetOpacity = 1;
  }

  reset() {
    // Entering the scene always starts a fresh, manual round, including when
    // a block is attached or the automatic reset fade is in progress.
    this.q = [...this.data.home];
    this.grip = .04;
    Object.keys(this.states).forEach(id => { this.states[id] = 'available'; });
    this.active = null;
    this.queued = null;
    this.held = null;
    this.segmentIndex = 0;
    this.elapsed = 0;
    this.wait = 1.4;
    this.autoplay = false;
    this.paused = false;
    this.resetTime = null;
    this.resetOpacity = 1;
    this.onChange('reset');
  }

  select(id) {
    if (this.states[id] !== 'available' || this.resetTime !== null) return false;
    this.queued = id;
    // An explicit selection can run one cycle while autoplay is off.
    this.paused = false;
    this.onChange('selected', id);
    if (!this.active) this.startNext();
    return true;
  }

  pause() {
    this.paused = true;
    this.autoplay = false;
    this.onChange('pause');
  }

  resume() {
    this.paused = false;
    this.autoplay = true;
    this.onChange('resume');
  }

  startNext() {
    const id = this.queued || (this.autoplay
      ? this.data.objects.find(object => this.states[object.id] === 'available')?.id
      : null);
    if (!id) return;
    this.queued = null;
    this.active = this.data.objects.find(object => object.id === id);
    this.states[id] = 'active';
    this.segmentIndex = 0;
    this.elapsed = 0;
    this.onChange('start', id);
  }

  get segment() {
    return this.active?.segments[this.segmentIndex];
  }

  get running() {
    return !this.paused && (this.autoplay || this.active !== null || this.resetTime !== null);
  }

  update(dt) {
    if (this.paused || dt <= 0) return;
    if (this.resetTime !== null) {
      const previous = this.resetTime;
      this.resetTime += dt;
      if (previous < 1.7 && this.resetTime >= 1.7) {
        Object.keys(this.states).forEach(id => { this.states[id] = 'available'; });
        this.onChange('reset');
      }
      const t = this.resetTime;
      this.resetOpacity = t < 1.3 ? 1 : t < 1.7 ? (1.7 - t) / .4 : Math.min(1, (t - 1.7) / .4);
      if (t >= 2.1) {
        this.resetTime = null;
        this.resetOpacity = 1;
        this.wait = 1.2;
        this.onChange('ready');
      }
      return;
    }
    if (!this.active) {
      this.wait -= dt;
      if (this.queued || (this.autoplay && this.wait <= 0)) this.startNext();
      return;
    }
    const segment = this.segment;
    this.elapsed = Math.min(segment.duration, this.elapsed + dt);
    const t = this.elapsed / segment.duration;
    const smooth = t * t * t * (10 + t * (-15 + 6 * t));
    if (segment.kind === 'move') {
      const sample = smooth * (segment.samples.length - 1);
      const lower = Math.floor(sample);
      const upper = Math.min(lower + 1, segment.samples.length - 1);
      this.q = segment.samples[lower].map((value, index) =>
        value + (segment.samples[upper][index] - value) * (sample - lower));
    } else if (segment.kind === 'close') {
      this.grip = .04 + (this.data.size / 2 - .04) * smooth;
    } else if (segment.kind === 'open') {
      this.grip = this.data.size / 2 + (.04 - this.data.size / 2) * smooth;
    }
    if (t < 1) return;
    if (segment.kind === 'close') {
      this.held = this.active.id;
      this.onChange('attach', this.active.id);
    }
    if (segment.kind === 'open') {
      this.held = null;
      this.states[this.active.id] = 'placed';
      this.onChange('release', this.active.id);
    }
    this.segmentIndex += 1;
    this.elapsed = 0;
    if (this.segmentIndex === this.active.segments.length) {
      const finished = this.active.id;
      this.active = null;
      this.wait = 1.4;
      if (Object.values(this.states).every(state => state === 'placed')) this.resetTime = 0;
      this.onChange('complete', finished);
      if (this.queued) this.startNext();
    } else {
      this.onChange('segment', this.active.id);
    }
  }
}
