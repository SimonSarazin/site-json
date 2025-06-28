import DOMPurify from 'isomorphic-dompurify';

/** Sanitize arbitrary HTML for use with dangerouslySetInnerHTML.
 *  Works both on the server (via jsdom) and on the client.
 */
export function sanitize(html: string): string {
  return DOMPurify.sanitize(html);
}
