export const PORTAL_ART = '/realms/buildings/portal/building.png';
export const PORTAL_GROUND = 0.655;
export function drawPortal(ctx: CanvasRenderingContext2D,image: HTMLImageElement,ms:number,x:number,y:number,size:number) {
  const t=ms/1000;
  ctx.save();ctx.translate(x,y);ctx.scale(size/400,size/400);ctx.imageSmoothingEnabled=false;
  ctx.drawImage(image,0,0,400,400);
  ctx.save();ctx.translate(212,160);ctx.transform(1,.24,0,1,0,0);
  ctx.beginPath();ctx.ellipse(0,0,25,60,0,0,Math.PI*2);ctx.clip();
  ctx.fillStyle='#063b8f';ctx.fillRect(-32,-70,64,140);ctx.scale(.44,1);
  for(let arm=0;arm<3;arm++){
    ctx.beginPath();for(let i=0;i<=140;i++){
      const r=i*.44,a=i*.075-t*.8+arm*Math.PI*2/3,px=Math.cos(a)*r,py=Math.sin(a)*r;
      if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
    }
    ctx.strokeStyle='#087af4';ctx.lineWidth=12;ctx.stroke();
    ctx.strokeStyle='#35dfff';ctx.lineWidth=4;ctx.stroke();
    ctx.strokeStyle='#c7fbff';ctx.lineWidth=1;ctx.stroke();
  }
  ctx.restore();
  for(const [tx,ty,seed] of [[84,239,0],[177,292,2]]){
    const f=Math.sin(t*7+seed)*2+Math.sin(t*11+seed);
    ctx.beginPath();ctx.moveTo(tx-5,ty);ctx.lineTo(tx-6,ty-6);ctx.lineTo(tx-2,ty-11);
    ctx.lineTo(tx+f,ty-19);ctx.lineTo(tx+4,ty-9);ctx.lineTo(tx+6,ty-4);ctx.closePath();
    ctx.fillStyle='#ef7d1c';ctx.fill();ctx.fillStyle='#ffdb67';ctx.fillRect(tx-2,ty-9,4,9);
    ctx.fillStyle='#fff1be';ctx.fillRect(tx-1,ty-5,2,4);
    for(let i=0;i<3;i++){
      const age=(t*.45+i/3+seed*.1)%1;ctx.globalAlpha=1-age;ctx.fillStyle='#ffd277';
      ctx.fillRect(Math.round(tx+Math.sin(age*5+i)*3),Math.round(ty-12-age*19),1,2);
    }ctx.globalAlpha=1;
  }
  for(const [gx,gy,seed] of [[213,64,0],[164,103,1],[250,143,2],[250,171,3]]){
    ctx.globalAlpha=Math.max(0,Math.sin(t*1.8+seed*2))*.75;ctx.fillStyle='#c7ffff';
    ctx.fillRect(gx-3,gy,7,1);ctx.fillRect(gx,gy-3,1,7);
  }
  for(let i=0;i<6;i++){
    const age=(t*.09+i/6)%1;ctx.globalAlpha=Math.sin(age*Math.PI)*.65;
    ctx.fillStyle=i%2?'#9abd42':'#54a753';
    ctx.fillRect(Math.round((i%2?319:107)+Math.sin(age*8+i)*9),Math.round(93+age*91),3,1);
  }ctx.restore();
}
