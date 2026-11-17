/* BeeboScore (developed by Beebo) — BeeboFX 3 (Testbuild 1.12.10): materials, letters and backdrops drawn on the graphics card.
 *
 *   BeeboFX3.material(host, o)   a living surface on a piece (brushed metal, chrome, holographic foil, liquid gold, carbon,
 *                                marble, obsidian, lava, frost, circuit, nebula, dragon scales): a canvas filling `host`,
 *                                clipped to o.clip (a CSS clip-path) — under the piece's lettering
 *   BeeboFX3.text(textEl, o)     a lettering effect worked out from the letters themselves (chrome, neon tubes, electric
 *                                arcs, flames, frost, gold leaf, hologram, glitch, liquid, shadow flame, a heavenly aura) —
 *                                a canvas over the letters, bigger than them so the light can spill out
 *   BeeboFX3.mask(textEl, o)     a letter fill: a picture, a video or a material shows only inside the letters
 *   BeeboFX3.backdrop(host, o)   a full-screen backdrop for a screen (nebula, aurora, god rays, smoke, plasma, warp, synth
 *                                grid, liquid metal, lava, ink, storm, hex field, caustics, the void)
 *   BeeboFX3.fluid(host, o)      a real fluid simulation (smoke, ink, fire) — it swirls on its own and bursts on a moment
 *   BeeboFX3.post(scene, o)      the film look: grade, grain, vignette, scanlines, colour fringe, letterbox, light leak, flicker
 *   BeeboFX3.MATERIALS / LETTERS / BACKDROPS / GRADES / COMPOSER   the catalogues (for the Layout Designer)
 *   every handle: .set(o) (new colours / speed / amount), .destroy(); fluids also .burst(x, y)
 *
 * One WebGL 2 context draws everything (OBS pays for one context). Since 1.12.12 it lives on an OffscreenCanvas and hands each
 * finished frame to the piece's canvas as an ImageBitmap (no copy back from the graphics card); without OffscreenCanvas it
 * copies, as before. When none of its pieces are on screen it sleeps — no frame loop at all — and wakes when one shows.
 * It draws only what's on screen, at 30 frames a second (24 and 60 % size on Light), and stands aside — leaving the layout's
 * plain look — with the effects engine off, on Ultra-light, in potato mode, or without WebGL 2.
 */
