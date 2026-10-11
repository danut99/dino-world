import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DinoSprite } from './WorldScreen';

function renderDinosaur(animated: boolean, live: boolean, failed = false) {
  return renderToStaticMarkup(
    <svg>
      <DinoSprite
        species="ignisaur"
        level={1}
        x={0}
        y={0}
        flip={false}
        delay={0}
        animated={animated}
        live={live}
        failed={failed}
      />
    </svg>,
  );
}

describe('map dinosaur visibility', () => {
  it('keeps static artwork hidden while animation loads, preserving its fade-in', () => {
    expect(renderDinosaur(true, false)).not.toContain('<image');
  });

  it('shows saved artwork after animation loading fails', () => {
    expect(renderDinosaur(true, false, true)).toContain('dinosaurs/previews/ignisaur-pui.webp');
  });

  it('switches to the animated renderer only for a loaded dinosaur', () => {
    const markup = renderDinosaur(true, true);
    expect(markup).not.toContain('<image');
    expect(markup).toContain('fill="transparent"');
    expect(renderDinosaur(true, true, true)).not.toContain('<image');
  });

  it('shows saved artwork when animation is unavailable', () => {
    expect(renderDinosaur(false, false)).toContain('dinosaurs/previews/ignisaur-pui.webp');
    expect(renderDinosaur(false, true)).toContain('dinosaurs/previews/ignisaur-pui.webp');
  });
});
