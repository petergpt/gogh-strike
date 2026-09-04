const SHORTCUT_FAMILIES = [
  {name:'Meta', flag:'metaKey', codes:new Set(['Meta', 'MetaLeft', 'MetaRight'])},
  {name:'Alt', flag:'altKey', codes:new Set(['Alt', 'AltLeft', 'AltRight'])},
];

export function isShortcutEvent(event = {}) {
  return !!(event.metaKey || event.altKey || SHORTCUT_FAMILIES.some(family => family.codes.has(event.code)));
}

export function isGameWheel(event = {}) {
  return Number.isFinite(event.deltaY) && event.deltaY !== 0 && !event.metaKey && !event.altKey && !event.ctrlKey;
}

/** Held gameplay input is discarded at an interruption. Repeats cannot restore
 * it: macOS can omit ordinary keyup events while Command is held. */
export class GameInputState {
  constructor() {
    this.keys = new Set();
    this.shortcutModifiers = new Set();
  }

  get suspended() {return this.shortcutModifiers.size > 0;}

  keyDown(event = {}) {
    for (const family of SHORTCUT_FAMILIES) {
      if (family.codes.has(event.code)) {
        this.shortcutModifiers.delete(family.name);
        this.shortcutModifiers.add(event.code);
      } else if (event[family.flag] && !this.hasFamily(family)) {
        // The shortcut key may have been pressed before this window had focus.
        this.shortcutModifiers.add(family.name);
      }
    }
    if (this.suspended || isShortcutEvent(event)) {
      this.keys.clear();
      return false;
    }
    if (typeof event.code !== 'string' || !event.code || event.repeat && !this.keys.has(event.code)) return false;
    this.keys.add(event.code);
    return true;
  }

  keyUp(event = {}) {
    this.keys.delete(event.code);
    this.shortcutModifiers.delete(event.code);
    for (const family of SHORTCUT_FAMILIES) {
      if (event[family.flag] === false) {
        // Aggregate flags also recover a missed left/right modifier keyup.
        for (const code of family.codes) this.shortcutModifiers.delete(code);
      } else if (event[family.flag] === true && !this.hasFamily(family)) {
        this.shortcutModifiers.add(family.name);
      } else if (event[family.flag] === undefined && family.codes.has(event.code)) {
        this.shortcutModifiers.delete(family.name);
      }
    }
    if (this.suspended) this.keys.clear();
  }

  clear({shortcuts = false} = {}) {
    this.keys.clear();
    if (shortcuts) this.shortcutModifiers.clear();
  }

  hasFamily(family) {
    for (const code of family.codes) if (this.shortcutModifiers.has(code)) return true;
    return false;
  }
}
