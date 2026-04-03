// ─── HAUL v2: 2D PvPvE Extraction ───
// "다르면 차별한다" — 동물별 완전히 다른 플레이 경험
// 비둘기(안전/느림) · 고양이(변수/밸런스) · 들쥐(위험/보상+지하세계)
import { MinigameBase, rgba, C } from './base';

const GRAV = 1400;
const LOOT_DUR = 0.9;
const GND_R = 0.78;
const SEWER_H_R = 0.14;

interface AnimalDef {
    name: string; sym: string; color: string;
    hp: number; slots: number; jumpV: number; spd: number;
    detectMul: number; desc: string; ability: string;
    coreMul: number; extractTime: number; scoreMul: number; maxTier: number;
    glide?: boolean; wallClimb?: boolean; sewer?: boolean;
}
const ANIM: Record<string, AnimalDef> = {
    pigeon: { name: '비둘기', sym: '🐦', color: C.blue, hp: 60, slots: 3, jumpV: -420, spd: 170, detectMul: 0.3, desc: '안전하지만 느리다', ability: '활공 · 인간 무시', coreMul: 0.5, extractTime: 6.0, scoreMul: 0.7, maxTier: 1, glide: true },
    cat: { name: '길고양이', sym: '🐱', color: C.accent, hp: 100, slots: 6, jumpV: -560, spd: 190, detectMul: 1.0, desc: '인간이 예측 불가능', ability: '벽점프 · 옥상 루트', coreMul: 1.0, extractTime: 4.0, scoreMul: 1.0, maxTier: 3, wallClimb: true },
    rat: { name: '들쥐', sym: '🐀', color: C.purple, hp: 75, slots: 5, jumpV: -380, spd: 210, detectMul: 2.0, desc: '위험하지만 보상이 크다', ability: '하수도 · 코어 ×1.5', coreMul: 1.5, extractTime: 3.0, scoreMul: 1.3, maxTier: 3, sewer: true },
};
interface StageDef { mapW: number; civs: number; guards: number; cans: number; time: number; pipes: number; sewerCans: number; sewerTraps: number; }
const STAGES: StageDef[] = [
    { mapW: 2200, civs: 2, guards: 0, cans: 5, time: 55, pipes: 2, sewerCans: 3, sewerTraps: 2 },
    { mapW: 3000, civs: 3, guards: 1, cans: 7, time: 65, pipes: 3, sewerCans: 4, sewerTraps: 4 },
    { mapW: 3800, civs: 3, guards: 2, cans: 9, time: 80, pipes: 3, sewerCans: 5, sewerTraps: 5 },
];
interface Plat { x: number; y: number; w: number; h: number; }
interface Trash { x: number; y: number; core: number; tier: number; looted: boolean; isSewer: boolean; }
interface Pipe { x: number; ex: number; }
interface STrap { x: number; y: number; triggered: boolean; }
interface Human { x: number; y: number; type: 'civ'|'guard'; pL: number; pR: number; dir: 1|-1; st: 'patrol'|'alert'|'chase'|'attack'|'pet'|'back'; alertT: number; petT: number; spd: number; det: number; atkCd: number; }
interface BgB { x: number; h: number; w: number; c: string; }
type Phase = 'select'|'intro'|'play'|'clear'|'dead'|'result';

class HaulGame extends MinigameBase {
    protected readonly title = 'HAUL';
    protected readonly titleColor = C.yellow;
    private selA = ''; private aD!: AnimalDef; private hovA: string|null = null;
    private gndY = 0; private sewerFloor = 0; private mapW = 0;
    private plats: Plat[] = []; private cans: Trash[] = []; private pipes: Pipe[] = [];
    private traps: STrap[] = []; private humans: Human[] = []; private exZ = {x:0,w:130}; private bgB: BgB[] = [];
    private camX = 0;
    private px = 0; private py = 0; private pvx = 0; private pvy = 0; private pDir: 1|-1 = 1;
    private onGnd = false; private hp = 100; private iF = 0;
    private core = 0; private maxC = 3;
    private gliding = false; private wallSl = false; private inSewer = false;
    private lootTgt: Trash|null = null; private lootP = 0;
    private extracting = false; private exP = 0;
    private phase: Phase = 'select'; private phT = 0; private stage = 0;
    private stTime = 0; private score = 0; private totCore = 0;
    private stRes: {core:number;time:number;animal:string}[] = [];
    private shX = 0; private shY = 0; private alertFl = 0; private petFlash = 0;
    private tDir = {x:0,y:0}; private tJump = false;

    protected resetGame(): void { this.stage=0; this.score=0; this.totCore=0; this.stRes=[]; this.selA=''; this.phase='select'; }
    protected onResized(): void { this.gndY=this.H*GND_R; this.sewerFloor=this.gndY+this.H*SEWER_H_R; }

    private startStage(): void {
        const s=STAGES[this.stage]; const d=ANIM[this.selA]; this.aD=d;
        this.gndY=this.H*GND_R; this.sewerFloor=this.gndY+this.H*SEWER_H_R; this.mapW=s.mapW;
        this.px=80; this.py=this.gndY-18; this.pvx=0; this.pvy=0; this.pDir=1;
        this.onGnd=false; this.hp=d.hp; this.core=0; this.maxC=d.slots;
        this.iF=0; this.gliding=false; this.wallSl=false; this.inSewer=false;
        this.lootTgt=null; this.lootP=0; this.extracting=false; this.exP=0;
        this.shX=0; this.shY=0; this.alertFl=0; this.petFlash=0; this.camX=0;
        this.pts=[]; this.pops=[]; this.tDir={x:0,y:0}; this.tJump=false;
        this.exZ={x:this.mapW-170,w:130}; this.genMap(s); this.stTime=s.time; this.phase='intro'; this.phT=1.3;
    }

