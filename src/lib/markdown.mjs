import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

export function renderMarkdown(body) {
  return sanitizeHtml(marked.parse(body, { async: false, gfm: true }), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'del', 'input'],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'title'],
      input: ['type', 'checked', 'disabled'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      input: () => ({
        tagName: 'input',
        attribs: { type: 'checkbox', disabled: '' },
      }),
    },
  });
}
