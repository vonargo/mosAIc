// View registry. A view is { id, title, render(mount) }.
// Add a module here and it appears in the sidebar and routes automatically.
import { welcome } from './welcome.js';
import { doc } from './doc.js';

export const VIEWS = [welcome, doc];

export function getView(id) {
  return VIEWS.find(v => v.id === id) || null;
}