    private genMap(s: StageDef): void {
        const gY=this.gndY;
        this.plats=[];
        const gap=(this.mapW-400)/(Math.floor(this.mapW/450)+1);
        for(let x=280;x<this.mapW-350;x+=gap+Math.random()*80){
            const w=90+Math.random()*110,h=55+Math.random()*95;
            this.plats.push({x,y:gY-h,w,h});
            if(Math.random()<0.35&&h>70){const w2=w*0.55;this.plats.push({x:x+(w-w2)/2,y:gY-h-38-Math.random()*25,w:w2,h:30});}
        }
        this.cans=[];
        const ts=(this.mapW-450)/s.cans;
        for(let i=0;i<s.cans;i++){
            const tx=160+i*ts+Math.random()*ts*0.35;
            const onP=this.plats.find(p=>tx>=p.x&&tx<=p.x+p.w);
            const tier=i<Math.ceil(s.cans*0.4)?1:i<Math.ceil(s.cans*0.75)?2:3;
            this.cans.push({x:tx,y:onP?onP.y:gY,core:[0,1,2,3][tier],tier,looted:false,isSewer:false});
        }
        this.pipes=[];
        const ps=(this.mapW-500)/(s.pipes+1);
        for(let i=0;i<s.pipes;i++){const ex=220+(i+0.5)*ps;this.pipes.push({x:ex,ex:Math.min(ex+250+Math.random()*300,this.mapW-250)});}
        for(let i=0;i<s.sewerCans;i++){this.cans.push({x:200+Math.random()*(this.mapW-400),y:this.sewerFloor,core:3,tier:3,looted:false,isSewer:true});}
        this.traps=[];
        for(let i=0;i<s.sewerTraps;i++){this.traps.push({x:200+Math.random()*(this.mapW-400),y:this.sewerFloor-8,triggered:false});}
        this.humans=[];
        const zW=(this.mapW-400)/(s.civs+s.guards);
        for(let i=0;i<s.civs+s.guards;i++){
            const zs=220+i*zW,t=i<s.civs?'civ' as const:'guard' as const;
            this.humans.push({x:zs+Math.random()*zW*0.4,y:gY-28,type:t,pL:zs-40,pR:zs+zW+40,dir:1,st:'patrol',alertT:0,petT:0,spd:t==='guard'?150:85,det:t==='guard'?180:120,atkCd:0});
        }
        this.bgB=[];
        const cols=[C.purple,C.blue,C.accent,C.pink,C.yellow];
        for(let x=0;x<this.mapW;x+=55+Math.random()*35)this.bgB.push({x,h:35+Math.random()*130,w:28+Math.random()*45,c:cols[Math.floor(Math.random()*cols.length)]});
    }

    private updPlayer(dt: number): void {
        const d=this.aD; let mx=0;
        if(this.keys['KeyA']||this.keys['ArrowLeft'])mx-=1;
        if(this.keys['KeyD']||this.keys['ArrowRight'])mx+=1;
        if(this.tDir.x)mx=this.tDir.x;
        const wJ=this.keys['Space']||this.keys['KeyW']||this.keys['ArrowUp']||this.tJump;
        if((mx!==0||wJ)&&(this.lootTgt||this.extracting)){this.lootTgt=null;this.lootP=0;this.extracting=false;this.exP=0;}
        if(this.inSewer){
            if(mx!==0&&!this.lootTgt){this.pvx=mx*d.spd*1.2;this.pDir=mx>0?1:-1;}else this.pvx*=0.78;
            // 하수도 점프 (쥐덫 회피용)
            const sewerCeil=this.gndY+6, sewerGnd=this.sewerFloor-10;
            if(wJ&&this.onGnd&&!this.lootTgt){this.pvy=-350;this.onGnd=false;this.tJump=false;}
            if(!this.onGnd)this.pvy+=GRAV*dt;
            this.px+=this.pvx*dt; this.py+=this.pvy*dt;
            this.px=Math.max(14,Math.min(this.mapW-14,this.px));
            // 천장 충돌
            if(this.py<sewerCeil){this.py=sewerCeil;this.pvy=0;}
            // 바닥 충돌
            this.onGnd=false;
            if(this.py>=sewerGnd){this.py=sewerGnd;this.pvy=0;this.onGnd=true;}
            this.gliding=false; this.wallSl=false;
        } else {
            if(mx!==0&&!this.lootTgt&&!this.extracting){this.pvx=mx*d.spd;this.pDir=mx>0?1:-1;}else this.pvx*=0.78;
            if(wJ&&this.onGnd&&!this.lootTgt&&!this.extracting){this.pvy=d.jumpV;this.onGnd=false;this.tJump=false;}
            this.gliding=false;
            if(d.glide&&!this.onGnd&&this.pvy>0&&(this.keys['Space']||this.tDir.y<-0.3)){this.pvy=Math.min(this.pvy,50);this.gliding=true;}
            this.wallSl=false;
            if(d.wallClimb&&!this.onGnd){for(const p of this.plats){const oL=Math.abs(this.px-p.x)<8&&this.py>p.y&&this.py<p.y+p.h;const oR=Math.abs(this.px-(p.x+p.w))<8&&this.py>p.y&&this.py<p.y+p.h;if(oL||oR){this.wallSl=true;this.pvy=Math.min(this.pvy,28);if(wJ){this.pvy=d.jumpV*0.85;this.pvx=oL?220:-220;this.wallSl=false;}break;}}}
            if(!this.onGnd&&!this.wallSl)this.pvy+=GRAV*dt;else if(this.wallSl)this.pvy+=GRAV*0.25*dt;
            this.px+=this.pvx*dt;this.py+=this.pvy*dt;this.px=Math.max(14,Math.min(this.mapW-14,this.px));
            this.onGnd=false;if(this.py>=this.gndY-14){this.py=this.gndY-14;this.pvy=0;this.onGnd=true;}
            if(this.pvy>=0)for(const p of this.plats){if(this.px>=p.x-4&&this.px<=p.x+p.w+4&&this.py>=p.y-14&&this.py<=p.y+4&&this.py-this.pvy*dt<p.y-8){this.py=p.y-14;this.pvy=0;this.onGnd=true;break;}}
        }
        this.iF=Math.max(0,this.iF-dt);
    }

