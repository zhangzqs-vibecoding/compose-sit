"""Regenerate the finite UI glyph atlas with Debian's Apache-2.0 Droid font."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json
chars='合成上应大校园拖动选择位置松手投放相同徽章碰撞升级最终目标达成学校当前得分最高纪录下一颗暂停继续游戏重新开始声音开启关闭本局结束再来一次恭喜获得点击任意处加载中失败请重试浏览器不支持图形加速还差一步危险区域超线秒将结束第级已解锁北京大学清华中国科学院人民复旦上海交通浙江科学技术同济应用理工按左右方向键调整空格释放静音返回中文'
chars += ''.join(p.read_text() for root in ['packages','apps'] for p in Path(root).rglob('*.ts'))
chars=''.join(c for c in dict.fromkeys(chars+''.join(chr(i) for i in range(32,127))) if c.isprintable())
font=ImageFont.truetype('/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf',64)
latin=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',64)
size=80;cols=16
im=Image.new('RGBA',(cols*size,((len(chars)+cols-1)//cols)*size));d=ImageDraw.Draw(im);glyphs={}
for i,c in enumerate(chars):
 x=(i%cols)*size;y=(i//cols)*size
 selected=latin if ord(c)<128 else font
 d.text((x+4,y+2),c,font=selected,fill='white',stroke_width=0)
 glyphs[c]={'x':x,'y':y,'w':size,'h':size,'advance':float(selected.getlength(c))}
im.save('assets/font/ui.png');Path('assets/font/glyphs.json').write_text(json.dumps(glyphs,ensure_ascii=False))
