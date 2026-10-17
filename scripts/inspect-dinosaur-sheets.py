"""Inspect alpha seams and write crop metadata only; never alters artwork pixels."""
from pathlib import Path
from PIL import Image
import json

root = Path(__file__).resolve().parents[1]
result = {}
for path in sorted((root / 'public/realms/dinosaurs').glob('*.png')):
    image = Image.open(path).convert('RGBA')
    width, height = image.size
    alpha = image.getchannel('A')
    pixels = alpha.load()
    # Connected alpha islands identify the fifteen actual characters, including
    # tails/weapons which can cross the nominal grid. Only metadata is emitted.
    from collections import deque
    seen = bytearray(width * height)
    components = []
    for y in range(height):
        for x in range(width):
            key = y * width + x
            if seen[key] or pixels[x, y] < 96: continue
            queue = deque([(x, y)])
            seen[key] = 1
            component = set()
            while queue:
                xx, yy = queue.popleft()
                component.add((xx, yy))
                for nx, ny in ((xx-1, yy), (xx+1, yy), (xx, yy-1), (xx, yy+1)):
                    if not (0 <= nx < width and 0 <= ny < height): continue
                    nk = ny * width + nx
                    if not seen[nk] and pixels[nx, ny] >= 96:
                        seen[nk] = 1
                        queue.append((nx, ny))
            if len(component) > 500: components.append(component)
    characters = sorted(components, key=len, reverse=True)[:15]
    if len(characters) != 15: raise ValueError(f'Expected 15 characters: {path}')
    def bounds(component):
        xs, ys = zip(*component)
        return min(xs), min(ys), max(xs)+1, max(ys)+1
    characters.sort(key=lambda c: (bounds(c)[1] + bounds(c)[3]) / 2)
    ordered = []
    for row in range(5):
        ordered.extend(sorted(characters[row*3:row*3+3], key=lambda c: (bounds(c)[0] + bounds(c)[2]) / 2))
    cells = []
    for component in ordered:
        x1, y1, x2, y2 = bounds(component)
        edges = {}
        def edge(start, end): edges.setdefault(start, []).append(end)
        for x, y in component:
            if (x, y-1) not in component: edge((x, y), (x+1, y))
            if (x+1, y) not in component: edge((x+1, y), (x+1, y+1))
            if (x, y+1) not in component: edge((x+1, y+1), (x, y+1))
            if (x-1, y) not in component: edge((x, y+1), (x, y))
        loops = []
        while edges:
            start = next(iter(edges))
            point = start
            loop = [point]
            while point in edges:
                destinations = edges[point]
                point_next = destinations.pop()
                if not destinations: del edges[point]
                point = point_next
                if point == start: break
                loop.append(point)
            if point == start: loops.append(loop)
        outline = max(loops, key=len)
        # Remove redundant points on straight edges.
        outline = [point for i, point in enumerate(outline)
                   if (point[0]-outline[i-1][0], point[1]-outline[i-1][1]) !=
                      (outline[(i+1)%len(outline)][0]-point[0], outline[(i+1)%len(outline)][1]-point[1])]
        contour = 'M' + 'L'.join(f'{x},{y}' for x, y in outline) + 'Z'
        cells.append({'x': x1, 'y': y1, 'width': x2-x1, 'height': y2-y1, 'path': contour})
    result[path.stem] = {'width': width, 'height': height, 'cells': cells}
split = root / 'src/realms/dinosaur-crop-data'
split.mkdir(exist_ok=True)
for element, sheet in result.items():
    (split / (element + '.json')).write_text(json.dumps(sheet, separators=(',', ':'))+'\n', encoding='utf-8')
(root / 'src/realms/dinosaur-crops.json').write_text(json.dumps(result, indent=2)+'\n', encoding='utf-8')
print(f'Inspected {len(result)} sheets / {len(result)*15} character crops; artwork unchanged.')