    private updHumans(dt: number): void {
        const dm=this.aD.detectMul;
        for(const h of this.humans){
            const dx=this.px-h.x,dist=Math.abs(dx),eR=h.det*dm;
            h.atkCd=Math.max(0,h.atkCd-dt);
            if(this.inSewer&&h.st!=='patrol')h.st='back';
            switch(h.st){
                case 'patrol':h.x+=h.dir*(h.type==='guard'?55:38)*dt;if(h.x>h.pR)h.dir=-1;if(h.x<h.pL)h.dir=1;if(dist<eR&&!this.inSewer){h.st='alert';h.alertT=0;}break;
                case 'alert':h.alertT+=dt;h.dir=dx>0?1:-1;
                    if(this.selA==='pigeon'){if(h.type==='civ'){if(h.alertT>1.8)h.st='back';}else{if(h.alertT>1.2){h.st='chase';this.alertFl=0.2;}}}
                    else if(this.selA==='cat'){if(h.type==='civ'){if(h.alertT>0.6){if(Math.random()<0.5){h.st='pet';h.petT=0;}else{h.st='chase';this.alertFl=0.2;}}}else{if(h.alertT>0.5){h.st='chase';this.alertFl=0.3;}}}
                    else{if(h.alertT>0.2){h.st='chase';this.alertFl=0.35;}}
                    if(dist>eR*1.6)h.st='back';break;
                case 'pet':h.dir=dx>0?1:-1;h.x+=h.dir*65*dt;h.petT+=dt;
                    if(dist<25&&this.onGnd&&!this.inSewer){this.petFlash=2.0;this.pvx=0;this.addPop(this.px,this.py-30,'포획 위험!',true,1.5);h.st='back';h.atkCd=3.0;}
                    if(h.petT>3||dist>eR*2)h.st='back';break;
                case 'chase':h.dir=dx>0?1:-1;h.x+=h.dir*h.spd*dt;if(dist<28&&h.atkCd<=0){h.st='attack';h.atkCd=0.9;}if(dist>eR*2.8)h.st='back';break;
                case 'attack':if(h.atkCd<=0){this.hurt(h.type==='guard'?28:18);h.st='chase';h.atkCd=0.9;}break;
                case 'back':const c=(h.pL+h.pR)/2;h.dir=h.x<c?1:-1;h.x+=h.dir*42*dt;if(Math.abs(h.x-c)<25)h.st='patrol';break;
            }
        }
    }

    private hurt(dmg: number): void {
        if(this.iF>0)return;this.hp-=dmg;this.iF=0.8;
        this.shX=5*(Math.random()>0.5?1:-1);this.shY=3*(Math.random()-0.5);
        this.addBurst(this.px,this.py,C.red,6,80);this.addPop(this.px,this.py-22,`-${dmg}`,false,0.8);
        this.lootTgt=null;this.lootP=0;this.extracting=false;this.exP=0;
        if(this.hp<=0)this.phase='dead';
    }

    private doInteract(): void {
        if(this.lootTgt||this.extracting)return;
        // 하수도 진입 (들쥐, 지상, 입구 근처)
        if(this.aD.sewer&&!this.inSewer&&this.onGnd){for(const p of this.pipes){if(Math.abs(this.px-p.x)<22){this.inSewer=true;this.py=this.sewerFloor-10;this.pvy=0;this.pvx=0;this.addPop(this.px,this.py-20,'하수도 진입!',true,0.8);return;}}}
        // 하수도 탈출 (들쥐, 지하, 입구 or 출구 근처)
        if(this.aD.sewer&&this.inSewer){for(const p of this.pipes){if(Math.abs(this.px-p.x)<22||Math.abs(this.px-p.ex)<22){this.py=this.gndY-18;this.inSewer=false;this.pvy=-200;this.addPop(this.px,this.py-20,'지상 복귀!',false,0.7);return;}}}
        if(!this.inSewer&&this.px>=this.exZ.x&&this.px<=this.exZ.x+this.exZ.w&&this.onGnd){this.extracting=true;this.exP=0;return;}
        for(const t of this.cans){
            if(t.looted||t.isSewer!==this.inSewer)continue;
            if(Math.abs(this.px-t.x)<22&&Math.abs(this.py-t.y)<28){
                if(t.tier>this.aD.maxTier){this.addPop(this.px,this.py-30,`★${t.tier} 루팅 불가!`,false,1.0);return;}
                if(this.core>=this.maxC){this.addPop(this.px,this.py-30,'슬롯 부족!',false,0.8);return;}
                this.lootTgt=t;this.lootP=0;return;
            }
        }
    }

