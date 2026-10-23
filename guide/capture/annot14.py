import json
from PIL import Image, ImageDraw, ImageFont
B="/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"; RED=(220,38,38)
boxes=json.load(open("shots14/boxes.json"))
def make(name, notes, out, up, down):
    im=Image.open(f"shots14/{name}.png").convert("RGB"); d=ImageDraw.Draw(im); f=ImageFont.truetype(B,32)
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
    im.crop((0,max(0,int(min(ys)-up)),im.width,min(im.height,int(max(ye)+down)))).save(f"shots14/{out}.png")
make("other",[("tick","Tick: all other jobs","below")],"f-other",up=330,down=420)
print(Image.open("shots14/f-other.png").size)
