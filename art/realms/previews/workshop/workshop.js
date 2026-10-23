export class Workshop {
  constructor(image) { this.image = image; }
  draw(ctx,time,{smoke=true,speed=1}={}) {
    ctx.save(); ctx.imageSmoothingEnabled=false;
    ctx.drawImage(this.image,0,0);
    // The suspended load and rope are isolated against transparency.
    ctx.clearRect(40,46,53,137);
    const phase=time*speed*Math.PI*2/12;
    const lift=Math.round(16*(1-Math.cos(phase)));
    const cy=122+lift;
    ctx.strokeStyle='#382719';ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(67,43);ctx.lineTo(67,cy+2);ctx.stroke();
    ctx.strokeStyle='#d6aa63';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(67,43);ctx.lineTo(67,cy+2);ctx.stroke();
    ctx.drawImage(this.image,41,122,51,59,41,cy,51,59);
    // Wheel spokes rotate with the linear travel of the rope.
    ctx.save();ctx.translate(70,35);ctx.rotate(-lift/6);
    ctx.strokeStyle='#b48a4c';ctx.lineWidth=1;
    for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(5,0);ctx.stroke();}
    ctx.fillStyle='#332418';ctx.fillRect(-1,-1,3,3);ctx.restore();
    // Confine the furnace glow to the existing open arch.
    ctx.save();ctx.beginPath();ctx.ellipse(165,224,14,18,0,Math.PI,Math.PI*2);ctx.lineTo(179,245);ctx.lineTo(151,245);ctx.closePath();ctx.clip();
    ctx.globalCompositeOperation='screen';
    ctx.globalAlpha=.12+.08*Math.sin(time*4)+.035*Math.sin(time*9);
    ctx.fillStyle='#ff9d24';ctx.fillRect(149,205,34,41);ctx.restore();
    for(let i=0;i<6;i++){
      const age=(time*.55+i/6)%1;
      ctx.globalAlpha=Math.sin(age*Math.PI)*.8;
      ctx.fillStyle=i%2?'#ffd879':'#ed942a';
      ctx.fillRect(Math.round(161+Math.sin(i*2+age*4)*8),Math.round(238-age*26),1,2);
    }
    if(smoke)for(let i=0;i<10;i++){
      const age=(time*.18+i/10)%1,size=Math.round(3+age*7);
      const x=Math.round(298+age*15+Math.sin(age*5+i)*age*3),y=Math.round(48-age*34);
      ctx.globalAlpha=Math.sin(age*Math.PI)*.42;ctx.fillStyle=i%2?'#c1c4bd':'#deded0';
      ctx.fillRect(x-size+2,y-size,size*2-4,size*2);
      ctx.fillRect(x-size,y-size+2,size*2,size*2-4);
    }
    ctx.restore();
  }
}