    protected updateGame(dt: number): void {
        if(this.phase==='select')return;
        if(this.phase==='intro'){this.phT-=dt;if(this.phT<=0)this.phase='play';return;}
        if(this.phase==='clear'){this.phT-=dt;if(this.phT<=0){this.stage++;if(this.stage>=STAGES.length)this.phase='result';else this.startStage();}return;}
        if(this.phase!=='play')return;
        this.stTime-=dt;if(this.stTime<=0){this.stTime=0;this.phase='dead';return;}
        if(this.petFlash>0){this.petFlash-=dt;this.pvx=0;}
        if(this.keys['KeyE']||this.keys['KeyF']){this.doInteract();this.keys['KeyE']=false;this.keys['KeyF']=false;}
        if(this.lootTgt){this.lootP+=dt;if(this.lootP>=LOOT_DUR){const g=Math.min(Math.ceil(this.lootTgt.core*this.aD.coreMul),this.maxC-this.core);this.core+=g;this.score+=Math.round(g*100*this.aD.scoreMul);this.lootTgt.looted=true;this.addBurst(this.lootTgt.x,this.lootTgt.y,this.lootTgt.isSewer?C.purple:C.yellow,6,60);this.addPop(this.lootTgt.x,this.lootTgt.y-22,`+${g} ◆`,true,1.0);this.lootTgt=null;this.lootP=0;}}
        if(this.extracting){this.exP+=dt;if(this.exP>=this.aD.extractTime){this.totCore+=this.core;this.score+=Math.round((this.core*200+this.stTime*10)*this.aD.scoreMul);this.stRes.push({core:this.core,time:STAGES[this.stage].time-this.stTime,animal:this.selA});this.addPop(this.px,this.py-40,'탈출 성공!',true,1.5);this.phase='clear';this.phT=1.5;}if(!(this.px>=this.exZ.x&&this.px<=this.exZ.x+this.exZ.w)){this.extracting=false;this.exP=0;}}
        if(this.petFlash<=0)this.updPlayer(dt);
        if(!this.inSewer)this.updHumans(dt);
        if(this.inSewer)for(const tr of this.traps){if(!tr.triggered&&Math.abs(this.px-tr.x)<16&&Math.abs(this.py-tr.y)<14){tr.triggered=true;this.hurt(25);this.addPop(tr.x,tr.y-20,'쥐덫!',true,1.0);}}
        this.shX*=0.84;this.shY*=0.84;this.alertFl=Math.max(0,this.alertFl-dt);
        this.camX+=(this.px-this.W/2-this.camX)*5*dt;this.camX=Math.max(0,Math.min(this.mapW-this.W,this.camX));
        this.updatePts(dt,200);this.updatePops(dt);
    }

