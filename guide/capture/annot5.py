import json
from PIL import Image, ImageDraw, ImageFont
B="/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"; RED=(220,38,38)
boxes=json.load(open("shots5/boxes.json"))
im=Image.open("shots5/download.png").convert("RGB"); d=ImageDraw.Draw(im); f=ImageFont.truetype(B,32)
x,y,w,h=boxes["send"]; pad=10
d.rounded_rectangle((x-pad,y-pad,x+w+pad,y+h+pad),22,outline=RED,width=7)
text="Tap Send to payroll"; tw=d.textlength(text,font=f); bw,bh=tw+44,64
bx=min(max(x+w/2-bw/2,16),im.width-bw-16); by=y-pad-26-bh; cx=x+w/2
d.polygon([(cx-14,by+bh),(cx+14,by+bh),(cx,by+bh+22)],fill=RED)
d.rounded_rectangle((bx,by,bx+bw,by+bh),20,fill=RED); d.text((bx+bw/2,by+bh/2),text,font=f,fill=(255,255,255),anchor="mm")
im.crop((0,max(0,int(y-540)),im.width,min(im.height,int(y+h+340)))).save("shots5/b-download.png"); print(Image.open("shots5/b-download.png").size)
