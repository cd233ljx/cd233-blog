import { parseLocalSource, renderLocalPreview } from './local-preview.mjs';
let previousSaved: string | undefined;
let savedComponents = false;
let savedComponentSource = '';
self.onmessage = (
  event: MessageEvent<{ id: number; body: string; savedBody: string }>,
) => {
  const { id, body, savedBody } = event.data;
  try {
    if (savedBody !== previousSaved) {
      const saved = parseLocalSource(savedBody);
      savedComponents = saved.components;
      savedComponentSource = saved.componentSource;
      previousSaved = savedBody;
    }
    self.postMessage({
      id,
      ...renderLocalPreview(body),
      savedComponents,
      savedComponentSource,
    });
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : '预览暂时无法更新',
    });
  }
};