    protected renderGame(now: number): void {
        if(this.phase==='select'){this.renderSel(now);return;}
        const{cx,W,H}=this;const cm=this.camX;
        cx.save();cx.translate(this.shX,this.shY);this.drawBg();
        const sg=cx.createLinearGradient(0,0,0,this.gndY);sg.addColorStop(0,'#06060e');sg.addColorStop(0.6,'#0e0e1a');sg.addColorStop(1,'#14142a');
        cx.fillStyle=sg;cx.fillRect(0,0,W,this.gndY);
        cx.fillStyle=rgba('#fff',0.1);for(let i=0;i<20;i++)cx.fillRect((i*137+cm*0.04)%W,(i*97)%(this.gndY*0.5),1.2,1.2);
        for(const b of this.bgB){const bx=b.x-cm*0.25;if(bx<-80||bx>W+80)continue;cx.fillStyle=rgba(b.c,0.025);cx.fillRect(bx,this.gndY-b.h,b.w,b.h);cx.strokeStyle=rgba(b.c,0.05);cx.lineWidth=1;cx.strokeRect(bx,this.gndY-b.h,b.w,b.h);for(let wy=8;wy<b.h-10;wy+=16)for(let wx=4;wx<b.w-4;wx+=12){cx.fillStyle=rgba(b.c,0.03);cx.fillRect(bx+wx,this.gndY-b.h+wy,4,7);}}
        cx.fillStyle=rgba(C.accent,0.035);cx.fillRect(0,this.gndY,W,6);cx.strokeStyle=rgba(C.accent,0.12);cx.lineWidth=2;cx.beginPath();cx.moveTo(0,this.gndY);cx.lineTo(W,this.gndY);cx.stroke();
        // 하수도 레이어
        const swTop=this.gndY+2,swBot=this.sewerFloor+6;
        cx.fillStyle=rgba(C.purple,0.02);cx.fillRect(0,swTop,W,swBot-swTop);
        cx.strokeStyle=rgba(C.purple,0.06);cx.lineWidth=1;cx.beginPath();cx.moveTo(0,swBot);cx.lineTo(W,swBot);cx.stroke();
        cx.strokeStyle=rgba(C.purple,0.02);for(let gx=-cm%60;gx<W;gx+=60){cx.beginPath();cx.moveTo(gx,swTop+4);cx.lineTo(gx,swBot-2);cx.stroke();}
        // 하수도 쓰레기통
        for(const t of this.cans){if(!t.isSewer)continue;const tx=t.x-cm;if(tx<-25||tx>W+25)continue;if(t.looted){cx.fillStyle=rgba('#333',0.1);cx.fillRect(tx-6,this.sewerFloor-12,12,12);}else{const near=this.inSewer&&Math.abs(this.px-t.x)<22;cx.fillStyle=rgba(C.purple,near?0.2:0.08);cx.fillRect(tx-7,this.sewerFloor-14,14,14);cx.strokeStyle=rgba(C.purple,near?0.55:0.25);cx.lineWidth=1.5;cx.strokeRect(tx-7,this.sewerFloor-14,14,14);cx.font='7px "JetBrains Mono"';cx.fillStyle=rgba(C.purple,0.6);cx.textAlign='center';cx.fillText(`◆${t.core}`,tx,this.sewerFloor-17);if(near&&!this.lootTgt&&this.core<this.maxC){cx.font='9px "JetBrains Mono"';cx.fillStyle=rgba(C.purple,0.6+Math.sin(now*4)*0.2);cx.fillText(this.mob?'TAP':'[E]',tx,this.sewerFloor-28);}}}
        // 쥐덫
        for(const tr of this.traps){const tx=tr.x-cm;if(tx<-20||tx>W+20)continue;cx.font=tr.triggered?'10px serif':'12px serif';cx.fillStyle=tr.triggered?rgba(C.red,0.2):rgba(C.red,0.45+Math.sin(now*3+tr.x)*0.15);cx.textAlign='center';cx.fillText(tr.triggered?'×':'▲',tx,this.sewerFloor-2);}
        // 플랫폼
        for(const p of this.plats){const px=p.x-cm;if(px+p.w<-10||px>W+10)continue;cx.fillStyle=rgba(C.accent,0.035);cx.fillRect(px,p.y,p.w,p.h);cx.strokeStyle=rgba(C.accent,0.1);cx.lineWidth=1;cx.strokeRect(px,p.y,p.w,p.h);cx.fillStyle=rgba(C.accent,0.08);cx.fillRect(px,p.y,p.w,2.5);for(let wy=10;wy<p.h-8;wy+=14)for(let wx=6;wx<p.w-6;wx+=12){cx.fillStyle=rgba(C.blue,0.025);cx.fillRect(px+wx,p.y+wy,5,6);}}
        // 파이프
        for(const p of this.pipes){let sx=p.x-cm;if(sx>-20&&sx<W+20){cx.fillStyle=rgba(C.purple,this.aD.sewer?0.18:0.06);cx.beginPath();cx.arc(sx,this.gndY,11,Math.PI,0);cx.fill();if(this.aD.sewer){cx.font='8px "JetBrains Mono"';cx.fillStyle=rgba(C.purple,0.5);cx.textAlign='center';cx.fillText('▼',sx,this.gndY-2);}if(this.inSewer&&Math.abs(this.px-p.x)<28){cx.font='9px "JetBrains Mono"';cx.fillStyle=rgba(C.purple,0.6+Math.sin(now*4)*0.2);cx.textAlign='center';cx.fillText('[E] ▲',sx,this.sewerFloor-22);}}sx=p.ex-cm;if(sx>-20&&sx<W+20){cx.fillStyle=rgba(C.purple,0.08);cx.beginPath();cx.arc(sx,this.gndY,8,Math.PI,0);cx.fill();if(this.inSewer&&Math.abs(this.px-p.ex)<28){cx.font='9px "JetBrains Mono"';cx.fillStyle=rgba(C.purple,0.6+Math.sin(now*4)*0.2);cx.textAlign='center';cx.fillText('[E] ▲',sx,this.sewerFloor-22);}}}
        // 지상 쓰레기통
        for(const t of this.cans){if(t.isSewer)continue;const tx=t.x-cm;if(tx<-25||tx>W+25)continue;const canL=t.tier<=this.aD.maxTier;if(t.looted){cx.fillStyle=rgba('#444',0.1);cx.fillRect(tx-7,t.y-14,14,14);}else{const near=!this.inSewer&&Math.abs(this.px-t.x)<22&&Math.abs(this.py-t.y)<28;const tc=t.tier===3?C.pink:t.tier===2?C.yellow:C.accent;cx.fillStyle=rgba(tc,near?0.18:0.07);cx.fillRect(tx-8,t.y-16,16,16);cx.strokeStyle=rgba(tc,near?0.55:(canL?0.22:0.08));cx.lineWidth=canL?1.5:0.5;cx.strokeRect(tx-8,t.y-16,16,16);cx.fillStyle=rgba(tc,0.25);cx.fillRect(tx-10,t.y-18,20,3);cx.font='7px "JetBrains Mono"';cx.fillStyle=rgba(tc,canL?0.55:0.2);cx.textAlign='center';cx.fillText(`${'★'.repeat(t.tier)} ◆${t.core}`,tx,t.y-22);if(!canL&&near){cx.fillStyle=rgba(C.red,0.5);cx.font='8px "JetBrains Mono"';cx.fillText('✕ 접근 불가',tx,t.y-34);}else if(near&&!this.lootTgt&&this.core<this.maxC&&canL){cx.font='10px "JetBrains Mono"';cx.fillStyle=rgba(C.accent,0.55+Math.sin(now*4)*0.2);cx.fillText(this.mob?'TAP':'[E]',tx,t.y-34);}}}
        // 탈출
        {const ez=this.exZ,ex=ez.x-cm;cx.fillStyle=rgba(C.accent,0.04+Math.sin(now*2)*0.02);cx.fillRect(ex,this.gndY-75,ez.w,75);cx.strokeStyle=rgba(C.accent,0.25);cx.lineWidth=1;cx.setLineDash([4,4]);cx.strokeRect(ex,this.gndY-75,ez.w,75);cx.setLineDash([]);cx.fillStyle=rgba(C.accent,0.02+Math.sin(now*3)*0.01);cx.fillRect(ex+18,0,ez.w-36,this.gndY-75);for(let i=0;i<4;i++){const py2=(now*40+i*60)%(this.gndY-75);cx.fillStyle=rgba(C.accent,0.12);cx.fillRect(ex+25+Math.sin(now+i)*20,py2,2,2);}cx.font='9px "JetBrains Mono"';cx.fillStyle=rgba(C.accent,0.45);cx.textAlign='center';cx.fillText(`▲ EXTRACT (${this.aD.extractTime}s)`,ex+ez.w/2,this.gndY-80);}
        // 인간
        if(!this.inSewer)for(const h of this.humans){const hx=h.x-cm;if(hx<-40||hx>W+40)continue;const isG=h.type==='guard',isPet=h.st==='pet',ch=h.st==='chase'||h.st==='attack';const col=isG?C.red:isPet?C.yellow:C.pink;if(ch){cx.beginPath();cx.ellipse(hx,h.y+4,h.det*this.aD.detectMul,14,0,0,Math.PI*2);cx.fillStyle=rgba(C.red,0.02);cx.fill();}cx.fillStyle=rgba(col,ch?0.22:isPet?0.15:0.1);cx.fillRect(hx-7,h.y-22,14,22);cx.strokeStyle=rgba(col,ch?0.65:0.3);cx.lineWidth=1.5;cx.strokeRect(hx-7,h.y-22,14,22);cx.fillStyle=rgba(col,0.12);cx.fillRect(hx-5,h.y-30,10,9);if(h.st==='alert'){cx.font='11px "JetBrains Mono"';cx.fillStyle=rgba(C.yellow,0.45+Math.sin(now*6)*0.3);cx.textAlign='center';cx.fillText('?',hx,h.y-36);}if(ch){cx.font='11px "JetBrains Mono"';cx.fillStyle=rgba(C.red,0.65);cx.textAlign='center';cx.fillText('!',hx,h.y-36);}if(isPet){cx.font='11px "JetBrains Mono"';cx.fillStyle=rgba(C.yellow,0.6);cx.textAlign='center';cx.fillText('♥',hx,h.y-36);}cx.font='7px "JetBrains Mono"';cx.fillStyle=rgba(col,0.25);cx.textAlign='center';cx.fillText(isG?'방역':'시민',hx,h.y+10);}
        // 플레이어
        const blink=this.iF>0&&Math.sin(now*25)>0;
        if(!blink&&this.phase==='play'){const ppx=this.px-cm,ppy=this.py,col=this.aD.color;cx.beginPath();cx.ellipse(ppx,this.onGnd?ppy+2:ppy+14,9,3,0,0,Math.PI*2);cx.fillStyle=rgba(col,0.06);cx.fill();if(this.petFlash>0){cx.beginPath();cx.arc(ppx,ppy-5,18,0,Math.PI*2);cx.strokeStyle=rgba(C.yellow,0.3+Math.sin(now*8)*0.15);cx.lineWidth=2;cx.stroke();cx.font='10px serif';cx.fillStyle=rgba(C.yellow,0.6);cx.textAlign='center';cx.fillText('🤚',ppx+12,ppy-18);}cx.save();cx.translate(ppx,ppy);cx.scale(this.pDir,1);if(this.selA==='pigeon'){cx.fillStyle=rgba(col,0.18);cx.beginPath();cx.ellipse(0,-8,9,7,0,0,Math.PI*2);cx.fill();cx.strokeStyle=rgba(col,0.55);cx.lineWidth=1.5;cx.stroke();cx.fillStyle=rgba(col,0.45);cx.fillRect(7,-9,4,2.5);cx.fillStyle=rgba('#fff',0.5);cx.fillRect(3,-10,2.5,2.5);if(this.gliding){cx.strokeStyle=rgba(col,0.35);cx.lineWidth=1.5;cx.beginPath();cx.moveTo(-4,-7);cx.lineTo(-16,-14+Math.sin(now*6)*2);cx.stroke();cx.beginPath();cx.moveTo(-4,-7);cx.lineTo(-16,-2+Math.sin(now*6+1)*2);cx.stroke();}}else if(this.selA==='cat'){cx.fillStyle=rgba(col,0.18);cx.fillRect(-7,-15,14,13);cx.strokeStyle=rgba(col,0.55);cx.lineWidth=1.5;cx.strokeRect(-7,-15,14,13);cx.beginPath();cx.moveTo(-5,-15);cx.lineTo(-3,-21);cx.lineTo(-1,-15);cx.fillStyle=rgba(col,0.25);cx.fill();cx.beginPath();cx.moveTo(1,-15);cx.lineTo(3,-21);cx.lineTo(5,-15);cx.fill();cx.fillStyle=rgba(col,0.7);cx.fillRect(1,-12,2,2.5);cx.fillRect(-3,-12,2,2.5);cx.strokeStyle=rgba(col,0.35);cx.lineWidth=2;cx.beginPath();cx.moveTo(-7,-7);cx.quadraticCurveTo(-16,-7+Math.sin(now*3)*5,-13,-14);cx.stroke();}else{cx.fillStyle=rgba(col,0.18);cx.beginPath();cx.ellipse(0,-5,7,4.5,0,0,Math.PI*2);cx.fill();cx.strokeStyle=rgba(col,0.55);cx.lineWidth=1.5;cx.stroke();cx.beginPath();cx.arc(-3,-10,2.5,0,Math.PI*2);cx.fillStyle=rgba(col,0.25);cx.fill();cx.beginPath();cx.arc(3,-10,2.5,0,Math.PI*2);cx.fill();cx.fillStyle=rgba(col,0.6);cx.fillRect(2,-7,1.5,1.5);cx.strokeStyle=rgba(col,0.25);cx.lineWidth=1.5;cx.beginPath();cx.moveTo(-7,-3);cx.quadraticCurveTo(-16,-3+Math.sin(now*4)*3,-20,-6);cx.stroke();}cx.restore();}
        // 시전바
        if(this.lootTgt){const lx=this.px-cm,ly=this.py-42,p=this.lootP/LOOT_DUR;cx.fillStyle=rgba(C.bg,0.65);cx.fillRect(lx-18,ly,36,5);cx.fillStyle=rgba(C.yellow,0.55);cx.fillRect(lx-18,ly,36*p,5);cx.strokeStyle=rgba(C.yellow,0.25);cx.lineWidth=1;cx.strokeRect(lx-18,ly,36,5);}
        if(this.extracting){const ex2=this.px-cm,ey=this.py-52,p=this.exP/this.aD.extractTime;cx.fillStyle=rgba(C.bg,0.65);cx.fillRect(ex2-28,ey,56,7);cx.fillStyle=rgba(C.accent,0.65);cx.fillRect(ex2-28,ey,56*p,7);cx.strokeStyle=rgba(C.accent,0.35);cx.lineWidth=1;cx.strokeRect(ex2-28,ey,56,7);cx.font='9px "JetBrains Mono"';cx.fillStyle=C.accent;cx.textAlign='center';cx.fillText(`${(this.aD.extractTime-this.exP).toFixed(1)}s`,ex2,ey-5);}
        if(this.alertFl>0){const a=this.alertFl*0.08;cx.fillStyle=rgba(C.red,a);cx.fillRect(0,0,3,H);cx.fillRect(W-3,0,3,H);cx.fillRect(0,0,W,3);cx.fillRect(0,H-3,W,3);}
        this.renderPts();this.renderPops();cx.restore();
        // HUD
        this.drawHudTitle();cx.font='500 10px "JetBrains Mono"';cx.fillStyle=this.aD?.color||'#fff';cx.textAlign='left';cx.fillText(`${this.aD?.sym} ${this.aD?.name}`,20,46);
        const hpP=this.hp/(this.aD?.hp||100),hpC=hpP>0.5?C.accent:hpP>0.25?C.yellow:C.red;cx.fillStyle=rgba(hpC,0.12);cx.fillRect(20,52,55,4);cx.fillStyle=rgba(hpC,0.55);cx.fillRect(20,52,55*hpP,4);
        cx.font='500 10px "JetBrains Mono"';cx.fillStyle=C.yellow;cx.fillText(`◆ ${this.core}/${this.maxC}`,20,70);cx.fillStyle='#7a7a8a';cx.fillText(`SCORE ${this.score}`,20,84);
        cx.font='400 8px "JetBrains Mono"';cx.fillStyle=rgba(this.aD.color,0.3);cx.fillText(`코어 ×${this.aD.coreMul} · 점수 ×${this.aD.scoreMul}`,20,96);
        const tFl=this.stTime<10&&Math.sin(now*8)>0;cx.font='600 15px "JetBrains Mono"';cx.fillStyle=tFl?rgba(C.red,0.85):rgba(this.stTime>20?C.accent:C.yellow,0.65);cx.textAlign='center';cx.fillText(`${Math.ceil(this.stTime)}s`,W/2,28);
        cx.font='400 9px "JetBrains Mono"';cx.fillStyle='#3a3a44';cx.textAlign='right';cx.fillText(`STAGE ${this.stage+1}/${STAGES.length}`,W-20,28);
        if(this.inSewer){cx.font='500 9px "JetBrains Mono"';cx.fillStyle=rgba(C.purple,0.6);cx.textAlign='center';cx.fillText('🕳️ 하수도 · Space=점프 · 파이프에서 E=탈출',W/2,H-14);}
        else if(this.petFlash>0){cx.font='500 9px "JetBrains Mono"';cx.fillStyle=rgba(C.yellow,0.7);cx.textAlign='center';cx.fillText(`포획 중... ${this.petFlash.toFixed(1)}s`,W/2,H-14);}
        else{cx.font='400 8px "JetBrains Mono"';cx.fillStyle=rgba(this.aD?.color||'#fff',0.2);cx.textAlign='right';cx.fillText(this.aD?.desc||'',W-20,H-14);}
        if(this.stTime>STAGES[this.stage]?.time-5){cx.font='400 8px "JetBrains Mono"';cx.fillStyle=rgba('#fff',0.12);cx.textAlign='center';cx.fillText(this.mob?'좌 TAP=상호작용 · 우 TAP=점프 · 드래그=이동':'A/D 이동 · Space 점프 · E 상호작용',W/2,42);}
        this.drawCloseBtn();
        if(this.phase==='intro'){const st=STAGES[this.stage];this.drawIntro(this.phT,`STAGE ${this.stage+1}`,`${st.cans} 쓰레기통 · ${st.time}초 · 코어 ×${this.aD.coreMul}`,`${this.aD.sym} ${this.aD.name} — ${this.aD.desc}`);}
        if(this.phase==='clear'){const fade=Math.min(1,(1.5-this.phT)/0.5);cx.fillStyle=rgba(C.bg,0.45*fade);cx.fillRect(0,0,W,H);cx.textAlign='center';cx.globalAlpha=fade;cx.font='700 22px "JetBrains Mono"';cx.fillStyle=C.accent;cx.fillText('EXTRACTED!',W/2,H/2-10);cx.font='400 11px "JetBrains Mono"';cx.fillStyle=C.yellow;cx.fillText(`◆ ${this.core} 코어 원소 회수`,W/2,H/2+14);cx.globalAlpha=1;}
        if(this.phase==='result'||this.phase==='dead')this.renderRes();
    }

