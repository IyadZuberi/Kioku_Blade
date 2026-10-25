def edit(p, pairs):
    s = open(p, encoding='utf8').read()
    for a, b in pairs:
        assert a in s, (p, a[:80])
        s = s.replace(a, b, 1)
    open(p, 'w', encoding='utf8', newline='').write(s)

edit('src/chars/skinnedConfig.ts', [
    ('''  /** Start at the clip's last frame and hold it (lying still after a finisher). */
  atEnd?: boolean;''', '''  /** Start at the clip's last frame and hold it (lying still after a finisher). */
  atEnd?: boolean;
  /** Freeze on this fraction (0..1) of the clip and hold that frame: a posed stance cut out of a moving clip. */
  pose?: number;'''),
    ('''    // His guard is his planted idle stance with the arm IK putting the blade across the contact (guardAt); the
    // Great Sword Blocking clip tucked the elbows in and hunched him, which read as timid.
    guard: { clip: "idle", loop: true },''', '''    // His guard is the braced frame of the blocked-impact clip, held: feet wide and planted, blade across the body.
    // (The Great Sword Blocking loop tucked the elbows in and hunched him, and the idle clip has the hands clasped low:
    // both read as timid.)
    guard: { clip: "block_impact", pose: 0.5 },'''),
])
edit('src/chars/SkinnedCharacter.ts', [
    ('''    next.setEffectiveTimeScale(this.speedOf(spec));
    next.time = spec.atEnd ? clip.duration : Math.min(time, clip.duration);''', '''    next.setEffectiveTimeScale(spec.pose !== undefined ? 0 : this.speedOf(spec));
    next.time = spec.pose !== undefined ? clip.duration * spec.pose : spec.atEnd ? clip.duration : Math.min(time, clip.duration);'''),
    ('''    if (has && !(spec?.loop || spec?.atEnd) && (spec || this.cfg.plans?.[name])) {''', '''    if (has && !(spec?.loop || spec?.atEnd || spec?.pose !== undefined) && (spec || this.cfg.plans?.[name])) {'''),
])
