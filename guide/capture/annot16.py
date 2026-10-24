import json
from PIL import Image, ImageDraw, ImageFont
B="/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"; RED=(220,38,38)
boxes=json.load(open("shots16/boxes.json"))["source"]
im=Image.open("shots16/source.png").convert("RGB"); d=ImageDraw.Draw(im); f=ImageFont.truetype(B,30)
x,y,w,h=boxes["drive"]; pad=8
d.rounded_rectangle((x-pad,y-pad,x+w+pad,y+h+pad),22,outline=RED,width=7)
top=boxes["phone"][1]-260; bottom=boxes["share"][1]+boxes["share"][3]+40
im.crop((0,max(0,int(top)),im.width,min(im.height,int(bottom)))).save("shots16/a-source.png"); print(Image.open("shots16/a-source.png").size)
