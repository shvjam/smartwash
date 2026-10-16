/**
 * Keeps React working when a browser extension rearranges the page under it.
 *
 * Extensions that fix text direction, translate or highlight words wrap React's text in their
 * own elements. React still holds the old nodes, and its next update fails with "Failed to
 * execute 'insertBefore' on 'Node'" — which took the whole screen down in the middle of moving
 * a car to its next stage. When the node React wants is no longer where it left it, these
 * versions do the nearest sensible thing instead of throwing: append, or skip the removal.
 * This is the workaround the React team suggests for the problem (facebook/react#11538).
 */
export function guardDomAgainstExtensions() {
  if (typeof Node !== 'function' || !Node.prototype) return;
  const proto = Node.prototype as Node & { __swGuarded?: boolean };
  if (proto.__swGuarded) return;
  proto.__swGuarded = true;

  const removeChild = proto.removeChild;
  proto.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      // Moved elsewhere by an extension: take it out of wherever it ended up.
      child.parentNode?.removeChild(child);
      return child;
    }
    return removeChild.call(this, child) as T;
  };

  const insertBefore = proto.insertBefore;
  proto.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) {
      return this.appendChild(node) as T;
    }
    return insertBefore.call(this, node, ref) as T;
  };
}