    private renderSel(now: number): void {
        const{cx,W,H}=this;this.drawBg();this.drawGrid(0.018);cx.textAlign='center';
        cx.font='600 10px "JetBrains Mono"';cx.fillStyle=C.yellow;cx.fillText('◆ HAUL',W/2,H*0.14);
        cx.font='700 20px "JetBrains Mono"';cx.fillStyle='#e8e8ec';cx.fillText('동물 선택',W/2,H*0.22);
        cx.font='400 10px "JetBrains Mono"';cx.fillStyle='#4a4a55';cx.fillText('"같은 존재인데, 껍데기가 다르다는 이유로"',W/2,H*0.28);
        const keys=['pigeon','cat','rat'],cW=Math.min(165,(W-60)/3),gp=12,tW=cW*3+gp*2,sx=(W-tW)/2;
        keys.forEach((k,i)=>{const d=ANIM[k],cx2=sx+i*(cW+gp),cy=H*0.33,ch=H*0.52,hov=this.hovA===k;
            cx.beginPath();cx.roundRect(cx2,cy,cW,ch,7);cx.fillStyle=hov?rgba(d.color,0.07):rgba(d.color,0.02);cx.fill();cx.strokeStyle=hov?rgba(d.color,0.45):rgba(d.color,0.1);cx.lineWidth=hov?2:1;cx.stroke();
            const iy=cy+ch*0.12;cx.font='28px serif';cx.fillStyle=d.color;cx.textAlign='center';cx.fillText(d.sym,cx2+cW/2,iy);
            cx.font='600 12px "JetBrains Mono"';cx.fillStyle=d.color;cx.fillText(d.name,cx2+cW/2,iy+24);
            cx.font='400 8px "JetBrains Mono"';cx.fillStyle=rgba(d.color,0.45);cx.fillText(d.desc,cx2+cW/2,iy+38);
            const sty=iy+52;cx.font='400 8px "JetBrains Mono"';cx.fillStyle='#5a5a66';cx.textAlign='left';const stx=cx2+8;
            cx.fillText(`HP ${d.hp}  슬롯 ${d.slots}`,stx,sty);cx.fillText(d.ability,stx,sty+12);
            cx.fillText(`코어 ×${d.coreMul}  점수 ×${d.scoreMul}`,stx,sty+24);cx.fillText(`탈출 ${d.extractTime}초`,stx,sty+36);cx.fillText(`루팅 ★${d.maxTier}까지`,stx,sty+48);
            const by=sty+60;cx.fillStyle='#2a2a30';cx.fillRect(stx,by,cW-16,3);const dw=(cW-16)*Math.min(1,d.detectMul/2);cx.fillStyle=d.detectMul>1.5?C.red:d.detectMul>0.8?C.yellow:C.accent;cx.fillRect(stx,by,dw,3);cx.font='400 7px "JetBrains Mono"';cx.fillStyle='#3a3a44';cx.fillText('위험도',stx,by+11);});
        cx.font='400 9px "JetBrains Mono"';cx.fillStyle='#3a3a44';cx.textAlign='center';cx.fillText(this.mob?'동물을 탭하세요':'동물을 클릭하세요',W/2,H*0.9);this.drawCloseBtn();
    }

