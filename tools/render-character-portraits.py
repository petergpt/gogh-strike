#!/usr/bin/env python3
"""Capture actual Three.js character portraits through the installed browser CLI.

Preview one character, without touching shipped assets:
  python3 tools/render-character-portraits.py --new-session vgs-portraits --artist pissarro --keep-open

After the integration owner declares final models ready:
  python3 tools/render-character-portraits.py --session vgs-portraits --finalize

An existing named test session is required unless --new-session explicitly asks
the installed agent-browser CLI to create one. An optional --wrapper can supply
local launch defaults. This script never installs a browser or packages.
New sessions use Chromium's software ANGLE driver for reliable headless WebGL;
an explicitly supplied AGENT_BROWSER_ARGS value takes precedence.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import time
from urllib.parse import urlparse
import zlib


ROOT = Path(__file__).resolve().parents[1]
RENDER_PAGE = '/tools/portrait-render.html'


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def output_reference(path: Path) -> str:
    """Keep published provenance portable; explicit external previews stay local."""
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return str(path)


def source_snapshot() -> dict[str, str]:
    paths = [ROOT / RENDER_PAGE.lstrip('/'), Path(__file__).resolve()]
    paths.extend((ROOT / 'src').rglob('*.js'))
    paths.extend((ROOT / 'vendor').rglob('*.js'))
    paths.extend((ROOT / 'assets/characters').glob('*.glb'))
    paths.extend((ROOT / 'assets/characters').rglob('*.png'))
    return {str(path.relative_to(ROOT)): sha256(path) for path in sorted(set(paths)) if path.is_file()}


class Browser:
    def __init__(self, wrapper: Path | None, session: str, timeout: float):
        self.wrapper, self.session, self.timeout = wrapper, session, timeout
        self.env = {**os.environ, 'AGENT_BROWSER_SESSION': session,
                    'AGENT_BROWSER_MAX_OUTPUT': '16000000', 'AGENT_BROWSER_DEFAULT_TIMEOUT': '45000'}

    def call(self, *arguments: str, script: str | None = None) -> dict:
        executable = str(self.wrapper) if self.wrapper else 'agent-browser'
        result = subprocess.run([executable, '--session', self.session, '--json', *arguments], input=script,
                                capture_output=True, text=True, env=self.env, cwd=ROOT, timeout=self.timeout)
        try:
            payload = json.loads(result.stdout)
        except json.JSONDecodeError as error:
            # Keep diagnostics small: never print an incomplete image data URL.
            detail = result.stderr.strip()[:400] or f'non-JSON CLI response ({len(result.stdout)} characters)'
            raise RuntimeError(f'agent-browser {arguments[0]}: {detail}') from error
        if result.returncode or not payload.get('success'):
            raise RuntimeError(f"agent-browser {arguments[0]}: {str(payload.get('error', 'command failed'))[:600]}")
        return payload.get('data') or {}

    def evaluate(self, script: str):
        return self.call('eval', '--stdin', script=script).get('result')

    def wait_ready(self, timeout: float) -> dict:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            state = self.evaluate('window.portraitRender?.state ?? null')
            if state and state.get('error'):
                raise RuntimeError(f"Portrait page: {state['error']}")
            if state and state.get('ready'):
                return state
            time.sleep(0.4)
        raise RuntimeError('Portrait page did not finish loading within the readiness timeout.')

    def verify_served_sources(self, expected: dict[str, str]) -> None:
        # Bind this checkout to the bytes on the selected local server. A server
        # from another checkout must not inherit this checkout's provenance.
        paths = json.dumps(list(expected))
        actual = self.evaluate(f'''(async () => {{
          const hashes = {{}};
          for (const path of {paths}) {{
            const response = await fetch('/' + path, {{cache: 'no-store'}});
            if (!response.ok) throw new Error('Source verification failed: ' + path + ' (' + response.status + ')');
            const digest = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
            hashes[path] = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
          }}
          return hashes;
        }})()''')
        if actual != expected:
            mismatched = [path for path, digest in expected.items() if actual.get(path) != digest]
            raise RuntimeError('The local server does not serve this source snapshot: ' + ', '.join(mismatched[:5]))


def inspect_png(data: bytes, width: int, height: int) -> dict:
    """Validate dimensions, CRCs and a populated alpha channel using the stdlib."""
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise RuntimeError('Browser did not return a PNG.')
    offset, compressed, actual = 8, bytearray(), None
    ended = False
    while offset + 12 <= len(data):
        length = struct.unpack('>I', data[offset:offset + 4])[0]
        kind = data[offset + 4:offset + 8]
        body = data[offset + 8:offset + 8 + length]
        crc_bytes = data[offset + 8 + length:offset + 12 + length]
        if len(body) != length or len(crc_bytes) != 4:
            raise RuntimeError('PNG was truncated in CLI transport.')
        if zlib.crc32(kind + body) & 0xffffffff != struct.unpack('>I', crc_bytes)[0]:
            raise RuntimeError('PNG failed its CRC integrity check.')
        if kind == b'IHDR':
            actual = struct.unpack('>IIBBBBB', body)
        elif kind == b'IDAT':
            compressed.extend(body)
        elif kind == b'IEND':
            ended = True
            break
        offset += length + 12
    if not ended or actual != (width, height, 8, 6, 0, 0, 0):
        raise RuntimeError(f'Expected a {width}×{height} 8-bit RGBA PNG; found {actual}.')
    raw = zlib.decompress(compressed)
    stride = width * 4
    if len(raw) != height * (stride + 1):
        raise RuntimeError('Unexpected PNG scanline size.')
    previous = bytearray(stride)
    opaque = transparent = 0
    left, top, right, bottom = width, height, -1, -1
    for y in range(height):
        begin = y * (stride + 1)
        filtering, row = raw[begin], bytearray(raw[begin + 1:begin + stride + 1])
        for x in range(stride):
            a, b, c = (row[x - 4] if x >= 4 else 0), previous[x], (previous[x - 4] if x >= 4 else 0)
            if filtering == 1:
                prediction = a
            elif filtering == 2:
                prediction = b
            elif filtering == 3:
                prediction = (a + b) // 2
            elif filtering == 4:
                p = a + b - c
                distances = abs(p - a), abs(p - b), abs(p - c)
                prediction = a if distances[0] <= min(distances[1:]) else b if distances[1] <= distances[2] else c
            elif filtering == 0:
                prediction = 0
            else:
                raise RuntimeError(f'Unsupported PNG filter {filtering}.')
            row[x] = (row[x] + prediction) & 255
        for x, alpha in enumerate(row[3::4]):
            if alpha > 8:
                opaque += 1
                left, right, top, bottom = min(left, x), max(right, x), min(top, y), max(bottom, y)
            elif alpha == 0:
                transparent += 1
        previous = row
    if opaque < width * height * 0.025 or transparent < width * height * 0.04:
        raise RuntimeError('Portrait is empty, opaque-backed, or too tightly cropped.')
    return {'width': width, 'height': height, 'foregroundPixels': opaque,
            'transparentPixels': transparent, 'alphaBounds': [left, top, right, bottom]}


def publish_batch(outputs: list[tuple[Path, bytes]]) -> None:
    """Stage the whole generation, then replace with rollback on publish failure."""
    staged, committed = [], []
    recovery = []
    try:
        for path, data in outputs:
            path.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(dir=path.parent, prefix=f'.{path.name}.portrait-stage-', delete=False) as stream:
                temporary = Path(stream.name)
                staged.append({'path': path, 'temporary': temporary, 'backup': None})
                stream.write(data)
            temporary.chmod(0o644)
            if path.exists():
                with tempfile.NamedTemporaryFile(dir=path.parent, prefix=f'.{path.name}.portrait-backup-', delete=False) as stream:
                    backup = Path(stream.name)
                backup.unlink()
                # A hard link preserves the old bytes without doubling disk use.
                os.link(path, backup)
                staged[-1]['backup'] = backup
        for entry in staged:
            entry['temporary'].replace(entry['path'])
            committed.append(entry)
    except BaseException:
        for entry in reversed(committed):
            try:
                if entry['backup'] is not None:
                    entry['backup'].replace(entry['path'])
                else:
                    entry['path'].unlink(missing_ok=True)
            except OSError:
                # Preserve the recovery file if the filesystem itself prevents
                # rollback. Its exact path is reported rather than discarded.
                if entry['backup'] is not None:
                    recovery.append(entry['backup'])
        if recovery:
            print('Rollback needs filesystem recovery; backups: ' + ', '.join(map(str, recovery)), file=sys.stderr)
        raise
    finally:
        for entry in staged:
            entry['temporary'].unlink(missing_ok=True)
            backup = entry['backup']
            if backup is not None and backup not in recovery:
                backup.unlink(missing_ok=True)


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sessions = parser.add_mutually_exclusive_group(required=True)
    sessions.add_argument('--session', help='Reuse this existing named test session; it remains open.')
    sessions.add_argument('--new-session', help='Create this named test session; close it after capture.')
    parser.add_argument('--keep-open', action='store_true', help='Keep a newly created session open after capture.')
    parser.add_argument('--url', default='http://127.0.0.1:8967', help='Running local game origin (default: %(default)s).')
    parser.add_argument('--artist', action='append', default=[], help='Preview this design ID, name or roster index; repeat as needed.')
    parser.add_argument('--mode', choices=['card', 'face', 'both'], default='both')
    parser.add_argument('--preview-dir', type=Path, default=ROOT / 'build/characters/portrait-preview')
    parser.add_argument('--finalize', action='store_true', help='After final-model approval, replace all 12 cards, face exports and matching HUD face copies.')
    parser.add_argument('--wrapper', type=Path, help='Optional executable wrapper for agent-browser; defaults to the installed CLI on PATH.')
    parser.add_argument('--timeout', type=float, default=90, help='Readiness and individual CLI timeout in seconds.')
    args = parser.parse_args()
    if args.finalize and (args.artist or args.mode != 'both'):
        parser.error('--finalize always captures the complete roster in both modes; omit --artist and --mode.')
    if not args.finalize and not args.artist:
        parser.error('A preview requires --artist. Use --finalize only after the integration owner approves final models.')
    parsed = urlparse(args.url)
    if parsed.scheme != 'http' or parsed.hostname not in {'127.0.0.1', 'localhost', '::1'}:
        parser.error('--url must point to the local HTTP game server.')
    if parsed.path not in {'', '/'} or parsed.query or parsed.fragment or parsed.username:
        parser.error('--url must be an origin without a path, credentials, query or fragment.')
    args.url = args.url.rstrip('/')
    args.preview_dir = args.preview_dir.resolve()
    # Preview must never overwrite production portraits, even via path overrides.
    protected = [ROOT / 'assets', ROOT / 'outputs/character-portraits']
    if any(args.preview_dir == path or path in args.preview_dir.parents for path in protected):
        parser.error('--preview-dir cannot be inside shipped assets or final portrait outputs.')
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,79}', args.session or args.new_session):
        parser.error('Use a short alphanumeric browser session name with dots, underscores or hyphens.')
    if args.timeout <= 0:
        parser.error('--timeout must be positive.')
    if args.wrapper:
        args.wrapper = args.wrapper.expanduser().resolve()
        if not args.wrapper.is_file() or not os.access(args.wrapper, os.X_OK):
            parser.error('--wrapper must name an existing executable file.')
    return args


def main() -> int:
    args = arguments()
    if not args.wrapper and not shutil.which('agent-browser'):
        raise RuntimeError('Install agent-browser and its browser before running this tool, or provide --wrapper. No packages were installed.')
    browser = Browser(args.wrapper, args.session or args.new_session, args.timeout)
    if args.new_session:
        browser.env.setdefault('AGENT_BROWSER_ARGS', '--use-gl=angle,--use-angle=swiftshader')
    active = browser.call('session', 'list').get('sessions', [])
    if args.session and args.session not in active:
        raise RuntimeError(f'Test session {args.session!r} is not active. Use --new-session to create a dedicated one.')
    if args.new_session and args.new_session in active:
        raise RuntimeError(f'Session {args.new_session!r} already exists. Use --session to reuse it.')
    snapshot = source_snapshot()
    records, created, opened_tab, original_tab = [], False, None, None
    try:
        if args.session:
            tabs = browser.call('tab', 'list').get('tabs', [])
            original_tab = next((tab.get('index') for tab in tabs if tab.get('active')), None)
            opened_tab = browser.call('tab', 'new', 'about:blank')['index']
            browser.call('open', args.url + RENDER_PAGE)
        else:
            created = True
            browser.call('open', args.url + RENDER_PAGE)
        ready = browser.wait_ready(args.timeout)
        browser.verify_served_sources(snapshot)
        roster = ready['roster']
        if args.finalize and len(roster) != 12:
            raise RuntimeError(f'Finalization requires all 12 artists; renderer has {len(roster)}.')
        selected = roster if args.finalize else []
        for requested in args.artist:
            matches = [artist for artist in roster if requested.lower() in
                       {str(artist['index']), artist['id'].lower(), artist['name'].lower()}]
            if len(matches) != 1:
                raise RuntimeError(f'Artist {requested!r} does not uniquely match a roster index, ID or full name.')
            if matches[0] not in selected:
                selected.append(matches[0])
        modes = ['card', 'face'] if args.mode == 'both' else [args.mode]
        # All PNGs are retained in memory until transport checks and the source
        # snapshot agree, so a failed capture never leaves mixed final portraits.
        pending = []
        for artist in selected:
            for mode in modes:
                result = browser.evaluate(f'''(async () => {{
                  const dataURL = await window.portraitRender.render({artist['index']}, {json.dumps(mode)});
                  return {{dataURL, state: JSON.parse(JSON.stringify(window.portraitRender.state))}};
                }})()''')
                state = result['state']
                if state.get('id') != artist['id'] or state.get('attachedDesignId') != artist['id'] or not state.get('refined') or state.get('error'):
                    raise RuntimeError(f"Renderer identity or refined-model check failed for {artist['id']}.")
                data_url = result['dataURL']
                if not data_url.startswith('data:image/png;base64,'):
                    raise RuntimeError('Renderer returned an unexpected image format.')
                png = base64.b64decode(data_url.split(',', 1)[1], validate=True)
                metrics = inspect_png(png, 768, 768 if mode == 'face' else 896)
                if args.finalize:
                    destination = ROOT / (f"assets/portraits/{artist['team']}-{artist['role']}.png" if mode == 'card'
                                          else f"outputs/character-portraits/{artist['id']}.png")
                else:
                    destination = args.preview_dir / mode / f"{artist['id']}.png"
                record = {'artist': artist, 'mode': mode, 'path': output_reference(destination), 'bytes': len(png),
                          'sha256': hashlib.sha256(png).hexdigest(), 'png': metrics, 'render': state}
                if args.finalize and mode == 'face':
                    hud_face = ROOT / f"assets/portraits/faces/{artist['team']}-{artist['role']}.png"
                    record['copies'] = [output_reference(hud_face)]
                    pending.append((hud_face, png))
                records.append(record)
                pending.append((destination, png))
                print(f"Prepared {artist['id']} {mode}: {metrics['width']}×{metrics['height']}, {len(png):,} bytes", flush=True)
        if source_snapshot() != snapshot:
            raise RuntimeError('Character sources or GLB assets changed during capture. Nothing was written; rerun from a stable final build.')
        browser.verify_served_sources(snapshot)
        manifest = {'finalized': args.finalize, 'renderer': args.url + RENDER_PAGE,
                    'sourceSha256': snapshot, 'servedSourceSha256': snapshot, 'captures': records}
        manifest_path = (ROOT / 'outputs/character-portraits' if args.finalize else args.preview_dir) / 'render-manifest.json'
        pending.append((manifest_path, (json.dumps(manifest, indent=2) + '\n').encode()))
        publish_batch(pending)
        copies = sum(len(record.get('copies', [])) for record in records)
        print(f"Wrote {len(records)} verified {'final' if args.finalize else 'preview'} portraits and {copies} HUD copies. Manifest: {manifest_path}")
        return 0
    finally:
        if created and not args.keep_open:
            try:
                browser.call('close')
            except (RuntimeError, subprocess.TimeoutExpired) as error:
                print(f'Browser cleanup: {error}', file=sys.stderr)
        elif args.session and opened_tab is not None:
            try:
                browser.call('tab', 'close', str(opened_tab))
                if original_tab is not None:
                    browser.call('tab', str(original_tab))
            except (RuntimeError, subprocess.TimeoutExpired) as error:
                print(f'Test-tab cleanup: {error}', file=sys.stderr)


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (RuntimeError, OSError, ValueError, KeyError, subprocess.TimeoutExpired) as error:
        print(f'Portrait capture failed: {error}', file=sys.stderr)
        raise SystemExit(1)
