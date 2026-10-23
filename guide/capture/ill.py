from PIL import Image, ImageDraw, ImageFont
R="/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"; B="/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
def F(s,b=False): return ImageFont.truetype(B if b else R, s)
TEAL=(15,118,110); RED=(220,38,38); INK=(30,41,59); GREY=(100,116,139); BG=(243,246,248); WHITE=(255,255,255); LINE=(218,224,230)
W=640
def canvas(h,bg=BG):
    im=Image.new("RGB",(W,h),bg); return im,ImageDraw.Draw(im)
def rr(d,box,fill,r=18,outline=None,width=2): d.rounded_rectangle(box,r,fill=fill,outline=outline,width=width)
def ring(d,box,pad=8):
    x0,y0,x1,y1=box; d.rounded_rectangle((x0-pad,y0-pad,x1+pad,y1+pad),16,outline=RED,width=5)
def label(d,xy,t,size=26,b=False,fill=INK,anchor="la"): d.text(xy,t,font=F(size,b),fill=fill,anchor=anchor)
def dots(d,cx,cy,col=INK):
    for i in (-14,0,14): d.ellipse((cx-4,cy+i-4,cx+4,cy+i+4),fill=col)
def save(im,n): im.save(f"ill/{n}.png")

# 1 Chrome: address bar with three dots, menu with Install app
im,d=canvas(470)
rr(d,(20,20,620,92),WHITE); rr(d,(36,32,520,80),(235,240,244),24)
label(d,(56,40),"akeemsilver.github.io/hhsl-pay/",24,fill=GREY)
dots(d,575,56); ring(d,(555,28,597,84),4)
label(d,(20,108),"Tap the three dots",24,True,RED)
rr(d,(300,150,620,450),WHITE,14,outline=LINE)
for i,t in enumerate(["New tab","New Incognito tab","Install app","Share…"]):
    y=168+i*70
    if t=="Install app": rr(d,(310,y-6,610,y+52),(222,243,240),10); ring(d,(310,y-6,610,y+52),2)
    label(d,(332,y+6),t,28,t=="Install app",TEAL if t=="Install app" else INK)
save(im,"chrome-menu")

# 2 Install dialog
im,d=canvas(300)
rr(d,(60,30,580,270),WHITE,24,outline=LINE)
label(d,(92,56),"Install app?",32,True)
label(d,(92,106),"HHSL pay  ·  akeemsilver.github.io",24,fill=GREY)
rr(d,(92,176,290,246),WHITE,16,outline=LINE); label(d,(191,211),"Cancel",26,anchor="mm",fill=TEAL)
rr(d,(318,176,540,246),TEAL,16); label(d,(429,211),"Install",28,True,WHITE,"mm"); ring(d,(318,176,540,246),4)
save(im,"chrome-install")

# 3 Safari share bar
def shareicon(d,cx,cy,col):
    d.line((cx,cy-4,cx,cy-34),fill=col,width=5); d.polygon([(cx,cy-44),(cx-12,cy-30),(cx+12,cy-30)],fill=col)
    d.rounded_rectangle((cx-22,cy-14,cx+22,cy+30),6,outline=col,width=5); d.rectangle((cx-14,cy-18,cx+14,cy-8),fill=BG)
    d.line((cx,cy-4,cx,cy-34),fill=col,width=5)
im,d=canvas(240)
rr(d,(20,20,620,100),WHITE); label(d,(320,60),"akeemsilver.github.io",26,fill=GREY,anchor="mm")
d.rectangle((0,150,W,240),fill=WHITE); d.line((0,150,W,150),fill=LINE,width=2)
d.polygon([(76,195),(100,176),(100,214)],fill=GREY)  # back
d.polygon([(254,195),(230,176),(230,214)],fill=GREY)  # forward
shareicon(d,380,198,TEAL); ring(d,(342,148,418,232),2)
for x in (500,570): d.rounded_rectangle((x-20,178,x+20,218),6,outline=GREY,width=4)
label(d,(380,118),"Tap Share",24,True,RED,"mm")
save(im,"safari-share")

# 4 Share sheet: Add to Home Screen
im,d=canvas(400)
rr(d,(30,20,610,380),WHITE,26,outline=LINE)
rows=["Copy","Add to Bookmarks","Add to Home Screen","Find on Page"]
for i,t in enumerate(rows):
    y=44+i*80
    if t.startswith("Add to Home"): rr(d,(44,y-6,596,y+58),(222,243,240),12); ring(d,(44,y-6,596,y+58),2)
    label(d,(70,y+8),t,30,t.startswith("Add to Home"),TEAL if t.startswith("Add to Home") else INK)
    d.rounded_rectangle((540,y+8,580,y+48),8,outline=GREY,width=3)
save(im,"safari-add")

