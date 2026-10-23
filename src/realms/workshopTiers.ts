// Each source is padded intact; coordinates below are measured on the source PNG.
export const WORKSHOP_STATES = [
  { from: 1, art: '/realms/buildings/workshop-states/level-1.webp', dx: 20, dy: 56, width: 136, ground: .75, chimneys: [[136,43],[135,78]], forge: [127,118], hoist: [42,67] },
  { from: 2, art: '/realms/buildings/workshop-states/level-2.webp', dx: 21, dy: 38, width: 176, ground: .6875, chimneys: [[97,44],[113,35],[138,51]], forge: [111,123], hoist: [37,60] },
  { from: 3, art: '/realms/buildings/workshop-states/level-3.webp', dx: 20, dy: 34, width: 196, ground: .670833, chimneys: [[95,36],[112,26],[141,43]], forge: [111,119], hoist: [30,53] },
];
export const workshopState = (image: HTMLImageElement | string) => {
  const src = typeof image === 'string' ? image : image.src;
  return WORKSHOP_STATES.find(s => src.endsWith(s.art));
};
const bases = new WeakMap<HTMLImageElement, HTMLCanvasElement>();
export function drawWorkshopTier(ctx: CanvasRenderingContext2D, image: HTMLImageElement, ms: number, x: number, y: number, size: number) {
  const s = workshopState(image); if (!s) return;
  let base = bases.get(image);
  if (!base) {
    base = document.createElement('canvas'); base.width = base.height = 240;
    const local = base.getContext('2d')!; local.drawImage(image,0,0,240,240);
    // Stop above the yard: clearing a fixed tall strip used to erase the foundation.
    const ropeEnd = s.from === 3 ? 113 : 108;
    local.clearRect(s.hoist[0]+s.dx-3,s.hoist[1]+s.dy+4,7,ropeEnd-s.hoist[1]-4);
    bases.set(image,base);
  }
  ctx.save(); ctx.translate(x,y); ctx.scale(size/240,size/240); ctx.imageSmoothingEnabled=false;
  ctx.drawImage(base,0,0,240,240); ctx.translate(s.dx,s.dy);
  const t=ms/1000;
  for (const [i,[cx,cy]] of s.chimneys.entries()) for(let k=0;k<6;k++) {
    const age=(t*.18+k/6+i*.17)%1, r=1+Math.round(age*3);
    ctx.globalAlpha=Math.sin(age*Math.PI)*.45;ctx.fillStyle=k%2?'#d7d3bd':'#a9ada1';
    ctx.fillRect(Math.round(cx+age*5)-r,Math.round(cy-age*22)-r,r*2+1,r*2);
  }
  ctx.globalAlpha=1;
  const [fx,fy]=s.forge;
  ctx.save();ctx.beginPath();ctx.rect(fx-7,fy-9,14,10);ctx.clip();
  ctx.fillStyle='#a43a10';ctx.fillRect(fx-7,fy-9,14,10);
  for(let i=0;i<5;i++){const h=3+Math.round((Math.sin(t*8+i*2)+1)*2);ctx.fillStyle=i%2?'#ffcf58':'#f58921';ctx.fillRect(fx-6+i*3,fy-h,3,h);}
  ctx.restore();
  // Rope remains anchored to the hoist; animated load travels in open air.
  const [hx,hy]=s.hoist;
  const travel = Math.round((1-Math.cos(t*Math.PI/5))*5);
  const bottom=hy+25+travel;
  // A supported wooden pulley block at the boom tip, rather than a loose stone.
  ctx.fillStyle='#34281b';ctx.fillRect(hx-4,hy-4,8,8);
  ctx.fillStyle='#795331';ctx.fillRect(hx-3,hy-3,6,6);
  ctx.fillStyle='#bd945a';ctx.fillRect(hx-2,hy-2,4,1);ctx.fillRect(hx-2,hy+1,4,1);
  ctx.fillRect(hx-2,hy-1,1,2);ctx.fillRect(hx+1,hy-1,1,2);
  ctx.fillStyle='#423526';ctx.fillRect(hx-1,hy-1,2,2);
  ctx.fillStyle='#35291e';ctx.fillRect(hx-1,hy+2,2,bottom-hy-2);
  ctx.fillStyle='#aa8855';ctx.fillRect(hx,hy+2,1,bottom-hy-2);
  // Small iron J-hook, suspended from a continuous rope, rather than a moving block.
  ctx.fillStyle='#302e2b';ctx.fillRect(hx-1,bottom,3,2);
  ctx.fillRect(hx-2,bottom+2,2,4);ctx.fillRect(hx-1,bottom+5,4,2);ctx.fillRect(hx+2,bottom+2,2,4);
  ctx.fillStyle='#a4a494';ctx.fillRect(hx-1,bottom+2,1,3);ctx.fillRect(hx,bottom+5,2,1);ctx.fillRect(hx+2,bottom+2,1,2);
  const [wx,wy] = s.from===1 ? [67,84] : s.from===2 ? [76,82] : [72,77];
  // Visible return strand links the tip pulley to the existing winding wheel.
  const steps=Math.max(Math.abs(wx-hx),Math.abs(wy-hy));
  ctx.fillStyle='#be9b63';
  for(let i=0;i<=steps;i++) ctx.fillRect(Math.round(hx+(wx-hx)*i/steps),Math.round(hy+2+(wy-hy-2)*i/steps),1,1);
  // Repaint the wheel interior so baked spokes cannot remain behind the moving ones.
  ctx.fillStyle='#39291e';ctx.fillRect(wx-4,wy-5,9,11);ctx.fillRect(wx-5,wy-3,11,7);
  const angle=travel/4;
  ctx.fillStyle='#b28c54';
  for(let spoke=0;spoke<4;spoke++) for(let radius=1;radius<=4;radius++) {
    const a=angle+spoke*Math.PI/2;
    ctx.fillRect(wx+Math.round(Math.cos(a)*radius),wy+Math.round(Math.sin(a)*radius),1,1);
  }
  ctx.fillStyle='#d1ad70';ctx.fillRect(wx,wy,1,1);
  ctx.restore();
}
