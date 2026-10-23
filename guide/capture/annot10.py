import json
from PIL import Image, ImageDraw, ImageFont
B="/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"; RED=(220,38,38)
boxes=json.load(open("shots10/boxes.json"))
def make(name, notes, out, up, down):
    im=Image.open(f"shots10/{name}.png").convert("RGB"); d=ImageDraw.Draw(im); f=ImageFont.truetype(B,32)
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
    ys=[boxes[name][k][1] for k,_,_ in notes]; ye=[boxes[name][k][1]+boxes[name][k][3] for k,_,_ in notes]
    im.crop((0,max(0,int(min(ys)-up)),im.width,min(im.height,int(max(ye)+down)))).save(f"shots10/{out}.png")
make("day-panel",[("add","Tap Add job","above")],"e-daypanel",up=700,down=120)
make("picker",[("search","Search for the site, or pick it","below")],"e-picker",up=100,down=800)
make("loc",[("loc","Type the location","above"),("lead","Team lead","below")],"e-loc",up=200,down=240)
make("hours",[("tile","Hours paid come from the times","above"),("start","Start and end time","below")],"e-hours",up=220,down=250)
make("pay",[("pay","The pay for the day","above"),("another","Add another job","below"),("save","Save","below")],"e-pay",up=250,down=170)
make("saved",[("edit","Edit","above"),("del","Delete","above")],"e-saved",up=420,down=200)
for n in ["e-daypanel","e-picker","e-loc","e-hours","e-pay","e-saved"]: print(n,Image.open(f"shots10/{n}.png").size)