# 5 WhatsApp file bubble
im,d=canvas(300,(222,216,205))
rr(d,(70,30,600,270),(220,248,198),22)
rr(d,(94,54,576,160),(200,232,178),14)
d.rounded_rectangle((110,70,170,142),8,fill=(255,255,255)); label(d,(140,106),"PDF",20,True,RED,"mm")
label(d,(190,78),"HHSL-starter-kit-rates.pdf",24,True)
label(d,(190,114),"1 page · 70 kB · PDF",22,fill=GREY)
d.ellipse((508,76,564,132),outline=GREY,width=3); d.line((536,86,536,116),fill=GREY,width=4); d.polygon([(536,124),(524,110),(548,110)],fill=GREY)
ring(d,(500,70,572,138),2)
label(d,(94,190),"Tap the file to download it.",26,True,RED)
label(d,(94,226),"iPhone: tap it, then Share, then Save to Files.",22,fill=GREY)
save(im,"whatsapp")

# 7 Sheets phone: dots > Share & export > Save as > Excel
im,d=canvas(460)
rr(d,(20,16,620,76),WHITE); label(d,(44,32),"My salary sheet",26,True); dots(d,580,46); ring(d,(560,18,602,76),2)
rr(d,(250,92,620,230),WHITE,12,outline=LINE)
for i,t in enumerate(["Find and replace","Share & export","Print"]):
    y=104+i*40
    if i==1: rr(d,(256,y-4,614,y+34),(222,243,240),8)
    label(d,(274,y+2),t,22,i==1,TEAL if i==1 else INK)
rr(d,(20,240,330,420),WHITE,12,outline=LINE)
for i,t in enumerate(["Send a copy","Save as","Export"]):
    y=254+i*50
    if i==1: rr(d,(26,y-4,324,y+38),(222,243,240),8); ring(d,(26,y-4,324,y+38),2)
    label(d,(44,y+4),t,24,i==1,TEAL if i==1 else INK)
rr(d,(340,300,620,440),WHITE,12,outline=LINE)
for i,t in enumerate(["Microsoft Excel (.xlsx)","PDF (.pdf)"]):
    y=316+i*56
    if i==0: rr(d,(346,y-6,614,y+40),(222,243,240),8); ring(d,(346,y-6,614,y+40),2)
    label(d,(358,y+4),t,21,i==0,TEAL if i==0 else INK)
save(im,"sheets-phone")

# 8 Android file picker hint
im,d=canvas(300)
rr(d,(40,20,600,280),WHITE,22,outline=LINE)
label(d,(70,44),"Recent files",26,True)
for i,t in enumerate(["HHSL-starter-kit-rates.pdf","photo_2026.jpg","statement.pdf"]):
    y=96+i*58
    if i==0: rr(d,(54,y-6,586,y+44),(222,243,240),10); ring(d,(54,y-6,586,y+44),2)
    d.rounded_rectangle((70,y+2,102,y+36),6,outline=GREY,width=3)
    label(d,(118,y+6),t,24,i==0,TEAL if i==0 else INK)
save(im,"picker")

# 9 import preview mock
im,d=canvas(808)
rr(d,(16,12,624,796),WHITE,20,outline=LINE)
label(d,(40,32),"Example Name · 2026 · 180 days",25,True)
for i,(m,n) in enumerate([("January","20 days"),("February","18 days")]):
    y=76+i*32; label(d,(40,y),m,22,fill=GREY); label(d,(600,y),n,22,fill=GREY,anchor="ra")
label(d,(40,150),"“Atlantic LNG” is",24)
rr(d,(40,184,600,232),WHITE,12,outline=LINE); label(d,(56,196),"Atlantic",24); label(d,(580,196),"v",22,fill=GREY,anchor="ra")
ring(d,(40,184,600,232),4); label(d,(600,246),"Pick the site each name is",22,True,RED,"ra")
rr(d,(40,284,600,364),(232,242,240),12)
for i,(n,t) in enumerate([("13","new"),("2","the same"),("1","changed"),("23","only in app")]):
    cx=40+70+i*140; label(d,(cx,296),n,28,True,anchor="ma"); label(d,(cx,336),t,18,fill=GREY,anchor="ma")
ring(d,(40,284,600,364),3); label(d,(600,372),"What will change",22,True,RED,"ra")
opts=[("Update (chosen)","Adds new days, fixes changed ones. Days only in the app stay.",True),("Add only","Adds new days only. Nothing already logged changes.",False),("Replace","Clears these months, then adds the file's days.",False)]
for i,(t,x,on) in enumerate(opts):
    y=412+i*88
    rr(d,(40,y,600,y+76),(232,242,240) if on else WHITE,12,outline=TEAL if on else LINE)
    label(d,(56,y+8),t,23,True,TEAL if on else INK); label(d,(56,y+42),x,18,fill=GREY)
ring(d,(40,412,600,676),3); label(d,(600,684),"Three ways to import",22,True,RED,"ra")
rr(d,(40,728,300,784),WHITE,14,outline=LINE); label(d,(170,756),"Cancel",23,anchor="mm")
rr(d,(320,728,600,784),TEAL,14); label(d,(460,756),"Import (13 new, 1 updated)",19,True,WHITE,"mm")
save(im,"import-preview")
