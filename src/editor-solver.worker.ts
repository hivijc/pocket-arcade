// Runs the par search off the editor's main thread.
import manifestJson from '../assets/manifest.json';
import { parseHole } from './world/hole';
import { parseManifest } from './world/manifest';
import { solve } from './world/solver';

const manifest = parseManifest(manifestJson);

self.onmessage = (e: MessageEvent<unknown>) => {
  try {
    const hole = parseHole(e.data, manifest, 'editor');
    self.postMessage({ ok: true, par: hole.par, ...solve(hole) });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) });
  }
};