    private renderRes(): void {
        const isW=this.phase==='result',t=isW?'MISSION COMPLETE':this.hp<=0?'DETECTED':'TIME UP';
        const{bx,by}=this.drawResultBg(t,isW?C.accent:C.red);const{cx}=this;
        cx.font='700 32px "JetBrains Mono"';cx.fillStyle='#e8e8ec';cx.fillText(`${this.score}`,bx,by-22);
        cx.font='400 10px "JetBrains Mono"';cx.fillStyle='#5a5a66';cx.fillText('POINTS',bx,by-4);cx.fillStyle=C.yellow;cx.fillText(`◆ ${this.totCore} 코어 원소 총 회수`,bx,by+14);
        this.stRes.forEach((r,i)=>{const a=ANIM[r.animal];cx.fillStyle='#5a5a66';cx.fillText(`Stage ${i+1}: ${a?.sym} ◆${r.core} · ${r.time.toFixed(1)}s`,bx,by+34+i*15);});
        const bOff=34+this.stRes.length*15+16;cx.fillStyle=rgba(this.aD?.color||'#fff',0.3);cx.fillText(`${this.aD?.sym} ${this.aD?.name} · 코어 ×${this.aD?.coreMul} · 점수 ×${this.aD?.scoreMul}`,bx,by+bOff-6);
        this.drawResultBtns(bx,by+bOff+10);
    }
    private get rBY():number{return this.H/2+34+this.stRes.length*15+26;}

