// Reusable, deterministic building animation. Coordinates are native asset pixels.
export class Windmill {
  constructor(image, rig) { this.image = image; this.rig = rig; }
  draw(ctx, time, { x = 0, y = 0, scale = 1, smoke = true, speed = 1 } = {}) {
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
      const poly = (points, fill, stroke) => {
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
