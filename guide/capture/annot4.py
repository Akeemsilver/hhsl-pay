import json
from PIL import Image, ImageDraw, ImageFont
B="/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"; RED=(220,38,38)
boxes=json.load(open("shots4/boxes.json"))
def make(name, notes, out, up=260, down=200):
    im=Image.open(f"shots4/{name}.png").convert("RGB"); d=ImageDraw.Draw(im); f=ImageFont.truetype(B,32)
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
    top=max(0,int(min(ys)-up)); bot=min(im.height,int(max(ye)+down))
    im.crop((0,top,im.width,bot)).save(f"shots4/{out}.png")
make("hub",[("sites","Site locations & rates","above")],"c-hub",up=200,down=240)
make("add-site",[("name","1  Site name","above"),("group","2  Which payslip","above"),("rate","3  Rate for a new group","below")],"c-add",up=140,down=200)
make("add-btn",[("add","Tap Add site","above")],"c-addbtn",up=300,down=120)
make("rate",[("std","Standard rate","above"),("lead","Team lead rate","below")],"c-rate",up=240,down=240)
make("effect",[("from","Pick the date it starts","above"),("save","Tap Save","below")],"c-effect",up=300,down=140)
make("roles",[("input","Type a role","above"),("add","Tap Add role","below")],"c-roles",up=300,down=160)
make("hours",[("tpl","Pick the hours pattern","above")],"c-hours",up=240,down=520)
for n in ["c-hub","c-add","c-rate","c-effect","c-roles","c-hours"]: print(n,Image.open(f"shots4/{n}.png").size)
