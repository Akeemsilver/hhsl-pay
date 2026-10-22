import json
from PIL import Image, ImageDraw, ImageFont
B="/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"; RED=(220,38,38)
boxes=json.load(open("shots2/boxes.json"))
def make(name, crop, notes, out):
    im=Image.open(f"shots2/{name}.png").convert("RGB"); d=ImageDraw.Draw(im); f=ImageFont.truetype(B,32)
    for key,text,where in notes:
        x,y,w,h=boxes[name][key]; pad=10
        d.rounded_rectangle((x-pad,y-pad,x+w+pad,y+h+pad),22,outline=RED,width=7)
        tw=d.textlength(text,font=f); bw,bh=tw+44,64
        bx=min(max(x+w/2-bw/2,16),im.width-bw-16)
        by=y+h+pad+26 if where=="below" else y-pad-26-bh
        d.polygon([(x+w/2-14,by-0 if where=="below" else by+bh),(x+w/2+14,by if where=="below" else by+bh),(x+w/2,by-20 if where=="below" else by+bh+20)],fill=RED) if False else None
        # arrow tip toward the ring
        cx=min(max(x+w/2,bx+30),bx+bw-30)
        if where=="below": d.polygon([(cx-14,by),(cx+14,by),(cx,by-22)],fill=RED)
        else: d.polygon([(cx-14,by+bh),(cx+14,by+bh),(cx,by+bh+22)],fill=RED)
        d.rounded_rectangle((bx,by,bx+bw,by+bh),20,fill=RED)
        d.text((bx+bw/2,by+bh/2),text,font=f,fill=(255,255,255),anchor="mm")
    ys=[boxes[name][k][1] for k,_,_ in notes]; ye=[boxes[name][k][1]+boxes[name][k][3] for k,_,_ in notes]
    top=max(0,int(min(ys)-crop[0])); bot=min(im.height,int(max(ye)+crop[1]))
    im.crop((0,top,im.width,bot)).save(f"shots2/{out}.png")
make("welcome",(170,170),[("name","1  Type your name","above"),("cont","2  Tap Continue","below")],"a-welcome")
make("kit",(300,120),[("choose","Tap here, then pick the file","above")],"a-kit")
make("home",(40,330),[("gear","Settings","below"),("dl","Time sheet and payslips","below")],"a-home")
make("settings-backup",(170,170),[("row","Tap Backup & restore","above")],"a-settings")
make("settings-share",(150,170),[("link","1  Send the app link","above"),("kit","2  Send the starter kit","above"),("guide","3  Send this guide","below")],"a-share")
make("backup-import",(300,160),[("choose","Tap here, then pick your .xlsx file","above")],"a-import")
make("calendar",(330,420),[("day","Tap the date","below")],"a-calendar")
make("day",(330,160),[("add","Tap Add job","above")],"a-day")