(() => {
  'use strict';
  if (window.BeeboFX3) return;
  const H = document.documentElement;
  // the watchdog (1.12.11): on stream with Effects quality on Auto, slow frames step BeeboFX 3 down — 1: drawn smaller, 2: the plain look
  const WD = { level: 0, cost: [], gaps: [], prev: 0, evalAt: 0, goodSince: 0, changedAt: 0, why: '', reportAt: 0 };
  const off = () => WD.level >= 2 || H.classList.contains('sb-potato') || H.classList.contains('sb-ultra') || H.classList.contains('sb-calm') || !!window.__SB_POTATO || ['off', 'ultra'].includes(String(window.__SB_GFXQ || '')) || (window.BeeboFX && window.BeeboFX.stats && (window.BeeboFX.stats() || {}).want === 'off');
  const light = () => WD.level >= 1 || H.classList.contains('sb-light') || String(window.__SB_GFXQ || '') === 'light' || !!(window.SBPerf && (window.SBPerf.laptop || window.SBPerf.lighter));
  const hex = c => { c = String(c || '#ffffff').trim(); if (c[0] === '@' && window.__SB_THEME) c = window.__SB_THEME(c); if (c[0] !== '#') return [1, 1, 1]; if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]; const n = parseInt(c.slice(1, 7), 16); return isNaN(n) ? [1, 1, 1] : [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

  // ===================================================================================== shaders
  const HEAD = `#version 300 es
precision highp float;
uniform vec2 R; uniform float T, A, S, SEED, K; uniform vec3 C1, C2, C3; uniform sampler2D M; uniform vec4 MB; uniform int HM;
in vec2 uv; out vec4 o;
float h1(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32+SEED);return fract(p.x*p.y);}
vec2 h2(vec2 p){float n=h1(p);return vec2(n,h1(p+n*19.19));}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h1(i),h1(i+vec2(1,0)),f.x),mix(h1(i+vec2(0,1)),h1(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 r=mat2(.8,.6,-.6,.8);for(int i=0;i<5;i++){v+=a*vn(p);p=r*p*2.02;a*=.5;}return v;}
vec3 vor(vec2 p){vec2 i=floor(p),f=fract(p);float d1=8.,d2=8.;vec2 id=vec2(0);for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(x,y),q=h2(i+g);float d=length(g+q-f);if(d<d1){d2=d1;d1=d;id=i+g;}else if(d<d2)d2=d;}return vec3(d1,d2,h1(id));}
vec3 hue(float h){return clamp(abs(mod(h*6.+vec3(0,4,2),6.)-3.)-1.,0.,1.);}
float mk(vec2 p){if(HM==0)return 0.;vec2 q=(p-MB.xy)/MB.zw;if(q.x<0.||q.y<0.||q.x>1.||q.y>1.)return 0.;return texture(M,vec2(q.x,1.-q.y)).a;}
float ring(vec2 p,float r){float s=0.;for(int i=0;i<12;i++){float a=float(i)*.5236;s+=mk(p+vec2(cos(a),sin(a))*r);}return s/12.;}
`;
  const VS = `#version 300 es
in vec2 p; out vec2 uv; void main(){uv=p*.5+.5;gl_Position=vec4(p,0,1);}`;
  const px = 'vec2 P=uv*R;';          // pixel position (y up)
  // ---- materials: o = premultiplied colour of the surface (always opaque inside the piece)
  const MATERIALS = {
    brushed: { label: 'Brushed metal', emoji: '🪙', cat: 'Metal', c: ['#c9ccd3', '#ffffff', '#5b6070'], tip: 'Fine brushed lines with a sheen that slides across.',
      f: px + `float l=vn(vec2(P.x*.004,P.y*.9))*.6+vn(vec2(P.x*.02,P.y*2.3))*.4; float band=exp(-pow((uv.x-fract(T*S*.08)*1.6+.3-uv.y*.35)*3.,2.)); vec3 c=mix(C3,C1,.35+.5*l)+C2*band*.55*A; o=vec4(c,1);` },
    chrome: { label: 'Chrome', emoji: '🪞', cat: 'Metal', c: ['#e9edf5', '#ffffff', '#20232c'], tip: 'Mirror chrome: a sky above, the ground below, bent by the surface.',
      f: px + `float n=fbm(P*.004+vec2(T*S*.05,0))*.25; float y=uv.y+n-.05*sin(uv.x*6.+T*S*.4); vec3 sky=mix(C1,C2,smoothstep(.5,1.,y)); vec3 gr=mix(C3,C1*.55,smoothstep(.0,.48,y)); vec3 c=y>.5?sky:gr; c+=smoothstep(.49,.5,y)*smoothstep(.53,.5,y)*C2*1.4; c+=pow(max(0.,1.-abs(uv.x-fract(T*S*.07)*1.4+.2)*5.),6.)*.6*A; o=vec4(c,1);` },
    holo: { label: 'Holographic foil', emoji: '🌈', cat: 'Foil', c: ['#c7f0ff', '#ffd1f7', '#d8ffd6'], tip: 'A rainbow that shifts as it catches the light, with glitter.',
      f: px + `float a=uv.x*1.3+uv.y*.7+fbm(P*.006)*.8+T*S*.06; vec3 c=mix(hue(fract(a)),hue(fract(a+.33)),.5)*.55+mix(C1,C2,uv.x)*.5; float gl=step(.985,h1(floor(P/3.)+floor(T*S*6.)))*A; c+=gl; o=vec4(c,1);` },
    liquidgold: { label: 'Liquid gold', emoji: '🫗', cat: 'Metal', c: ['#ffcf4a', '#fff4c4', '#7a4a06'], tip: 'Molten gold that flows and ripples, catching the light.',
      f: px + `vec2 q=P*.005; float n=fbm(q+vec2(T*S*.12,T*S*.05)); float n2=fbm(q*1.7+n*2.-T*S*.07); float sh=pow(clamp(n2*1.4-.2,0.,1.),3.); vec3 c=mix(C3,C1,smoothstep(.2,.8,n))+C2*sh*1.2*A; o=vec4(c,1);` },
    carbon: { label: 'Carbon fibre', emoji: '⬛', cat: 'Weave', c: ['#2b2e36', '#8f96a8', '#0c0d10'], tip: 'Woven carbon under a glossy clear coat.',
      f: px + `vec2 g=P/9.; vec2 c0=floor(g); vec2 f=fract(g); float w=mod(c0.x+c0.y,2.)<1.?f.x:f.y; float t=.5+.5*sin(w*3.1416); vec3 c=mix(C3,C1,t); float cl=pow(max(0.,1.-abs(uv.y-uv.x*.3-fract(T*S*.05)*1.5+.4)*4.),3.); c+=C2*cl*.35*A; o=vec4(c,1);` },
    marble: { label: 'Marble & gold', emoji: '🏛️', cat: 'Stone', c: ['#f4f1ea', '#d4af37', '#b9b3a6'], tip: 'White marble, its veins filled with gold (kintsugi).',
      f: px + `vec2 q=P*.004; float n=fbm(q*2.+fbm(q*3.)*1.5); float v=abs(sin(q.x*3.+n*6.)); vec3 c=mix(C3,C1,smoothstep(.0,.6,v)); float gv=smoothstep(.06,.0,v); float gl=.6+.4*sin(T*S*1.5+q.x*8.); c=mix(c,C2*(.8+.6*gl),gv*A); o=vec4(c,1);` },
    obsidian: { label: 'Obsidian glass', emoji: '⚫', cat: 'Glass', c: ['#0b0a08', '#e0a93b', '#6e4a0e'], tip: 'Black volcanic glass: deep, with light moving under the surface.',
      f: px + `vec2 q=P*.003; float c1=fbm(q*3.+vec2(T*S*.05,0)); float ca=pow(abs(sin((fbm(q*6.-T*S*.03)+c1)*9.)),18.); vec3 c=C1+C3*c1*.35+C2*ca*.45*A; float sh=pow(max(0.,1.-abs(uv.y-.75+.2*uv.x)*6.),2.); c+=vec3(.18)*sh; o=vec4(c,1);` },
    lava: { label: 'Lava rock', emoji: '🌋', cat: 'Stone', c: ['#1a0d06', '#ff5a1f', '#ffd27a'], tip: 'Cooling rock with molten cracks that glow and move.',
      f: px + `vec3 v=vor(P*.012+vec2(0,T*S*.05)); float cr=smoothstep(.09,.0,v.y-v.x); float heat=.6+.4*sin(T*S*1.3+v.z*6.28); float mf=fbm(P*.01-T*S*.1); vec3 c=C1*(.7+mf*.6)+mix(C2,C3,cr*heat)*cr*(1.2*A)*heat; o=vec4(c,1);` },
    frost: { label: 'Frosted ice', emoji: '❄️', cat: 'Glass', c: ['#cfe9ff', '#ffffff', '#3d6fa0'], tip: 'Frozen glass with crystals catching a cold light.',
      f: px + `vec3 v=vor(P*.03); float e=smoothstep(.05,.0,v.y-v.x); float n=fbm(P*.01+T*S*.02); vec3 c=mix(C3,C1,.45+.45*n)+C2*e*.45*A; c+=step(.993,h1(floor(P/2.)+floor(T*S*3.)))*.8; o=vec4(c,1);` },
    circuit: { label: 'Circuit', emoji: '🔌', cat: 'Tech', c: ['#0b1220', '#39d5ff', '#ff3bd5'], tip: 'Traces of light run along a dark circuit board.',
      f: px + `vec2 g=P/18.; vec2 id=floor(g),f=fract(g); float r=h1(id); float ln=r<.5?smoothstep(.08,.0,abs(f.y-.5)):smoothstep(.08,.0,abs(f.x-.5)); float pulse=fract(T*S*.4+r*3.+(r<.5?f.x:f.y)*.5); float on=smoothstep(.0,.05,pulse)*smoothstep(.25,.05,pulse); vec3 c=C1+ln*mix(C2,C3,r)*(.15+on*1.2*A); o=vec4(c,1);` },
    nebula: { label: 'Nebula', emoji: '🌌', cat: 'Space', c: ['#0a0718', '#7b5cff', '#ff4fb0'], tip: 'Clouds of a distant galaxy drift past, with stars.',
      f: px + `vec2 q=P*.003+vec2(T*S*.01,0); float n=fbm(q*2.+fbm(q*3.+T*S*.02)); vec3 c=C1+C2*smoothstep(.35,.9,n)*.9+C3*smoothstep(.55,1.,fbm(q*4.-1.3))*.7; float st=step(.996,h1(floor(P/1.5)))*(.6+.4*sin(T*3.+h1(floor(P))*30.)); c+=st*A; o=vec4(c,1);` },
    scales: { label: 'Dragon scales', emoji: '🛡️', cat: 'Weave', c: ['#0f2b1f', '#36e08a', '#b8ffd8'], tip: 'Overlapping metal scales with a sheen that ripples over them.',
      f: px + `vec2 g=P/vec2(22.,16.); g.x+=mod(floor(g.y),2.)*.5; vec2 f=fract(g)-vec2(.5,.0); float d=length(f*vec2(1.,1.3)); float sc=smoothstep(.62,.5,d); float rim=smoothstep(.5,.62,d)*smoothstep(.75,.62,d); float sh=.5+.5*sin(T*S*1.4-g.y*.8+g.x*.4); vec3 c=mix(C1,C2,(1.-d)*.8*sh)+C3*rim*.5*A; o=vec4(c*mix(.55,1.,sc),1);` },
  };
  // ---- lettering effects: M = the letters (alpha), MB = where they sit; o = premultiplied (light spills outside the letters)
  const LETTERS = {
    chrome: { label: 'Chrome', emoji: '🪞', c: ['#ffffff', '#9fb4d8', '#1a1d26'], tip: 'Mirror-chrome letters with a bevelled edge and a glint that runs across.',
      f: px + `float m=mk(P); if(m<.01){o=vec4(0);return;} float e=m-ring(P,2.5); float y=(P.y-MB.y)/MB.w+e*.6; vec3 c=y>.52?mix(C2,C1,smoothstep(.52,1.,y)):mix(C3,C2*.6,smoothstep(.0,.5,y)); c+=smoothstep(.5,.53,y)*smoothstep(.56,.53,y)*1.2; c+=pow(max(0.,1.-abs((P.x-MB.x)/MB.z-fract(T*S*.18)*1.6+.3)*6.),4.)*A; o=vec4(c*m,m);` },
    neon: { label: 'Neon tubes', emoji: '💡', c: ['#ff3bd5', '#ffe6fb', '#7a00ff'], tip: 'Glowing glass tubes along each letter, with a flicker.',
      f: px + `float m=mk(P),L=MB.w; float ri=ring(P,L*.045),r2=ring(P,L*.1),r3=ring(P,L*.22); float tube=m*(1.-smoothstep(.62,.97,ri)); float fl=.86+.14*step(.08,fract(sin(floor(T*S*12.+SEED)*91.7)*43758.5)); float glow=(1.-m)*(r2*.85+r3*.65)*A*fl; vec3 c=C1*m*.3+mix(C1,C2,.8)*tube*1.25*fl+C1*glow*1.3+C3*glow*.25; float a=clamp(m*.55+tube*.6+glow,0.,1.); o=vec4(c,a);` },
    electric: { label: 'Electric', emoji: '⚡', c: ['#7ad8ff', '#ffffff', '#2a5cff'], tip: 'Arcs of electricity crawl over the letters and jump off them.',
      f: px + `float m=mk(P),L=MB.w; float near=ring(P,L*.09)*(1.-m); float n=fbm(P*(3./L)+vec2(T*S*2.,-T*S*1.3)); float n2=fbm(P*(5./L)-vec2(T*S*3.)); float ao=smoothstep(.035,.0,abs(n-.5))*near*2.2; float ai=smoothstep(.025,.0,abs(n2-.5))*m*.9; float fl=.7+.3*step(.25,fract(sin(floor(T*S*9.)*12.9)*437.5)); vec3 c=mix(C3,C1,.35+.25*n)*m+C2*(ao+ai)*fl+C1*near*.4*A; float a=clamp(m+ao*fl+near*.3*A,0.,1.); o=vec4(c*a/max(a,.001)*min(a,1.),a);` },
    flame: { label: 'GPU flames', emoji: '🔥', c: ['#ff5a1f', '#ffd27a', '#7a1505'], tip: 'Real-looking flames rise off the letters.',
      f: px + `float m=mk(P),L=MB.w; float up=0.; for(int i=1;i<10;i++){float fi=float(i); vec2 off=vec2((fbm(vec2(P.x*(1.2/L),P.y*(1./L)-T*S*1.1)+fi*.07)-.5)*L*.3,fi*L*.065); off.y+=h1(floor(P)+fi)*L*.065; up+=mk(P-off)*(1.-fi/10.);} up/=3.6; float n=fbm(vec2(P.x*(2.4/L),P.y*(1.6/L)-T*S*2.)); float f=clamp(up*(n*1.7-.25),0.,1.)*A*(1.-m*.9); vec3 fire=mix(C3,mix(C1,C2,smoothstep(.35,1.,f)),smoothstep(.0,.5,f)); float yy=clamp((P.y-MB.y)/MB.w,0.,1.); vec3 lt=mix(C2,C1,yy)*(.8+.35*n); vec3 c=lt*m+fire*f*1.5; float a=clamp(m+f*1.1,0.,1.); o=vec4(c,a);` },
    frost: { label: 'Frost', emoji: '🧊', c: ['#bfe6ff', '#ffffff', '#3a7bd5'], tip: 'Ice crystals grow over the letters, with a cold rim of light.',
      f: px + `float m=mk(P),L=MB.w; vec3 v=vor(P*(7./L)); float cr=smoothstep(.06,.0,v.y-v.x); float rim=clamp(ring(P,L*.05)-m,0.,1.); vec3 c=mix(C3,C1,.55+.45*v.z)*m+C2*cr*m*.8+C1*rim*.9*A; float sp=step(.995,h1(floor(P/2.)+floor(T*S*4.)))*m; c+=sp; float a=clamp(m+rim*.7*A,0.,1.); o=vec4(c*a,a);` },
    gold: { label: 'Gold leaf', emoji: '🥇', c: ['#ffd65a', '#fff6d6', '#8a5a12'], tip: 'Hammered gold leaf with a bevel and a slow glint.',
      f: px + `float m=mk(P); if(m<.01){o=vec4(0);return;} float e=m-ring(P,2.); float n=fbm(P*.08)*.5+vn(P*.4)*.2; vec3 c=mix(C3,C1,.45+n+e*.8); c+=C2*pow(max(0.,1.-abs((P.x-MB.x)/MB.z-fract(T*S*.12)*1.6+.3+(P.y-MB.y)/MB.w*.3)*5.),4.)*A; o=vec4(c*m,m);` },
    holo: { label: 'Hologram', emoji: '🔮', c: ['#5ff3ff', '#ffffff', '#ff3bd5'], tip: 'A flickering projection: scanlines, a colour split and a shimmer.',
      f: px + `float L=MB.w,sh=sin(T*S*7.)*L*.012*A; float r=mk(P+vec2(sh,0)),g=mk(P),b=mk(P-vec2(sh,0)); float sl=.72+.28*sin(P.y*(30./L)+T*S*12.); float fl=.86+.14*sin(T*S*31.); float gl=ring(P,L*.08)*(1.-g); vec3 c=vec3(r,g,b)*mix(C1,C2,.3)*sl*fl+C3*gl*.45*A; float a=clamp(max(max(r,g),b)*.85*sl+gl*.35*A,0.,1.); o=vec4(c*a,a);` },
    glitch: { label: 'Glitch', emoji: '📺', c: ['#ff2a6d', '#05d9e8', '#ffffff'], tip: 'Slices of the letters jump and split into red and blue.',
      f: px + `float t=floor(T*S*10.); float row=floor(P.y/7.); float jit=step(.86,h1(vec2(row,t)))*(h1(vec2(t,row))-.5)*40.*A; vec2 q=P+vec2(jit,0); float r=mk(q+vec2(3.*A,0)),g=mk(q),b=mk(q-vec2(3.*A,0)); vec3 c=vec3(r,0,0)*C1+vec3(0,b,b)*C2+g*C3*.8; float a=clamp(max(max(r,g),b),0.,1.); o=vec4(c,a);` },
    liquid: { label: 'Liquid', emoji: '💧', c: ['#5fb8ff', '#ffffff', '#0b3a7a'], tip: 'The letters ripple like water, with light playing on them.',
      f: px + `vec2 w=vec2(sin(P.y*.08+T*S*2.),cos(P.x*.06+T*S*1.7))*3.*A; float m=mk(P+w); float e=m-mk(P+w+vec2(1.5,-1.5)); float n=fbm(P*.02+T*S*.2); vec3 c=mix(C3,C1,.5+.5*n)+C2*clamp(e*2.,0.,1.); o=vec4(c*m,m);` },
    shadowflame: { label: 'Shadow flame', emoji: '🌑', c: ['#1a0b2e', '#b06bff', '#000000'], tip: 'Dark smoke curls up from the letters, lit from inside.',
      f: px + `float m=mk(P),L=MB.w; float up=0.; for(int i=1;i<9;i++){float fi=float(i); vec2 off=vec2((fbm(vec2(P.x*(.9/L),P.y*(.8/L)-T*S*.7)+fi*.09)-.5)*L*.45,fi*L*.08); off.y+=h1(floor(P)+fi)*L*.08; up+=mk(P-off)*(1.-fi/9.);} up/=3.; float n=fbm(vec2(P.x*(1.8/L),P.y*(1.3/L)-T*S*1.1)); float f=clamp(up*(n*1.6-.3),0.,1.)*A*(1.-m*.9); vec3 c=mix(C1,C2,m*.6+.2*n)*m+mix(C3,C1,f)*f+C2*pow(f,3.)*.6; float a=clamp(m+f*.95,0.,1.); o=vec4(c,a);` },
    aura: { label: 'Heavenly aura', emoji: '🌟', c: ['#fff1c4', '#ffffff', '#ffb52e'], tip: 'Rays of soft light stream out from behind the letters.',
      f: px + `vec2 ce=MB.xy+MB.zw*.5; vec2 d=P-ce; float j=h1(floor(P)); float acc=0.; for(int i=0;i<20;i++){float t=(float(i)+j)/20.;acc+=mk(ce+d*(1.-t*.32));} acc/=20.; float ang=atan(d.y,d.x); float rays=.55+.45*sin(ang*14.+T*S*.8)*sin(ang*7.-T*S*.5); float m=mk(P); float fall=exp(-length(d)/(max(MB.z,MB.w)*.75)); float g=acc*rays*fall*1.1*A*(1.-m); vec3 c=C1*g+C2*m+C3*ring(P,MB.w*.04)*(1.-m)*.5; float a=clamp(g+m,0.,1.); o=vec4(c,a);` },
  };
  // ---- backdrops (full screen, opaque unless the backdrop says otherwise)
  const BACKDROPS = {
    nebula: { label: 'Nebula', emoji: '🌌', cat: 'Space', c: ['#07050f', '#7b5cff', '#ff4fb0'], tip: 'A galaxy of drifting colour and stars.', f: MATERIALS.nebula.f },
    aurora: { label: 'Aurora', emoji: '🌠', cat: 'Sky', c: ['#020611', '#36e08a', '#4f7dff'], tip: 'Curtains of light ripple across a night sky.',
      f: px + `vec3 c=C1; for(int i=0;i<3;i++){float fi=float(i); float y=uv.y-.55-fi*.08+.08*sin(uv.x*3.+T*S*.3+fi)+fbm(vec2(uv.x*3.+T*S*.1,fi))*.15; float b=exp(-y*y*60.)*(.5+.5*fbm(vec2(uv.x*20.,T*S*.4+fi))); c+=mix(C2,C3,fi*.5)*b*.8*A;} c+=step(.997,h1(floor(P/1.5)))*.7*(1.-uv.y*.3); o=vec4(c,1);` },
    godrays: { label: 'God rays', emoji: '☀️', cat: 'Light', c: ['#0a0805', '#ffd27a', '#ff8a3d'], tip: 'Beams of light pour down through dust.',
      f: px + `vec2 s=vec2(.5,1.15); vec2 d=uv-s; float ang=atan(d.x,-d.y); float r=fbm(vec2(ang*9.,T*S*.15))*.8+fbm(vec2(ang*23.,T*S*.3))*.4; float fall=exp(-length(d)*1.3); vec3 c=C1+mix(C3,C2,r)*pow(r,2.)*fall*1.4*A; c+=step(.996,h1(floor(P/2.)+floor(T*S*.5)))*fall*.6; o=vec4(c,1);` },
    smoke: { label: 'Smoke', emoji: '💨', cat: 'Weather', c: ['#0b0b0e', '#5a5560', '#c9a13b'], tip: 'Slow, heavy smoke rolls across.',
      f: px + `vec2 q=uv*vec2(3.,1.7); float n=fbm(q+vec2(T*S*.06,0)+fbm(q*1.5-T*S*.04)); vec3 c=mix(C1,C2,smoothstep(.3,.9,n))+C3*smoothstep(.75,1.,n)*.3*A; o=vec4(c,1);` },
    plasma: { label: 'Plasma', emoji: '🧪', cat: 'Energy', c: ['#05010d', '#ff2a6d', '#05d9e8'], tip: 'Liquid energy swirls in two colours.',
      f: px + `vec2 q=uv*4.; float v=sin(q.x+T*S)+sin(q.y*1.3-T*S*.7)+sin((q.x+q.y)*.7+T*S*.5)+sin(length(q-2.)*2.-T*S); vec3 c=C1+mix(C2,C3,.5+.5*sin(v))*(.45+.3*sin(v*1.5))*A; o=vec4(c,1);` },
    warp: { label: 'Warp speed', emoji: '🚀', cat: 'Space', c: ['#02030a', '#9fd0ff', '#ffffff'], tip: 'Stars stream past at light speed.',
      f: px + `vec2 d=uv-.5; d.x*=R.x/R.y; float a=atan(d.y,d.x),r=length(d); float id=floor(a*80.); float z=fract(h1(vec2(id,1.))+T*S*.35*(.5+h1(vec2(id,2.)))); float st=smoothstep(.02,.0,abs(r-z*.9))*step(.6,h1(vec2(id,3.)))*z; vec3 c=C1+mix(C2,C3,z)*st*2.*A+C2*exp(-r*5.)*.15; o=vec4(c,1);` },
    synthgrid: { label: 'Synth grid', emoji: '🕹️', cat: 'Retro', c: ['#0b0016', '#ff3bd5', '#39d5ff'], tip: 'A neon grid racing to a glowing horizon.',
      f: px + `vec3 c=C1; float hz=.42; if(uv.y<hz){float z=1./max(.02,hz-uv.y); float gx=abs(fract((uv.x-.5)*z*.35)-.5); float gz=abs(fract(z*.6+T*S*1.2)-.5); float l=smoothstep(.04,.0,min(gx,gz)/z*8.)*smoothstep(0.,.25,hz-uv.y)*1.2; c+=C2*l*A;} else { c=mix(C1,C3*.25,smoothstep(.42,1.,uv.y)); } float sun=smoothstep(.2,.19,length((uv-vec2(.5,.52))*vec2(R.x/R.y,1.))); c=mix(c,mix(C2,C3,(uv.y-.4)*3.),sun*step(.0,sin(uv.y*120.)+.6)); c+=C2*exp(-abs(uv.y-hz)*40.)*.5; o=vec4(c,1);` },
    liquidmetal: { label: 'Liquid metal', emoji: '🫗', cat: 'Metal', c: ['#0d0d10', '#c9ccd3', '#ffffff'], tip: 'A sea of chrome slowly flowing.',
      f: px + `vec2 q=P*.0035; float n=fbm(q+vec2(T*S*.05,T*S*.03)); float n2=fbm(q*2.+n*3.); float b=.5+.5*sin(n2*14.+T*S*.6); vec3 c=mix(C1,C2,pow(b,2.)*.85)+C3*pow(b,24.)*.8*A; o=vec4(c,1);` },
    lavaflow: { label: 'Lava flow', emoji: '🌋', cat: 'Fire', c: ['#120604', '#ff5a1f', '#ffd27a'], tip: 'Cracked ground with molten rivers moving below.', f: MATERIALS.lava.f },
    ink: { label: 'Ink in water', emoji: '🖋️', cat: 'Weather', c: ['#f2efe8', '#0b0b0d', '#7a1515'], tip: 'Clouds of ink bloom and curl through water.',
      f: px + `vec2 q=uv*vec2(2.5,1.5); float n=fbm(q*1.2+fbm(q*2.+T*S*.05)*1.8-T*S*.03); vec3 c=mix(C1,C2,smoothstep(.45,.85,n)*A); c=mix(c,C3,smoothstep(.75,.95,fbm(q*2.5+3.))*.5*A); o=vec4(c,1);` },
    storm: { label: 'Storm clouds', emoji: '⛈️', cat: 'Weather', c: ['#06080c', '#3a4458', '#bfd6ff'], tip: 'Heavy clouds churn; lightning lights them up now and then.',
      f: px + `vec2 q=uv*vec2(3.,1.6)+vec2(T*S*.04,0); float n=fbm(q+fbm(q*2.)); float fl=step(.985,h1(vec2(floor(T*S*4.),1.)))*(.5+.5*h1(vec2(floor(T*S*4.),2.))); vec3 c=mix(C1,C2,n)+C3*fl*n*1.2*A; o=vec4(c,1);` },
    hexfield: { label: 'Hex field', emoji: '⬡', cat: 'Energy', c: ['#020812', '#39d5ff', '#ffffff'], tip: 'An energy shield of hexagons, pulsing in waves.',
      f: px + `vec2 r=vec2(1.,1.732),hr=r*.5,q=P/44.; vec2 a=mod(q,r)-hr,b=mod(q-hr,r)-hr; vec2 gv=dot(a,a)<dot(b,b)?a:b; vec2 id=q-gv; float hx=max(dot(abs(gv),normalize(vec2(1.,1.732))),abs(gv.x)); float e=smoothstep(.43,.49,hx); float w=.5+.5*sin(length(uv-.5)*12.-T*S*2.+h1(id)*2.); vec3 c=C1+C1*.4*(1.-hx)+C2*e*(.12+pow(w,3.)*.8)*A+C3*e*pow(w,12.)*.5; o=vec4(c,1);` },
    caustics: { label: 'Caustics', emoji: '🌊', cat: 'Light', c: ['#021821', '#5ff3ff', '#ffffff'], tip: 'Light dancing on the floor of a pool.',
      f: px + `vec2 q=uv*vec2(6.,3.4); float c0=0.; for(int i=0;i<3;i++){float fi=float(i); vec3 v=vor(q*(1.+fi*.6)+vec2(T*S*.2*(fi+1.),T*S*.13)); c0+=smoothstep(.12,.0,v.y-v.x)*(.6/(fi+1.));} vec3 c=C1+C2*c0*A+C3*pow(c0,3.)*.4; o=vec4(c,1);` },
    void: { label: 'The void', emoji: '🕳️', cat: 'Space', c: ['#000000', '#7b2cff', '#ff2a6d'], tip: 'A dark vortex turning slowly in the middle.',
      f: px + `vec2 d=uv-.5; d.x*=R.x/R.y; float r=length(d),a=atan(d.y,d.x); float sp=a+r*6.-T*S*.6; float sw=fbm(vec2(cos(sp),sin(sp))*1.6+vec2(r*4.,0.)); float ring=exp(-pow((r-.28)*8.,2.)); vec3 c=C1+mix(C2,C3,sw)*sw*ring*1.3*A+C2*exp(-r*2.)*.1; c*=smoothstep(.02,.12,r); o=vec4(c,1);` },
  };
  const FLUIDS = {
    smoke: { label: 'Fluid smoke', emoji: '🌫️', c: ['#c9c3b6', '#6e6a63', '#ffffff'], tip: 'Real smoke: it curls, mixes and bursts on a moment.' },
    ink: { label: 'Fluid ink', emoji: '🖋️', c: ['#0b0b0d', '#7a1515', '#2a2a2e'], tip: 'Ink swirls through water as if poured live.' },
    fire: { label: 'Fluid fire', emoji: '🔥', c: ['#ff5a1f', '#ffd27a', '#7a1505'], tip: 'Flame that rises and licks along the bottom of the screen.' },
  };
  // ---- the film look (Phase 5): colour grades and the composer's ready-made scenes
  const GRADES = {
    none: { label: 'As it is', f: '' },
    cinematic: { label: 'Cinematic', f: 'contrast(1.12) saturate(1.08)', tint: 'linear-gradient(180deg,rgba(0,90,110,.18),rgba(255,140,40,.12))', blend: 'soft-light' },
    noir: { label: 'Noir', f: 'grayscale(1) contrast(1.35) brightness(.92)', tint: '', blend: '' },
    warm: { label: 'Warm', f: 'saturate(1.1) sepia(.18)', tint: 'linear-gradient(180deg,rgba(255,170,60,.16),rgba(255,90,30,.12))', blend: 'soft-light' },
    cold: { label: 'Cold', f: 'saturate(.95) hue-rotate(-8deg)', tint: 'linear-gradient(180deg,rgba(80,140,255,.18),rgba(20,40,90,.16))', blend: 'soft-light' },
    bleach: { label: 'Bleach bypass', f: 'contrast(1.3) saturate(.55) brightness(1.03)', tint: '', blend: '' },
    vintage: { label: 'Vintage', f: 'sepia(.35) contrast(.95) saturate(.9) brightness(1.04)', tint: 'radial-gradient(ellipse at 30% 20%,rgba(255,200,120,.18),transparent 60%)', blend: 'screen' },
    neon: { label: 'Neon', f: 'saturate(1.45) contrast(1.1)', tint: 'linear-gradient(135deg,rgba(255,59,213,.14),rgba(57,213,255,.14))', blend: 'screen' },
  };
  const COMPOSER = {
    cinematic: { label: 'Cinematic', emoji: '🎬', tip: 'God rays, a cinematic grade, black bars and fine grain.', backdrop: { k: 'godrays' }, post: { grade: 'cinematic', grain: .25, vignette: .45, bars: .09, leak: 0, scan: 0, ca: 0, flicker: 0 } },
    arcade: { label: 'Arcade CRT', emoji: '🕹️', tip: 'A synth grid, scanlines, a colour fringe and a curved-glass vignette.', backdrop: { k: 'synthgrid' }, post: { grade: 'neon', grain: .15, vignette: .55, bars: 0, leak: 0, scan: .5, ca: .5, flicker: .2 } },
    dream: { label: 'Dreamscape', emoji: '🌠', tip: 'Aurora, a soft warm grade and a drifting light leak.', backdrop: { k: 'aurora' }, post: { grade: 'warm', grain: .1, vignette: .3, bars: 0, leak: .55, scan: 0, ca: 0, flicker: 0 } },
    inferno: { label: 'Inferno', emoji: '🔥', tip: 'Lava below, fluid fire along the bottom and a warm grade.', backdrop: { k: 'lavaflow' }, fluid: { k: 'fire' }, post: { grade: 'warm', grain: .2, vignette: .5, bars: 0, leak: .2, scan: 0, ca: 0, flicker: 0 } },
    abyss: { label: 'Abyss', emoji: '🕳️', tip: 'The void turning in the dark, noir grade and heavy grain.', backdrop: { k: 'void' }, post: { grade: 'noir', grain: .45, vignette: .7, bars: .06, leak: 0, scan: 0, ca: 0, flicker: .15 } },
    shield: { label: 'Energy shield', emoji: '⬡', tip: 'A pulsing hex field, a cold grade and a little fringe.', backdrop: { k: 'hexfield' }, post: { grade: 'cold', grain: .1, vignette: .4, bars: 0, leak: 0, scan: .15, ca: .25, flicker: 0 } },
    ink: { label: 'Ink & paper', emoji: '🖋️', tip: 'Ink blooming in water, a vintage grade and grain.', fluid: { k: 'ink' }, backdrop: { k: 'ink' }, post: { grade: 'vintage', grain: .35, vignette: .35, bars: 0, leak: 0, scan: 0, ca: 0, flicker: .1 } },
    storm: { label: 'Storm', emoji: '⛈️', tip: 'Storm clouds with lightning, a bleach-bypass grade.', backdrop: { k: 'storm' }, post: { grade: 'bleach', grain: .3, vignette: .55, bars: .07, leak: 0, scan: 0, ca: .15, flicker: 0 } },
  };

  // ===================================================================================== the shared context
  let gl = null, glc = null, quad = null, failed = false, gen = 0, BM = false;   // BM: frames handed over as bitmaps (1.12.12)      // gen: bumped with every new context (after a lost one, textures are made again)
  const progs = new Map(), live = new Set();
  // 1.12.15: BeeboFX 3 draws in BeeboFX 4's shared 'fx' context (with BeeboFX) and runs on its master clock; its
  // watchdog defers to BeeboFX 4's governor. Without BeeboFX 4 it has its own, as before.
  const X4 = () => window.BeeboFX4;
  const RAF = f => (X4() ? X4().raf(f) : requestAnimationFrame(f)), CAF = id => (X4() ? X4().caf(id) : cancelAnimationFrame(id));
  let X4c = null;
  function ctx() {
    if (gl && X4c) { if (X4c.lost) { progs.clear(); gl = null; X4c = null; } else { X4().claim('fx', 'fx3'); return gl; } }
    if (gl || failed) return gl;
    if (X4()) { const c = X4().context('fx'); if (c) { X4c = c; gl = c.gl; glc = c.canvas; BM = c.bm; gen++; X4().claim('fx', 'fx3');
      quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW); return gl; } }
    try {
      const opts = { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' };
      // 1.12.12: an OffscreenCanvas whose frames are handed over whole (transferToImageBitmap → a 'bitmaprenderer' canvas)
      BM = false; gl = null;
      if (typeof OffscreenCanvas === 'function' && !window.__BFX3_COPY) {
        try { glc = new OffscreenCanvas(64, 64); gl = glc.getContext('webgl2', opts); BM = !!gl && typeof glc.transferToImageBitmap === 'function'; } catch (e) { gl = null; }
        if (gl && !BM) gl = null;
      }
      if (!gl) { glc = document.createElement('canvas'); glc.width = 64; glc.height = 64; gl = glc.getContext('webgl2', opts); }
      if (!gl) throw new Error('no webgl2'); gen++;
      quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      glc.addEventListener('webglcontextlost', e => { e.preventDefault(); progs.clear(); gl = null; failed = false; });
    } catch (e) { failed = true; gl = null; }
    return gl;
  }
  function program(key, src) {
    if (progs.has(key)) return progs.get(key);
    const sh = (type, s) => { const x = gl.createShader(type); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) { console.warn('BeeboFX3', key, gl.getShaderInfoLog(x)); return null; } return x; };
    const v = sh(gl.VERTEX_SHADER, VS), f = sh(gl.FRAGMENT_SHADER, HEAD + 'void main(){' + src + '}');
    if (!v || !f) { progs.set(key, null); return null; }
    const p = gl.createProgram(); gl.attachShader(p, v); gl.attachShader(p, f); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn('BeeboFX3', key, gl.getProgramInfoLog(p)); progs.set(key, null); return null; }
    const u = {}; for (const n of ['R', 'T', 'A', 'S', 'SEED', 'K', 'C1', 'C2', 'C3', 'M', 'MB', 'HM']) u[n] = gl.getUniformLocation(p, n);
    const P = { p, u }; progs.set(key, P); return P;
  }
  // the drawing surface for a piece's frame: exactly its size when frames are handed over, else big enough (copied from a corner)
  function target(w, h) {
    if (BM) { if (glc.width !== w) glc.width = w; if (glc.height !== h) glc.height = h; }
    else if (glc.width < w || glc.height < h) { glc.width = Math.max(glc.width, w); glc.height = Math.max(glc.height, h); }
  }
  // the finished frame onto the piece's own canvas
  function present(cv, w, h) {
    if (BM) { const b = glc.transferToImageBitmap(); (cv.__br || (cv.__br = cv.getContext('bitmaprenderer'))).transferFromImageBitmap(b); return; }
    const g = cv.getContext('2d'); g.clearRect(0, 0, w, h); g.drawImage(glc, 0, glc.height - h, w, h, 0, 0, w, h);
  }
  function blank(cv) {
    try { if (cv.__br) cv.__br.transferFromImageBitmap(null); else if (cv.width) { const g = cv.getContext('2d'); if (g) g.clearRect(0, 0, cv.width, cv.height); } } catch (e) {}
  }
  function draw(P, w, h, o, t, tex, mb) {
    target(w, h);
    gl.viewport(0, 0, w, h); gl.disable(gl.BLEND); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(P.p); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const c = o.colors || [], u = P.u;
    gl.uniform2f(u.R, w, h); gl.uniform1f(u.T, t); gl.uniform1f(u.A, o.amt ?? 1); gl.uniform1f(u.S, o.speed ?? 1); gl.uniform1f(u.SEED, o.seed || 0); gl.uniform1f(u.K, o.k2 || 0);
    gl.uniform3fv(u.C1, hex(c[0])); gl.uniform3fv(u.C2, hex(c[1])); gl.uniform3fv(u.C3, hex(c[2]));
    if (tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(u.M, 0); gl.uniform1i(u.HM, 1); gl.uniform4f(u.MB, mb[0], mb[1], mb[2], mb[3]); } else gl.uniform1i(u.HM, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // ===================================================================================== instances
  let raf = 0, last = 0, frames = 0;
  // 1.12.12: whether a piece is on screen comes from an IntersectionObserver (told when it's laid out or taken away), not
  // from measuring every piece every frame; the rest are cheap class checks
  const byCv = new WeakMap();
  const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(es => { let any = false; for (const e of es) { const h = byCv.get(e.target); if (h) { h.io = e.isIntersecting; any = any || h.io; } } if (any) kick(); }) : null;
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(es => { for (const e of es) { const hs = byHost.get(e.target); if (hs) for (const h of hs) { h.sz = null; h.moved = true; } } kick(); }) : null;
  const byHost = new WeakMap();
  const watchSize = (h, node) => { if (!ro || !node) return; let s = byHost.get(node); if (!s) { s = new Set(); byHost.set(node, s); ro.observe(node); } s.add(h); };
  const unwatchSize = (h, node) => { const s = node && byHost.get(node); if (!s) return; s.delete(h); if (!s.size) { byHost.delete(node); try { ro.unobserve(node); } catch (e) {} } };
  // a node's size, measured once and again only when the ResizeObserver says it changed
  const sizeOf = (h, node) => { if (!h.sz || !ro) h.sz = [node.clientWidth, node.clientHeight]; return h.sz; };
  const visible = c => { const h = byCv.get(c); return c.isConnected && (io && h ? h.io : c.offsetParent !== null) && !c.closest('.sd-hidden') && !(window.SBPerf && window.SBPerf.covered && !c.closest('#sbv,#sbc,.sd-splash,#sbf-sp,#sbf-lock')); };
  // asleep: nothing on screen, no frame loop; any class change on the page (a splash shown, the board uncovered) wakes it
  let asleep = false;
  const waker = typeof MutationObserver === 'function' ? new MutationObserver(() => kick()) : null;
  let slowT = 0;
  function sleep() {
    if (asleep) return; asleep = true; raf = 0; WD.prev = 0;      // (the gap while asleep isn't a slow frame)
    if (waker) waker.observe(document.documentElement, { attributes: true, attributeFilter: ['class'], subtree: true });
    clearTimeout(slowT); slowT = setTimeout(kick, 1000);          // and a look once a second, for anything that changes without a class
    const now = performance.now(); if (now - WD.reportAt < 4000) return; WD.reportAt = now;
    try { window.dispatchEvent(new CustomEvent('beebo:gfx-load', { detail: { fps: 0, ms: 0, level: WD.level, why: WD.why, shown: 0, on: !off() && !!gl, q: String(window.__SB_GFXQ || 'auto'), asleep: true } })); } catch (e) {}
  }
  let lastOff = null;
  const autoQ = () => String(window.__SB_GFXQ || 'auto') === 'auto' && /^\/(overlay|commentary)/.test(location.pathname) && !/[?&](preview|edit)\b/.test(location.search);
  function watchdog(now, cost) {
    if (X4()) { const G = X4().gov; WD.level = autoQ() ? G.level : 0; WD.why = G.why; return; }   // 1.12.15: one governor for every engine (it reports to the app too)
    if (cost != null) { WD.cost.push(cost); if (WD.prev) WD.gaps.push(now - WD.prev); WD.prev = now; if (WD.cost.length > 60) WD.cost.shift(); if (WD.gaps.length > 60) WD.gaps.shift(); }
    if (now - WD.evalAt < 2000) return; WD.evalAt = now;
    const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0, c = avg(WD.cost), g = avg(WD.gaps);
    if (autoQ()) {
      if (WD.level < 2 && WD.cost.length >= 20 && (c > 18 || g > 75) && now - WD.changedAt > 6000) {
        WD.level++; WD.changedAt = now; WD.goodSince = 0; WD.cost = []; WD.gaps = []; WD.prev = 0;
        WD.why = c > 18 ? `drawing took ${Math.round(c)} ms a frame` : `only ${Math.round(1000 / g)} frames a second`;
      } else if (WD.level === 1 && WD.cost.length >= 20 && c < 6 && g < 45) {
        WD.goodSince = WD.goodSince || now; if (now - WD.goodSince > 30000 && now - WD.changedAt > 60000) { WD.level = 0; WD.changedAt = now; WD.why = ''; }
      } else if (WD.level === 2 && now - WD.changedAt > 90000) { WD.level = 1; WD.changedAt = now; WD.cost = []; WD.gaps = []; WD.prev = 0; }   // try again, smaller
      else if (c >= 6 || g >= 45) WD.goodSince = 0;
    } else if (WD.level) { WD.level = 0; WD.why = ''; }
    // tell the app how it's doing (the panel shows it next to Effects quality and in Viewer latency)
    if (now - WD.reportAt > 4000) { WD.reportAt = now; let shown = 0; for (const h of live) if (!h.dead && visible(h.cv)) shown++;
      try { window.dispatchEvent(new CustomEvent('beebo:gfx-load', { detail: { fps: g ? Math.round(1000 / g) : 0, ms: Math.round(c * 10) / 10, level: WD.level, why: WD.why, shown, on: !off() && !!gl, q: String(window.__SB_GFXQ || 'auto') } })); } catch (e) {} }
  }
  function loop(now) {
    raf = live.size ? RAF(loop) : 0;
    const o = off(); if (o !== lastOff) { lastOff = o; for (const h of live) if (h.aside) try { h.aside(o); } catch (e) {} }
    if (document.hidden) return;
    if (o || !ctx()) { watchdog(now, null); CAF(raf); sleep(); return; }     // the plain look: nothing to draw
    // which pieces are on screen (a quarter-second's grace before sleeping, so a splash swapping screens doesn't stutter)
    const shown = []; for (const h of live) if (!h.dead && visible(h.cv)) shown.push(h);
    if (!shown.length) { if (now - (WD.seenAt || 0) > 250) { CAF(raf); sleep(); } return; }
    WD.seenAt = now;
    const fps = light() ? 24 : 30; if (now - last < 1000 / fps - 2) return; last = now;
    const t0 = performance.now();
    frames++; for (const h of shown) { try { h.frame(now / 1000); h.drawn = (h.drawn || 0) + 1; } catch (e) { console.warn('BeeboFX3', e); h.dead = true; } }
    watchdog(now, performance.now() - t0);
  }
  const kick = () => { if (!raf && live.size) { if (asleep) { asleep = false; clearTimeout(slowT); if (waker) waker.disconnect(); } raf = RAF(loop); } };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  function makeCanvas(host, cls, css) { const cv = document.createElement('canvas'); cv.className = 'bfx3 ' + cls; cv.style.cssText = 'position:absolute;pointer-events:none;' + css; cv.setAttribute('data-noicon', ''); host.appendChild(cv); return cv; }
  function sizeTo(cv, w, h) { const k = light() ? .6 : 1, W = Math.max(2, Math.round(w * k)), Hh = Math.max(2, Math.round(h * k)); if (cv.width !== W || cv.height !== Hh) { cv.width = W; cv.height = Hh; } return [W, Hh]; }
  function base(kind, cat, host, o, cv) {
    const h = { kind, o: { ...o }, cv, dead: false, seed: Math.random() * 10,
      set(n) { Object.assign(h.o, n || {}); if (n && n.k && n.k !== h.k) { h.k = n.k; } },
      destroy() { h.dead = true; live.delete(h); if (io) try { io.unobserve(cv); } catch (e) {} for (const n of h.watched || []) unwatchSize(h, n); try { cv.remove(); } catch (e) {} if (h.extra) try { h.extra(); } catch (e) {} } };
    h.k = o.k; h.cat = cat; live.add(h); byCv.set(cv, h); h.io = !io; if (io) io.observe(cv); kick(); return h;
  }
  const mergeColors = (cat, k, o) => { const d = cat[k] || {}; const c = o.colors && o.colors.length ? o.colors : d.c || []; return { ...o, colors: [c[0] || (d.c || [])[0], c[1] || (d.c || [])[1], c[2] || (d.c || [])[2]] }; };

  /** a living surface filling `host` (o.clip: a CSS clip-path for the piece's outline) */
  function material(host, o = {}) {
    const cv = makeCanvas(host, 'mat', `left:0;top:0;width:100%;height:100%;${o.clip ? 'clip-path:' + o.clip + ';' : ''}${o.z != null ? 'z-index:' + o.z + ';' : ''}`);
    const h = base('material', MATERIALS, host, o, cv); h.watched = [host]; watchSize(h, host);
    h.frame = t => { const d = MATERIALS[h.k]; if (!d) return; const [cw, ch] = sizeOf(h, host), [w, hh] = sizeTo(cv, cw, ch); const P = program('m:' + h.k, d.f); if (!P) return;
      draw(P, w, hh, { ...mergeColors(MATERIALS, h.k, h.o), seed: h.seed }, t * 1, null); present(cv, w, hh); };
    h.aside = on => { cv.style.background = on ? `linear-gradient(160deg,${(mergeColors(MATERIALS, h.k, h.o).colors).join(',')})` : ''; if (on) blank(cv); };   // the plain stand-in
    h.aside(off() || !ctx());
    return h;
  }
  // the letters as a picture (their own pixels, so gradients, outlines and fitting are exactly as drawn)
  async function lettersOf(el) {
    const w = Math.max(2, Math.round(el.offsetWidth)), hh = Math.max(2, Math.round(el.offsetHeight)), cs = getComputedStyle(el);
    // several lines (a wrapped text piece): the page's own drawing, with the styles it inherits written onto it
    if (el.classList.contains('sd-wrap') && window.BeeboFX2 && window.BeeboFX2.capture) {
      const keep = el.getAttribute('style') || '';
      try { for (const k of ['fontFamily', 'fontWeight', 'fontStyle', 'textTransform', 'letterSpacing', 'lineHeight', 'textAlign']) el.style[k] = cs[k]; const c = await window.BeeboFX2.capture(el, { w, h: hh }); if (c) return c; } catch (e) {} finally { el.setAttribute('style', keep); }
    }
    // one line: drawn straight from the font the page has loaded (its family, weight, slant, size, spacing and capitals)
    try { await document.fonts.load(`${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`); } catch (e) {}
    const c = document.createElement('canvas'); c.width = w; c.height = hh; const g = c.getContext('2d');
    g.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; if ('letterSpacing' in g && cs.letterSpacing !== 'normal') g.letterSpacing = cs.letterSpacing;
    g.textBaseline = 'alphabetic'; g.fillStyle = '#fff';
    const tt = cs.textTransform, raw = el.textContent || '', txt = tt === 'uppercase' ? raw.toUpperCase() : tt === 'lowercase' ? raw.toLowerCase() : raw;
    const m = g.measureText(txt), tw = m.width, asc = m.fontBoundingBoxAscent || parseFloat(cs.fontSize) * .8, desc = m.fontBoundingBoxDescent || parseFloat(cs.fontSize) * .2;
    const pl = parseFloat(cs.paddingLeft) || 0, pr = parseFloat(cs.paddingRight) || 0, al = cs.textAlign, x = al === 'center' ? pl + (w - pl - pr - tw) / 2 : al === 'right' || al === 'end' ? w - pr - tw : pl;
    const avail = w - pl - pr; if (tw > avail && avail > 4) { g.translate(pl, 0); g.scale(avail / tw, 1); g.fillText(txt, 0, (hh - asc - desc) / 2 + asc); return c; }    // squeezed to its box, as the page fits it
    g.fillText(txt, Math.max(0, x), (hh - asc - desc) / 2 + asc); return c;
  }
  /** a lettering effect on `el` (the element holding the words) */
  function text(el, o = {}) {
    // o.host: where the canvas goes (on the scoreboard, a box clipped to the piece's outline, so nothing spills over the game's HUD);
    // o.origin: the positioned element o.host fills (its top-left is the canvas's 0, 0)
    const host = o.host || el.parentElement;
    const at = () => { if (!o.origin) return [el.offsetLeft, el.offsetTop]; let x = 0, y = 0, n = el; while (n && n !== o.origin) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; } return [x, y]; };
    const cv = makeCanvas(host, 'ltx', 'left:0;top:0;width:2px;height:2px;z-index:2');
    const h = base('text', LETTERS, host, o, cv); let tex = null, mkey = '', building = false, tgen = 0;
    const rebuild = async () => {
      if (building) return; building = true;
      try { const c = await lettersOf(el); if (!ctx()) return; if (tgen !== gen) tex = null; tgen = gen; tex = tex || gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      } catch (e) {} finally { building = false; }
    };
    // 1.12.12: the letters are measured when their size or words change (and once a second, in case only their place
    // moved), not every frame
    let M = null, mAt = 0, words = '';
    h.watched = [el]; watchSize(h, el);
    h.frame = t => {
      const now = performance.now(), wd = el.textContent + '|' + el.style.fontSize;
      if (!M || h.moved || wd !== words || now - mAt > 1000 || tgen !== gen) {
        h.moved = false; words = wd; mAt = now; const ew = el.offsetWidth, eh = el.offsetHeight, p2 = Math.round(Math.max(24, eh * .6)), [ax, ay] = at();
        M = { ew, eh, p2, W0: ew + p2 * 2, H0: eh + p2 * 2, ax, ay };
        const key = wd + '|' + ew + '|' + eh + '|' + gen; if (key !== mkey) { mkey = key; rebuild(); }
        const pos = `${ax - p2}|${ay - p2}|${M.W0}|${M.H0}`; if (pos !== h.pos) { h.pos = pos; Object.assign(cv.style, { left: (ax - p2) + 'px', top: (ay - p2) + 'px', width: M.W0 + 'px', height: M.H0 + 'px' }); }
      }
      const { p2, W0, H0, ew, eh } = M;
      if (!tex) return; const d = LETTERS[h.k]; if (!d) return; const [w, hh] = sizeTo(cv, W0, H0), k = w / W0, P = program('l:' + h.k, d.f); if (!P) return;
      draw(P, w, hh, { ...mergeColors(LETTERS, h.k, h.o), seed: h.seed }, t, tex, [p2 * k, p2 * k, ew * k, eh * k]);
      present(cv, w, hh);
    };
    h.extra = () => { if (tex && gl && tgen === gen) gl.deleteTexture(tex); el.style.visibility = ''; };
    h.aside = on => { el.style.visibility = on || o.hide === false ? '' : 'hidden'; cv.style.visibility = on ? 'hidden' : ''; };   // the effect draws the letters itself
    h.aside(off() || !ctx());
    return h;
  }
  /** a letter fill: o.src (picture / video), or o.mat (a material) shows only inside the letters */
  function mask(el, o = {}) {
    const host = el.parentElement, wrap = document.createElement('div');
    wrap.className = 'bfx3 lmask'; wrap.style.cssText = `position:absolute;pointer-events:none;left:${el.offsetLeft}px;top:${el.offsetTop}px;width:${el.offsetWidth}px;height:${el.offsetHeight}px;z-index:2;-webkit-mask-size:100% 100%;mask-size:100% 100%`;
    host.appendChild(wrap); let media = null, mh = null, mkey = '', dead = false;
    if (o.mat) mh = material(wrap, { k: o.mat, colors: o.colors, speed: o.speed, amt: o.amt });
    else if (o.src) { const vid = /\.(webm|mp4)(\?|$)/i.test(o.src); media = document.createElement(vid ? 'video' : 'img'); if (vid) { media.muted = true; media.loop = true; media.autoplay = true; media.playsInline = true; } media.src = o.src; media.style.cssText = `position:absolute;inset:0;width:100%;height:100%;object-fit:${o.fit || 'cover'}`; wrap.appendChild(media); if (vid) media.play().catch(() => {}); }
    const fit = async () => {
      if (dead) return; const key = el.textContent + '|' + el.offsetWidth + '|' + el.offsetHeight + '|' + el.style.fontSize; if (key === mkey) return; mkey = key;
      Object.assign(wrap.style, { left: el.offsetLeft + 'px', top: el.offsetTop + 'px', width: el.offsetWidth + 'px', height: el.offsetHeight + 'px' });
      try { const c = await lettersOf(el); const u = c.toDataURL('image/png'); wrap.style.webkitMaskImage = wrap.style.maskImage = `url(${u})`; el.style.visibility = 'hidden'; } catch (e) {}
    };
    // 1.12.12: fitted again when the letters change size or words (observers), not checked every 600 ms
    fit(); let ft = 0; const again = () => { clearTimeout(ft); ft = setTimeout(() => { if (!wrap.isConnected) return; fit(); }, 60); };
    const rob = typeof ResizeObserver === 'function' ? new ResizeObserver(again) : null, mob = typeof MutationObserver === 'function' ? new MutationObserver(again) : null;
    if (rob) rob.observe(el); if (mob) mob.observe(el, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    const t = rob ? 0 : setInterval(() => { if (!wrap.isConnected) return clearInterval(t); fit(); }, 600);
    if (document.fonts) document.fonts.ready.then(() => { mkey = ''; fit(); });
    return { kind: 'mask', set(n) { Object.assign(o, n || {}); if (mh) mh.set({ k: o.mat, colors: o.colors, speed: o.speed, amt: o.amt }); }, destroy() { dead = true; clearInterval(t); clearTimeout(ft); if (rob) rob.disconnect(); if (mob) mob.disconnect(); if (mh) mh.destroy(); wrap.remove(); el.style.visibility = ''; } };
  }
  /** a full-screen backdrop on a screen */
  function backdrop(host, o = {}) {
    const cv = makeCanvas(host, 'bd', 'left:0;top:0;width:100%;height:100%;z-index:0');
    const h = base('backdrop', BACKDROPS, host, o, cv); h.watched = [host]; watchSize(h, host);
    h.frame = t => { const d = BACKDROPS[h.k]; if (!d) return; const [cw, ch] = sizeOf(h, host), [w, hh] = sizeTo(cv, Math.min(1280, cw * .667), Math.min(720, ch * .667)); const P = program('b:' + h.k, d.f); if (!P) return;
      draw(P, w, hh, { ...mergeColors(BACKDROPS, h.k, h.o), seed: h.seed }, t, null); present(cv, w, hh); };
    h.aside = on => { const c = mergeColors(BACKDROPS, h.k, h.o).colors; cv.style.background = on ? `radial-gradient(ellipse at 50% 40%,${c[1]}55,transparent 60%),linear-gradient(180deg,${c[0]},${c[0]})` : ''; if (on) blank(cv); };
    h.aside(off() || !ctx());
    return h;
  }

  // ===================================================================================== fluids (stable fluids on the graphics card)
  const FL = {
    adv: `uniform sampler2D U,X;uniform vec2 TX;uniform float DT,DIS;void main(){vec2 c=uv-DT*texture(U,uv).xy*TX;o=DIS*texture(X,c);}`,
    div: `uniform sampler2D U;uniform vec2 TX;void main(){float l=texture(U,uv-vec2(TX.x,0)).x,r=texture(U,uv+vec2(TX.x,0)).x,b=texture(U,uv-vec2(0,TX.y)).y,t=texture(U,uv+vec2(0,TX.y)).y;o=vec4(.5*(r-l+t-b),0,0,1);}`,
    prs: `uniform sampler2D Pr,D;uniform vec2 TX;void main(){float l=texture(Pr,uv-vec2(TX.x,0)).x,r=texture(Pr,uv+vec2(TX.x,0)).x,b=texture(Pr,uv-vec2(0,TX.y)).x,t=texture(Pr,uv+vec2(0,TX.y)).x;o=vec4((l+r+b+t-texture(D,uv).x)*.25,0,0,1);}`,
    grd: `uniform sampler2D Pr,U;uniform vec2 TX;void main(){float l=texture(Pr,uv-vec2(TX.x,0)).x,r=texture(Pr,uv+vec2(TX.x,0)).x,b=texture(Pr,uv-vec2(0,TX.y)).x,t=texture(Pr,uv+vec2(0,TX.y)).x;o=vec4(texture(U,uv).xy-.5*vec2(r-l,t-b),0,1);}`,
    spl: `uniform sampler2D X;uniform vec2 PT;uniform vec3 V;uniform float RAD,ASP;void main(){vec2 d=uv-PT;d.x*=ASP;float s=exp(-dot(d,d)/RAD);o=vec4(texture(X,uv).xyz+V*s,1);}`,
    curl: `uniform sampler2D U;uniform vec2 TX;void main(){float l=texture(U,uv-vec2(TX.x,0)).y,r=texture(U,uv+vec2(TX.x,0)).y,t=texture(U,uv+vec2(0,TX.y)).x,b=texture(U,uv-vec2(0,TX.y)).x;o=vec4(.5*(r-l-t+b),0,0,1);}`,
    vort: `uniform sampler2D U,C,X;uniform vec2 TX;uniform float DT,CU,BU;void main(){float l=texture(C,uv-vec2(TX.x,0)).x,r=texture(C,uv+vec2(TX.x,0)).x,t=texture(C,uv+vec2(0,TX.y)).x,b=texture(C,uv-vec2(0,TX.y)).x,c=texture(C,uv).x;vec2 f=.5*vec2(abs(t)-abs(b),abs(r)-abs(l));f/=length(f)+1e-4;f*=CU*c;f.y*=-1.;vec2 v=texture(U,uv).xy+f*DT+vec2(0,BU*texture(X,uv).r)*DT;o=vec4(clamp(v,-900.,900.),0,1);}`,
    show: `uniform sampler2D X;uniform vec3 C1,C2,C3;uniform int MODE;void main(){vec3 d=texture(X,uv).rgb;float a=clamp(d.r,0.,1.);float b=clamp(d.g,0.,1.);vec3 c=mix(C1,C2,clamp(b/(a+.001),0.,1.));if(MODE==2){c=mix(C3,mix(C1,C2,a),a);}float al=1.-exp(-a*1.6);o=vec4(c*al,al);}`,
  };
  function fluid(host, o = {}) {
    const cv = makeCanvas(host, 'fl', 'left:0;top:0;width:100%;height:100%;z-index:1');
    const h = base('fluid', FLUIDS, host, o, cv); let S = null, tPrev = 0, burstQ = [];
    const fbo = (w, hh) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, hh, 0, gl.RGBA, gl.HALF_FLOAT, null); for (const [p, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, p, v);
      const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return { t, f, w, h: hh }; };
    const dbl = (w, hh) => { let a = fbo(w, hh), b = fbo(w, hh); return { get r() { return a; }, get w() { return b; }, swap() { const x = a; a = b; b = x; } }; };
    const fp = (key, src, extra) => { if (progs.has('f:' + key)) return progs.get('f:' + key);
      const sh = (type, s) => { const x = gl.createShader(type); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) { console.warn('fluid', key, gl.getShaderInfoLog(x)); return null; } return x; };
      const fsrc = `#version 300 es\nprecision highp float;\nin vec2 uv;out vec4 o;\n${src}`; const p = gl.createProgram(), v = sh(gl.VERTEX_SHADER, VS), f = sh(gl.FRAGMENT_SHADER, fsrc); if (!v || !f) return null;
      gl.attachShader(p, v); gl.attachShader(p, f); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p); const u = {}; for (const n of extra) u[n] = gl.getUniformLocation(p, n); const R2 = { p, u }; progs.set('f:' + key, R2); return R2; };
    function setup() {
      if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) throw new Error('no float targets');
      const w = light() ? 128 : 192, hh = Math.round(w * 9 / 16), dw = light() ? 384 : 640, dh = Math.round(dw * 9 / 16);
      S = { vel: dbl(w, hh), prs: dbl(w, hh), div: fbo(w, hh), crl: fbo(w, hh), dye: dbl(dw, dh), w, h: hh, dw, dh,
        P: { adv: fp('adv', FL.adv, ['U', 'X', 'TX', 'DT', 'DIS']), div: fp('div', FL.div, ['U', 'TX']), prs: fp('prs', FL.prs, ['Pr', 'D', 'TX']), grd: fp('grd', FL.grd, ['Pr', 'U', 'TX']), spl: fp('spl', FL.spl, ['X', 'PT', 'V', 'RAD', 'ASP']), curl: fp('curl', FL.curl, ['U', 'TX']), vort: fp('vort', FL.vort, ['U', 'C', 'X', 'TX', 'DT', 'CU', 'BU']), show: fp('show', FL.show, ['X', 'C1', 'C2', 'C3', 'MODE']) } };
    }
    const pass = (P, target, set) => { gl.useProgram(P.p); set(P.u); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      if (target) { gl.bindFramebuffer(gl.FRAMEBUFFER, target.f); gl.viewport(0, 0, target.w, target.h); } gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
    const tx = (u, name, unit, t) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(u[name], unit); };
    function splat(x, y, dx, dy, col, rad) {
      const P = S.P.spl; pass(P, S.vel.w, u => { tx(u, 'X', 0, S.vel.r.t); gl.uniform2f(u.PT, x, y); gl.uniform3f(u.V, dx, dy, 0); gl.uniform1f(u.RAD, rad); gl.uniform1f(u.ASP, 16 / 9); }); S.vel.swap();
      pass(P, S.dye.w, u => { tx(u, 'X', 0, S.dye.r.t); gl.uniform2f(u.PT, x, y); gl.uniform3f(u.V, col[0], col[1], 0); gl.uniform1f(u.RAD, rad); gl.uniform1f(u.ASP, 16 / 9); }); S.dye.swap();
    }
    h.burst = (x = .5, y = .3, power = 1) => burstQ.push([x, y, power]);
    h.frame = t => {
      if (S && S.gen !== gen) S = null;           // the context was lost and made again
      if (!S) { try { setup(); S.gen = gen; } catch (e) { h.dead = true; return; } }
      const dt = Math.min(.033, tPrev ? t - tPrev : .016) * (h.o.speed ?? 1); tPrev = t; const kind = h.k, A0 = h.o.amt ?? 1;
      // the emitters: smoke and fire from the bottom, ink from the sides — always a little, more on a burst
      const n = kind === 'ink' ? 2 : 3;
      for (let i = 0; i < n; i++) {
        const ph = t * .6 + i * 2.1 + h.seed, x = kind === 'ink' ? (i % 2 ? .93 : .07) : .15 + .7 * (.5 + .5 * Math.sin(ph * .7 + i)), y = kind === 'ink' ? .35 + .3 * Math.sin(ph * .5 + i) : .1;
        const dx = kind === 'ink' ? (i % 2 ? -1 : 1) * 4 : Math.sin(ph * 1.3) * 1.5, dy = kind === 'ink' ? Math.sin(ph) * 2 : 3 + 1.5 * Math.sin(ph * 2.1);
        splat(x, y, dx * A0, dy * A0, [(kind === 'fire' ? .35 : .22) * A0, .1 + .1 * Math.sin(ph), 0], kind === 'fire' ? .0012 : .002);
      }
      for (const [bx, by, pw] of burstQ.splice(0)) for (let i = 0; i < 6; i++) { const a = .3 + Math.random() * 2.5, r = Math.random() * .04; splat(bx + Math.cos(a) * r, by + Math.sin(a) * r, Math.cos(a) * (120 + Math.random() * 160) * pw, Math.sin(a) * (120 + Math.random() * 160) * pw, [.7 * pw, .3 + Math.random() * .5, 0], .0015 + Math.random() * .002); }
      const TX = [1 / S.w, 1 / S.h];
      // swirls (vorticity confinement) and smoke / fire rising on its own heat
      pass(S.P.curl, S.crl, u => { tx(u, 'U', 0, S.vel.r.t); gl.uniform2fv(u.TX, TX); });
      pass(S.P.vort, S.vel.w, u => { tx(u, 'U', 0, S.vel.r.t); tx(u, 'C', 1, S.crl.t); tx(u, 'X', 2, S.dye.r.t); gl.uniform2fv(u.TX, TX); gl.uniform1f(u.DT, dt); gl.uniform1f(u.CU, kind === 'ink' ? 22 : 30); gl.uniform1f(u.BU, kind === 'ink' ? 0 : kind === 'fire' ? 160 : 70); }); S.vel.swap();
      pass(S.P.adv, S.vel.w, u => { tx(u, 'U', 0, S.vel.r.t); tx(u, 'X', 1, S.vel.r.t); gl.uniform2fv(u.TX, TX); gl.uniform1f(u.DT, dt); gl.uniform1f(u.DIS, .975); }); S.vel.swap();
      pass(S.P.adv, S.dye.w, u => { tx(u, 'U', 0, S.vel.r.t); tx(u, 'X', 1, S.dye.r.t); gl.uniform2fv(u.TX, TX); gl.uniform1f(u.DT, dt); gl.uniform1f(u.DIS, kind === 'ink' ? .994 : kind === 'fire' ? .955 : .978); }); S.dye.swap();
      pass(S.P.div, S.div, u => { tx(u, 'U', 0, S.vel.r.t); gl.uniform2fv(u.TX, TX); });
      for (let i = 0; i < (light() ? 12 : 20); i++) { pass(S.P.prs, S.prs.w, u => { tx(u, 'Pr', 0, S.prs.r.t); tx(u, 'D', 1, S.div.t); gl.uniform2fv(u.TX, TX); }); S.prs.swap(); }
      pass(S.P.grd, S.vel.w, u => { tx(u, 'Pr', 0, S.prs.r.t); tx(u, 'U', 1, S.vel.r.t); gl.uniform2fv(u.TX, TX); }); S.vel.swap();
      // draw the dye in the piece's colours
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); const [w, hh] = sizeTo(cv, 960, 540); target(w, hh);
      gl.viewport(0, 0, w, hh); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); const C = mergeColors(FLUIDS, kind, h.o).colors;
      pass(S.P.show, null, u => { tx(u, 'X', 0, S.dye.r.t); gl.uniform3fv(u.C1, hex(C[0])); gl.uniform3fv(u.C2, hex(C[1])); gl.uniform3fv(u.C3, hex(C[2])); gl.uniform1i(u.MODE, kind === 'fire' ? 2 : 1); });
      present(cv, w, hh);
    };
    h.extra = () => { if (S && gl && S.gen === gen) { for (const x of [S.vel.r, S.vel.w, S.prs.r, S.prs.w, S.div, S.crl, S.dye.r, S.dye.w]) { gl.deleteTexture(x.t); gl.deleteFramebuffer(x.f); } } };
    h.aside = on => { cv.style.visibility = on ? 'hidden' : ''; };
    return h;
  }

  // ===================================================================================== the film look (CSS layers + a grain tile)
  let grainUrl = '';
  function grainTile() {
    if (grainUrl) return grainUrl; const c = document.createElement('canvas'); c.width = c.height = 160; const g = c.getContext('2d'), d = g.createImageData(160, 160);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0); return (grainUrl = c.toDataURL('image/png'));
  }
  const POST_CSS = `
.bfx3-post{position:absolute;inset:0;pointer-events:none;z-index:9}
.bfx3-post>i{position:absolute;inset:0;display:block}
.bfx3-post .gr{background-size:160px 160px;mix-blend-mode:overlay;animation:bfx3-gr .5s steps(5) infinite;will-change:transform;inset:-20px}
@keyframes bfx3-gr{0%{transform:translate(0,0)}20%{transform:translate(-11px,7px)}40%{transform:translate(9px,-13px)}60%{transform:translate(-5px,-6px)}80%{transform:translate(13px,10px)}}
.bfx3-post .sc{background:repeating-linear-gradient(180deg,rgba(0,0,0,.55) 0 1px,transparent 1px 3px);mix-blend-mode:multiply}
.bfx3-post .lk{background:radial-gradient(ellipse 45% 60% at 0% 20%,rgba(255,170,80,.55),transparent 70%),radial-gradient(ellipse 35% 50% at 100% 80%,rgba(255,80,60,.35),transparent 70%);mix-blend-mode:screen;animation:bfx3-lk 9s ease-in-out infinite alternate;will-change:opacity,transform}
@keyframes bfx3-lk{0%{opacity:.4;transform:translateX(-3%)}100%{opacity:1;transform:translateX(3%)}}
.bfx3-post .fl{background:#fff;mix-blend-mode:overlay;animation:bfx3-fl 2.6s steps(13) infinite;opacity:0}
@keyframes bfx3-fl{0%,100%{opacity:0}8%{opacity:.07}9%{opacity:0}46%{opacity:.04}47%{opacity:0}71%{opacity:.09}72%{opacity:0}}
.bfx3-post .bt,.bfx3-post .bb{left:0;right:0;background:#000}.bfx3-post .bt{top:0;bottom:auto}.bfx3-post .bb{bottom:0;top:auto}
.sb-potato .bfx3-post *,.sb-ultra .bfx3-post *{animation:none!important}`;
  let postCss = false;
  /** the film look on a screen: o = { grade, grain, vignette, scan, ca, bars, leak, flicker } (0–1) */
  function post(scene, o = {}) {
    if (!postCss) { postCss = true; const s = document.createElement('style'); s.textContent = POST_CSS; document.head.appendChild(s); }
    const box = document.createElement('div'); box.className = 'bfx3 bfx3-post'; scene.appendChild(box); let svgId = '';
    const apply = () => {
      const g = GRADES[o.grade] || GRADES.none, ultra = off(), lt = light();
      box.innerHTML = '';
      if (g.f) { const gd = document.createElement('i'); gd.style.cssText = `backdrop-filter:${g.f};-webkit-backdrop-filter:${g.f}`; box.appendChild(gd); }
      if (g.tint) { const t = document.createElement('i'); t.style.cssText = `background:${g.tint};mix-blend-mode:${g.blend || 'normal'}`; box.appendChild(t); }
      if (o.leak > 0 && !ultra) { const x = document.createElement('i'); x.className = 'lk'; x.style.opacity = o.leak; box.appendChild(x); }
      if (o.scan > 0) { const x = document.createElement('i'); x.className = 'sc'; x.style.opacity = o.scan * .6; box.appendChild(x); }
      if (o.vignette > 0) { const x = document.createElement('i'); x.style.background = `radial-gradient(ellipse 75% 70% at 50% 50%,transparent 45%,rgba(0,0,0,${(o.vignette * .85).toFixed(2)}) 100%)`; box.appendChild(x); }
      if (o.grain > 0 && !lt) { const x = document.createElement('i'); x.className = 'gr'; x.style.backgroundImage = `url(${grainTile()})`; x.style.opacity = (o.grain * .35).toFixed(2); box.appendChild(x); }
      if (o.flicker > 0 && !ultra) { const x = document.createElement('i'); x.className = 'fl'; x.style.filter = `opacity(${o.flicker})`; box.appendChild(x); }
      if (o.bars > 0) { const hgt = Math.round((o.bars || 0) * 100 * .6); for (const c of ['bt', 'bb']) { const x = document.createElement('i'); x.className = c; x.style.height = hgt + '%'; x.style.maxHeight = '14%'; box.appendChild(x); } }
      // the colour fringe: the screen's red and blue pulled apart (an SVG filter on the screen; not on Light / Ultra-light)
      if (svgId) { const old = document.getElementById(svgId); if (old) old.remove(); scene.style.filter = ''; svgId = ''; }
      if (o.ca > 0 && !lt && !ultra) { svgId = 'bfx3ca' + Math.random().toString(36).slice(2, 7); const d = Math.max(1, Math.round(o.ca * 5));
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.id = svgId; svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.style.position = 'absolute';
        svg.innerHTML = `<filter id="${svgId}f" x="0" y="0" width="100%" height="100%"><feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r"/><feOffset in="r" dx="${d}" result="r2"/><feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="g"/><feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="b"/><feOffset in="b" dx="${-d}" result="b2"/><feBlend in="r2" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b2" mode="screen"/></filter>`;
        document.body.appendChild(svg); scene.style.filter = `url(#${svgId}f)`; }
    };
    apply();
    return { kind: 'post', set(n) { Object.assign(o, n || {}); apply(); }, destroy() { box.remove(); if (svgId) { const old = document.getElementById(svgId); if (old) old.remove(); scene.style.filter = ''; } } };
  }

  const stats = (all) => ({ on: !off() && !!ctx(), live: live.size, light: light(), progs: progs.size, frames, level: WD.level, why: WD.why, bm: BM, asleep, ...(all ? { list: [...live].map(h => ({ kind: h.kind, k: h.k, dead: h.dead, shown: visible(h.cv), drawn: h.drawn || 0 })) } : {}) });
  window.BeeboFX3 = { _wd: WD, _live: live, material, text, mask, backdrop, fluid, post, stats, MATERIALS, LETTERS, BACKDROPS, FLUIDS, GRADES, COMPOSER, get available() { return !off() && !!ctx(); } };
})();
