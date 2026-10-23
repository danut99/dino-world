import rigData from '../../public/realms/buildings/windmill/rig.json';
export const FARM_ART = '/realms/buildings/windmill/building.png';
export const FARM_GROUND = 0.655;
export const FARM_LEVEL_ONE_ART = '/realms/buildings/farm-states/level-1.png';
export const FARM_LEVEL_ONE_GROUND = 0.595;
export const FARM_LEVEL_TWO_ART = '/realms/buildings/farm-states/level-2.png';
export const FARM_LEVEL_THREE_ART = '/realms/buildings/farm-states/level-3.png';
const levelOneRig: typeof rigData = {
  canvas: { width: 400, height: 400 }, image: 'level-1.png',
  rotor: { x: 304, y: 142, radius: 45, squash: 0.95, shear: 0.12, phase: -0.6, secondsPerTurn: 12 },
  chimney: { x: 98, y: 125 },
};
export const FARM_STATES = [
  { from: 1, art: FARM_LEVEL_ONE_ART, ground: FARM_LEVEL_ONE_GROUND, rig: levelOneRig },
  {
    from: 2, art: FARM_LEVEL_TWO_ART, ground: 0.56,
    rig: {
      canvas: { width: 400, height: 400 }, image: 'level-2.png',
      rotor: { x: 307, y: 124, radius: 44, squash: 0.95, shear: 0.12, phase: -0.6, secondsPerTurn: 12 },
      chimney: { x: 119, y: 91 },
    },
  },
  {
    from: 3, art: FARM_LEVEL_THREE_ART, ground: 0.62,
    rig: {
      canvas: { width: 400, height: 400 }, image: 'level-3.png',
      rotor: { x: 307, y: 151, radius: 46, squash: 0.95, shear: 0.12, phase: -0.6, secondsPerTurn: 12 },
      chimney: { x: 117, y: 115 },
    },
  },
];
const farmSource = (image: HTMLImageElement | string) => typeof image === 'string' ? image : image.src;
export const isAnimatedFarm = (image: HTMLImageElement | string) =>
  farmSource(image).endsWith(FARM_ART) || FARM_STATES.some(state => farmSource(image).endsWith(state.art));
export const farmGround = (image: HTMLImageElement | string) =>
  FARM_STATES.find(state => farmSource(image).endsWith(state.art))?.ground ?? FARM_GROUND;
// Reusable, deterministic building animation. Coordinates are native asset pixels.
export class Windmill {
  constructor(public image: HTMLImageElement, public rig: typeof rigData = rigData) { this.image = image; this.rig = rig; }
  draw(ctx: CanvasRenderingContext2D, time: number, { x = 0, y = 0, scale = 1, smoke = true, speed = 1 } = {}) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(scale, scale); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.image, 0, 0);
    const { rotor, chimney } = this.rig;
    // Project a rotating wheel into the tower's oblique vertical plane.
    ctx.save(); ctx.translate(rotor.x, rotor.y);
    ctx.transform(1, rotor.shear, 0, rotor.squash, 0, 0);
    const angle = (rotor.phase || 0) + time * speed * Math.PI * 2 / rotor.secondsPerTurn;
    for (let i = 0; i < 4; i++) {
      ctx.save(); ctx.rotate(angle + i * Math.PI / 2);
      const r = rotor.radius;
      const poly = (points: number[][], fill: string, stroke?: string) => {
        ctx.beginPath(); points.forEach(([px, py], n) => n ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
        ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
      };
      poly([[5,-3],[r,-3],[r,3],[5,3]], '#92603a', '#37271c');
      poly([[r*.30,-4],[r*.96,-4],[r*.96,-20],[r*.38,-14]], '#eee0b6', '#543a24');
      poly([[r*.38,-12],[r*.94,-18],[r*.94,-15],[r*.36,-9]], '#fff0cc');
      ctx.strokeStyle = '#a48656'; ctx.lineWidth = 1;
      for (let k = 0; k < 6; k++) {
        const a = .40 + k*.10;
        ctx.beginPath(); ctx.moveTo(r*a,-4); ctx.lineTo(r*a,-14-(a-.38)*10); ctx.stroke();
      }
      ctx.strokeStyle = '#c6b083'; ctx.beginPath(); ctx.moveTo(r*.34,-8); ctx.lineTo(r*.96,-12); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = '#352419'; ctx.fillRect(-6,-6,12,12);
    ctx.fillStyle = '#ad7743'; ctx.fillRect(-4,-4,8,8);
    ctx.fillStyle = '#e5ba70'; ctx.fillRect(-2,-3,3,3);
    ctx.restore();
    if (smoke) for (let i = 0; i < 9; i++) {
      const age = (time*.19 + i/9) % 1;
      const px = Math.round(chimney.x + age*15 + Math.sin(age*5+i*.6)*age*4);
      const py = Math.round(chimney.y - age*45);
      const size = Math.round(3 + age*8);
      ctx.globalAlpha = Math.sin(Math.PI*age)*.34;
      ctx.fillStyle = i%2 ? '#d8d7c4' : '#b5b8ac';
      // Stepped silhouettes remain legible under integer pixel scaling.
      ctx.fillRect(px-size+2,py-size,size*2-4,size*2);
      ctx.fillRect(px-size,py-size+2,size*2,size*2-4);
    }
    ctx.restore();
  }
}

export function drawFarm(ctx: CanvasRenderingContext2D, image: HTMLImageElement, ms: number, x: number, y: number, size: number) {
  const rig = FARM_STATES.find(state => image.src.endsWith(state.art))?.rig ?? rigData;
  new Windmill(image, rig).draw(ctx, ms / 1000, { x, y, scale: size / rig.canvas.width, smoke: ms > 0 });
}