    protected onClickAt(x:number,y:number):void{
        if(this.phase==='select'){this.selClick(x,y);return;}
        if(this.phase==='result'||this.phase==='dead'){const h=this.hitResultBtn(x,y,this.W/2,this.rBY);if(h==='retry')this.resetGame();if(h==='exit')this.stop();return;}
        if(this.phase==='play'&&this.mob){if(x>this.W*0.7)this.tJump=true;else if(x<this.W*0.3)this.doInteract();}
    }
    private selClick(x:number,y:number):void{const keys=['pigeon','cat','rat'],cW=Math.min(165,(this.W-60)/3),gp=12,tW=cW*3+gp*2,sx=(this.W-tW)/2,cy=this.H*0.33,ch=this.H*0.52;for(let i=0;i<3;i++){const cx2=sx+i*(cW+gp);if(x>=cx2&&x<=cx2+cW&&y>=cy&&y<=cy+ch){this.selA=keys[i];this.startStage();return;}}}
    protected onMouseMoveAt(x:number,y:number):void{if(this.phase!=='select')return;const keys=['pigeon','cat','rat'],cW=Math.min(165,(this.W-60)/3),gp=12,tW=cW*3+gp*2,sx=(this.W-tW)/2,cy=this.H*0.33,ch=this.H*0.52;this.hovA=null;for(let i=0;i<3;i++){const cx2=sx+i*(cW+gp);if(x>=cx2&&x<=cx2+cW&&y>=cy&&y<=cy+ch){this.hovA=keys[i];break;}}}
    protected onTouchMoveAt(x:number):void{if(this.phase!=='play')return;const dx=x-(this.px-this.camX);this.tDir={x:dx>30?1:dx<-30?-1:0,y:0};}
    protected onTouchEndAt():void{this.tDir={x:0,y:0};this.tJump=false;}
}

export function createHaulGame(container: HTMLElement, onExit: () => void) {
    const game = new HaulGame(container, onExit);
    return { start: () => game.start(), stop: () => game.stop() };
}