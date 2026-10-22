import json
from PIL import Image, ImageDraw, ImageFont
B="/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"; RED=(220,38,38)
boxes=json.load(open("shots3/boxes.json"))
def make(name, notes, crop, out):
    im=Image.open(f"shots3/{name}.png").convert("RGB"); d=ImageDraw.Draw(im); f=ImageFont.truetype(B,32)
    for key,text,where in notes:
        x,y,w,h=boxes[name][key]; pad=10
        d.rounded_rectangle((x-pad,y-pad,x+w+pad,y+h+pad),22,outline=RED,width=7)
        tw=d.textlength(text,font=f); bw,bh=tw+44,64
        bx=min(max(x+w/2-bw/2,16),im.width-bw-16)
        by=y+h+pad+26 if where=="below" else y-pad-26-bh
        cx=min(max(x+w/2,bx+30),bx+bw-30)
        if where=="below": d.polygon([(cx-14,by),(cx+14,by),(cx,by-22)],fill=RED)
        else: d.polygon([(cx-14,by+bh),(cx+14,by+bh),(cx,by+bh+22)],fill=RED)
        d.rounded_rectangle((bx,by,bx+bw,by+bh),20,fill=RED); d.text((bx+bw/2,by+bh/2),text,font=f,fill=(255,255,255),anchor="mm")
    im.crop((0,crop[0],im.width,crop[1])).save(f"shots3/{out}.png")
bx=boxes
make("share-ask",[("yes","Tap Yes","below")],(300,bx["share-ask"]["yes"][1]+330),"b-share-ask")
make("share-after",[("msg","Done: saved and shared","below")],(780,1600),"b-share-after")
make("site-settings",[("colours","Pick a colour for the site","above"),("lunch","Lunch check: Yes or No","below")],(int(bx["site-settings"]["colours"][1])-230,int(bx["site-settings"]["lunch"][1]+bx["site-settings"]["lunch"][3])+260),"b-site")
make("ts-jobs",[("summary","What goes on your time sheet","below")],(40,980),"b-tsjobs")
make("time-picker",[],(330,1560),"b-time")
for n in ["b-share-ask","b-share-after","b-site","b-tsjobs","b-time"]: print(n,Image.open(f"shots3/{n}.png").size)
