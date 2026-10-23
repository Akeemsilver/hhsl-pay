from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle, PageBreak, Flowable, Image as RLImage, NextPageTemplate, KeepTogether
from PIL import Image as PI

TEAL = colors.HexColor("#0f766e"); DARK = colors.HexColor("#14302d"); GREY = colors.HexColor("#5b6b69")
SOFT = colors.HexColor("#e7f3f1"); WARN = colors.HexColor("#fff4e0"); WARNB = colors.HexColor("#e0a030"); LINEC = colors.HexColor("#d5dde0")
import argparse, os, datetime
HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument("--out", default="HHSL-pay-app-mobile-guide.pdf")
ap.add_argument("--link", default="https://akeemsilver.github.io/hhsl-pay/")
ap.add_argument("--stamp", default=datetime.date.today().isoformat())
ARGS = ap.parse_args(); OUT = ARGS.out; LINK = ARGS.link if ARGS.link.endswith("/") else ARGS.link + "/"; STAMP = ARGS.stamp
GUIDE_FILE = "HHSL-pay-app-mobile-guide.pdf"
W, H = A4; CW = W - 40*mm
def lk(url, text=None): return f'<a href="{url}" color="#0f766e"><u>{text or url}</u></a>'
def go(anchor, text): return f'<a href="#{anchor}" color="#0f766e"><u>{text}</u></a>'

base = dict(fontName="Helvetica", textColor=DARK, leading=15, fontSize=10.5)
body = ParagraphStyle("body", **base, spaceAfter=5)
small = ParagraphStyle("small", **{**base, "fontSize": 9, "leading": 12.5, "textColor": GREY}, spaceAfter=3)
h1 = ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=17, leading=21, textColor=TEAL, spaceBefore=12, spaceAfter=6, keepWithNext=1)
h2 = ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=11.5, leading=15, textColor=DARK, spaceBefore=8, spaceAfter=3, keepWithNext=1)
step = ParagraphStyle("step", **base)
box = ParagraphStyle("box", **{**base, "fontSize": 10, "leading": 14.5}, spaceAfter=2)

class Num(Flowable):
    def __init__(self, n): super().__init__(); self.n = n; self.width = 9*mm; self.height = 8*mm
    def draw(self):
        c = self.canv; c.setFillColor(TEAL); c.circle(4*mm, 4*mm, 3.6*mm, fill=1, stroke=0)
        c.setFillColor(colors.white); c.setFont("Helvetica-Bold", 10); c.drawCentredString(4*mm, 2.7*mm, str(self.n))

def pic(path, width_mm):
    w, h = PI.open(path).size
    return RLImage(path, width=width_mm*mm, height=width_mm*mm*h/w)

IMGW = 48
def steps(items):
    """items: (text, image path or None, width mm)"""
    rows = []; ts = [("VALIGN", (0,0), (-1,-1), "TOP"), ("TOPPADDING", (0,0), (-1,-1), 3), ("BOTTOMPADDING", (0,0), (-1,-1), 6), ("LEFTPADDING", (0,0), (-1,-1), 0), ("RIGHTPADDING", (1,0), (1,-1), 8)]
    for i, it in enumerate(items):
        t, img = it[0], it[1]; wmm = it[2] if len(it) > 2 else IMGW
        cell = pic(img, wmm) if img else ""
        rows.append([Num(i+1), Paragraph(t, step), cell])
        if img: ts.append(("BOX", (2,i), (2,i), 0.6, LINEC))
        ts.append(("LINEBELOW", (0,i), (-1,i), 0.3, colors.HexColor("#eef2f3")))
    t = Table(rows, colWidths=[11*mm, CW-11*mm-(IMGW+2)*mm, (IMGW+2)*mm], hAlign="LEFT")
    t.setStyle(TableStyle(ts)); return t

def callout(title, lines, bg=SOFT, edge=TEAL):
    cells = [Paragraph(f"<b>{title}</b>", box)] + [Paragraph(l, box) for l in lines]
    t = Table([[cells]], colWidths=[CW])
    t.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,-1), bg), ("LINEBEFORE", (0,0), (0,-1), 3, edge), ("LEFTPADDING", (0,0), (-1,-1), 10), ("RIGHTPADDING", (0,0), (-1,-1), 10), ("TOPPADDING", (0,0), (-1,-1), 8), ("BOTTOMPADDING", (0,0), (-1,-1), 8)]))
    return t

def page(c, doc):
    c.saveState(); c.setFillColor(GREY); c.setFont("Helvetica", 8.5)
    c.drawString(20*mm, 12*mm, "HHSL pay app: mobile guide  ·  created by Akeem Silverton"); c.drawRightString(W-20*mm, 12*mm, f"Page {doc.page}")
    c.linkURL(LINK, (W-90*mm, 9*mm, W-40*mm, 15*mm), relative=0)
    c.restoreState()
def first(c, doc):
    c.saveState(); c.setFillColor(TEAL); c.rect(0, H-46*mm, W, 46*mm, fill=1, stroke=0)
    c.drawImage(os.path.join(HERE, "assets", "logo.png"), 20*mm, H-37*mm, 25*mm, 25*mm, mask="auto")
    c.setFillColor(colors.white); c.setFont("Helvetica-Bold", 24); c.drawString(50*mm, H-21*mm, "HHSL pay app: Mobile guide")
    c.setFont("Helvetica", 12); c.drawString(50*mm, H-29*mm, "Everything on your phone: install, load your rates, import your spreadsheet")
    c.setFont("Helvetica", 10.5); c.drawString(50*mm, H-37*mm, "Created by Akeem Silverton")
    c.restoreState(); page(c, doc)

doc = BaseDocTemplate(OUT, pagesize=A4, leftMargin=20*mm, rightMargin=20*mm, topMargin=18*mm, bottomMargin=20*mm, title="HHSL pay app: mobile guide", author="Akeem Silverton")
fr1 = Frame(20*mm, 20*mm, CW, H-20*mm-52*mm, id="f1", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
fr = Frame(20*mm, 20*mm, CW, H-38*mm, id="f", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
doc.addPageTemplates([PageTemplate(id="first", frames=[fr1], onPage=first), PageTemplate(id="rest", frames=[fr], onPage=page)])

I = lambda n: os.path.join(HERE, "assets", "ill", n + ".png")
A = lambda n: os.path.join(HERE, "assets", "shots", n + ".png")
Bs = A
PLAY = "https://play.google.com/store/apps/details?id=com.google.android.apps.docs.editors.sheets"
APPSTORE = "https://apps.apple.com/app/google-sheets/id842849113"
s = [NextPageTemplate("rest")]
s.append(Paragraph("The HHSL pay app tracks the days you work, works out your gross pay, PAYE, NIS and net pay, and makes your payslips and the HHSL time sheet. <b>Everything stays on your own phone.</b> There is no account and no sign-in. This guide is for doing every step <b>on your phone</b>.", body))
toc = Table([[Paragraph(go("p1", "<b>1. Install the app</b>"), body), Paragraph(go("p2", "<b>2. Load your starter kit</b>"), body)],
             [Paragraph(go("p3", "<b>3. Bring in your spreadsheet</b>"), body), Paragraph(go("p4", "<b>4. How to add a day</b>"), body)],
             [Paragraph(go("p5", "<b>5. How to: sites, rates, settings</b>"), body), Paragraph(go("p6", "<b>6. Set it up your way</b>"), body)],
             [Paragraph(go("p7", "<b>7. Share the app</b>"), body), ""]], colWidths=[CW/2, CW/2])
toc.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,-1), SOFT), ("LEFTPADDING", (0,0), (-1,-1), 10), ("TOPPADDING", (0,0), (-1,-1), 4), ("BOTTOMPADDING", (0,0), (-1,-1), 0)]))
s.append(Paragraph(f"Guide updated {STAMP}", small)); s.append(Paragraph("<b>Tap a part to jump to it:</b>", small)); s.append(toc); s.append(Spacer(1, 6))
s.append(callout("The app link (tap it on your phone)", [f'<font size=12><b>{lk(LINK)}</b></font>', "Open it in <b>Chrome</b> (Android) or <b>Safari</b> (iPhone). The screens of the app are real pictures. The Chrome, Safari, WhatsApp and Google Sheets pictures are drawings: your phone's menus may be arranged a little differently, but the button names are the same."]))

s.append(Spacer(1, 6))
s.append(Paragraph("Before you start", h2))
s.append(Paragraph("You need these four things. Everything else is explained step by step.", body))
s.append(steps([
 ("<b>A smartphone</b> with a web browser: <b>Chrome</b> on Android, or <b>Safari</b> on iPhone.", None),
 ("<b>WhatsApp</b> on the same phone, to receive the starter kit file.", None),
 ("The <b>starter kit file</b> and <b>this guide</b>, sent to you by the person who gave you the app.", None),
 ("Only if you already keep your days in a spreadsheet: the <b>Google Sheets app</b>.", None)]))
s.append(PageBreak())
s.append(Paragraph('<a name="p1"/>Part 1. Install the app', h1))
s.append(Paragraph("Android (Chrome)", h2))
s.append(steps([
 (f"Tap this link: {lk(LINK, 'open the app')}. It must open in <b>Chrome</b>, not inside WhatsApp, Gmail or another app, and not in a private tab. If it opens inside another app, tap the three dots there and choose <b>Open in Chrome</b>, or copy the link and paste it into Chrome.", None),
 ("Tap the <b>three dots</b> at the top right, then <b>Install app</b> (or <b>Add to Home screen</b>). The app's own <b>Install app</b> button on the Home screen does the same.", I("chrome-menu")),
 ("Tap <b>Install</b> (or <b>Add</b>, if Chrome says Add to Home screen). The app icon appears on your home screen.", I("chrome-install")),
 ("Open the app from this icon. It runs full screen like any other app.", os.path.join(HERE, "assets", "logo.png"), 24)]))
s.append(Paragraph("iPhone or iPad (Safari)", h2))
s.append(steps([
 (f"Tap this link: {lk(LINK, 'open the app')}. It must open in <b>Safari</b>. If it opens inside another app (WhatsApp, Mail), tap the compass or Share icon there and choose <b>Open in Safari</b>, or copy the link and paste it into Safari.", None),
 ("Tap the <b>Share</b> button (the square with an arrow pointing up). On an iPhone it is in the bar at the bottom of the screen (on an iPad, at the top). If you cannot see it, tap the <b>three dots</b> menu in Safari: Share is in there.", I("safari-share")),
 ("Scroll down the list and tap <b>Add to Home Screen</b> (tap <b>More</b> or scroll to the end of the list if you do not see it). Leave <b>Open as Web App</b> switched on if it is shown, then tap <b>Add</b> at the top right.", I("safari-add")),
 ("Open the app from the icon on your home screen, not from Safari.", os.path.join(HERE, "assets", "logo.png"), 24)]))
s.append(Paragraph("iPhone note: Safari can clear data for websites you have not opened in a while. Opening the app from its icon and making a backup now and then (Settings, Backup &amp; restore) keeps your days safe.", small))

s.append(Paragraph('<a name="p2"/>Part 2. Load your starter kit', h1))
s.append(Paragraph("The starter kit is a small file with the pay rates for each site, the tax rules and the time sheet form, so you do not have to type any of it in. It has <b>no days, no pay and no personal information</b>. It is sent to you as a file, and not built into the app, because the rates belong to the company and the app itself is public.", body))
s.append(Paragraph("Get the file (in WhatsApp on your phone)", h2))
s.append(steps([
 ("Ask the person who sent you this guide to send you the <b>starter kit file</b>, called <b>HHSL-starter-kit-rates.txt</b>, on WhatsApp.", None),
 ("Open the message in WhatsApp and <b>tap the file</b> to download it. A small download arrow shows until it is saved.", I("whatsapp")),
 ("<b>iPhone only:</b> after it opens, tap the Share icon, then <b>Save to Files</b>, so the app can find it.", None)]))
s.append(Paragraph("Load it into the app", h2))
s.append(steps([
 ("Open the app from its icon. Type your <b>full name</b> (it is printed on your payslips and time sheets) and tap <b>Continue</b>.", A("a-welcome"), 50),
 ("On the next screen, tap <b>Choose starter kit file</b>.", A("a-kit"), 50),
 ("Pick <b>HHSL-starter-kit-rates.txt</b> from your <b>Downloads</b> (or <b>WhatsApp, Documents</b>). On iPhone, pick it from Files.", I("picker")),
 ("That is it. Your sites and rates are in and the Home screen opens.", A("a-home"), 50)]))
s.append(Spacer(1, 3))
s.append(callout("File will not download or will not load?", [
 "Check that you have a signal, then tap the file in WhatsApp again, or ask for it to be sent again.",
 "WhatsApp does not download files by itself. Tap the file once, that is normal.",
 "The starter kit holds company pay rates. Only pass it to colleagues."], WARN, WARNB))

s.append(Paragraph('<a name="p3"/>Part 3. Bring in your spreadsheet (optional)', h1))
s.append(Paragraph(f"If you keep your days in the yearly salary spreadsheet (a tab for each month, January to December), the app can read your days from it. The app reads <b>Excel (.xlsx)</b> files, so a Google Sheet has to be saved as Excel first. You do this in the <b>Google Sheets app</b> on your phone: {lk(PLAY, 'get it on Android')} or {lk(APPSTORE, 'get it on iPhone')}.", body))
s.append(Paragraph("Step A. Save your Google Sheet as Excel (in the Google Sheets app)", h2))
s.append(steps([
 ("Open the sheet in the <b>Google Sheets app</b>. Tap the <b>three dots</b> at the top right, then <b>Share &amp; export</b>, then <b>Save as</b>, then <b>Microsoft Excel (.xlsx)</b>.", I("sheets-phone")),
 ("Choose to save it on your phone (Downloads). The file must end in <b>.xlsx</b>. A spreadsheet that is already an Excel file can skip Step A.", None)]))
s.append(Paragraph("Step B. Import it into the app", h2))
s.append(steps([
 ("In the app, tap the <b>gear</b> at the top right (Settings).", A("a-home"), 50),
 ("Scroll down and tap <b>Backup &amp; restore</b>.", A("a-settings"), 50),
 ("Under <b>Import from your yearly spreadsheet</b>, tap <b>Choose yearly spreadsheet</b> and pick your .xlsx file from Downloads.", A("a-import"), 50),
 ("A <b>preview</b> shows your name, the year and how many days were found in each month. <b>Nothing changes until you confirm.</b> For each client name in the sheet, choose which of your <b>sites</b> it is, or <b>Skip these days</b>.", I("import-preview")),
 ("Choose <b>Add</b> (keeps what you already have) or <b>Replace these months</b> (clears those months first). Then tap <b>Import</b>, and open the Calendar to see your days.", None)]))
s.append(Paragraph("Only the days, hours, team lead and holiday flags are read. The app works out pay again from your rates, so check one month against your payslip the first time.", small))

s.append(Paragraph('<a name="p4"/>Part 4. How to add a day', h1))
s.append(Paragraph("A. Add a job to a day", h2))
s.append(steps([
 ("Tap <b>Calendar</b> at the bottom of the screen, then tap the date you worked.", A("a-calendar"), 50),
 ("Under the calendar, tap <b>Add job</b>. The day form opens.", A("e-daypanel"), 50),
 ("<b>Pick the site.</b> Tap the site box at the top. Type to search, or tap the site in the list.", A("e-picker"), 50),
 ("<b>Role or location.</b> Most sites have a <b>Role</b> list (for example Client medic, or Not applicable). A site set to <b>Type in a location</b> has a box instead: type where you worked, for example Dolphin platform. It goes in the <b>Client assigned</b> column of the time sheet. Tick <b>Team lead / instructor</b> or <b>Holiday / TAR</b> if they apply.", A("e-loc"), 50),
 ("<b>Time sheet tick.</b> Under the site there is <b>Put [site] on the time sheet</b>. It applies to every day at that site, not just this day, and it is remembered from now on.", A("d-tick"), 50),
 ("<b>Hours.</b> A job on the time sheet always uses <b>start and end time</b>: tap a time, turn the AM/PM, hour and minute wheels (or type the time) and tap <b>Set</b>. The hours paid come from the times and cannot be typed. Other sites can use <b>Simple</b> (type the hours with the minus and plus buttons) or <b>Detailed</b> (start and end time).", A("b-time"), 50),
 ("Hourly sites with a lunch check ask if <b>lunch was paid</b>, or how much unpaid lunch comes off (30 minutes or 1 hour). A <b>fixed day rate</b> site has no lunch options.", A("e-hours"), 50),
 ("The line at the bottom shows the <b>pay for the day</b>. To log a second job on the same day, tap <b>Add another job</b>. Then tap <b>Save</b>. <b>Cancel</b> throws the changes away.", A("e-pay"), 50)]))
s.append(Paragraph("B. Add an other job (pickup, delivery)", h2))
s.append(steps([
 ("On the day form, tap <b>Add other job</b>. Type what it was (for example Airport pickup), or tap a quick suggestion. Start and end time and hours are optional. Add the <b>amount paid</b> once the company confirms it. Tap <b>Save</b>.", None),
 ("Other jobs show on the time sheet when <b>Other jobs</b> is ticked in Settings, Timesheet.", None)]))
s.append(Paragraph("C. Change or delete a day", h2))
s.append(steps([
 ("Tap the date on the Calendar. Each job has <b>Edit</b> and <b>Delete</b>. Edit opens the same form: change it and tap <b>Save</b>. If you close the form with unsaved changes, the app asks first.", A("e-saved"), 50)]))
s.append(Paragraph("D. See the month and send the time sheet", h2))
s.append(steps([
 ("<b>Home</b> shows the month so far: gross, net, PAYE, days and paid hours, with each payslip group underneath (days, paid hours and its tax). Every job that goes on the time sheet (the sites ticked for it, and other jobs) is counted on its own <b>Time sheet</b> line with just days and hours, and those days and hours are taken out of their group's line. Swipe the calendar left or right to change month. <b>Year</b> and <b>Charts</b> show the whole year.", None),
 ("<b>Time sheet:</b> tap the download icon at the top of any screen, choose <b>Send to payroll</b>, then <b>Download and share</b>, and pick Gmail or WhatsApp.", Bs("b-download"), 50),
 ("<b>Payslips:</b> in the same screen, switch to <b>Payslip</b>. The eye icon lets you look at them first.", None)]))
s.append(Spacer(1, 3))
s.append(callout("Back up now and then", ["Your days live only on your phone. If it is lost or its browser data is cleared, they are gone. Go to <b>Settings, Backup &amp; restore</b> and save a backup file every month or so, somewhere safe such as " + lk("https://drive.google.com/", "Google Drive") + "."]))

s.append(Paragraph('<a name="p5"/>Part 5. How to: sites, rates and settings', h1))
s.append(Paragraph("Everything below is in <b>Settings</b> (the gear at the top right of any screen). The list under <b>Your work</b> has: <b>Site locations &amp; rates</b>, <b>NIS &amp; tax</b>, <b>Payslips</b>, <b>Timesheet</b>, <b>Public holidays</b> and <b>Backup &amp; restore</b>.", ParagraphStyle("kw5", parent=body, keepWithNext=1)))
s.append(steps([("Tap <b>Site locations &amp; rates</b> to add sites and change pay rates. The others are explained at the end of this part.", A("c-hub"), 50)]))
s.append(Paragraph("A. Add a new location", h2))
s.append(steps([
 ("Open <b>Settings</b>, then <b>Site locations &amp; rates</b>. At the bottom of the list, tap the teal button <b>+ Add new location</b>. It opens its own page.", None),
 ("Type the <b>site name</b>. Under <b>Group</b>, pick the payslip the site belongs to. A group is its own payslip: in Split tax mode it pays its own PAYE, NIS and health surcharge. To start a new payslip group, choose <b>New group</b>, type its name and the standard rate.", A("c-add"), 50),
 ("<b>Role box on the day form:</b> choose <b>Standard roles</b> (the day form shows the Role list, for example Client medic) or <b>Type in a location</b>. With a typed location, you type the place on each day (for example Dolphin platform) and it goes in the <b>Client assigned</b> column of the time sheet.", A("d-typed"), 50),
 ("<b>How the site is paid:</b> <b>Hourly</b> uses the group's hourly rates, the overtime pattern and the <b>lunch check</b> Yes or No. <b>Fixed day rate</b> is for a site that pays one amount for the day (see B). A fixed day rate site never has a lunch check.", None),
 ("Tap <b>Add site</b> at the bottom of the page. Cancel closes the page without adding anything.", A("c-addbtn"), 50)]))
s.append(Paragraph("B. A fixed day rate site", h2))
s.append(steps([
 ("Choose <b>Fixed day rate</b>. Type the <b>fixed day rate</b> and, if it is different, the <b>team lead day rate</b>. Under <b>1x</b>, type the hours the fixed rate covers (for example 12). Leave it blank for a flat rate that pays the whole day, like HHSL Compound.", A("d-fixed"), 50),
 ("After the 1x hours you can set hours at <b>1.5x</b>, <b>2x</b> and <b>3x</b> (type 1000 for no limit) and the <b>hourly rate for the hours after 1x</b>.", None),
 ("<b>Weekend</b> and <b>Holiday / TAR</b> each have a <b>Same as weekday</b> tick. Untick it to give that day type its own fixed rate and its own hours.", A("d-weekend"), 50)]))
s.append(Paragraph("C. Change a rate", h2))
s.append(steps([
 ("In <b>Site locations &amp; rates</b>, tap the site to open it. Change the <b>Standard rate</b> or the <b>Team lead rate</b>.", A("c-rate"), 50),
 ("A bar appears at the bottom. Pick the date the new rate starts under <b>Take effect from</b>: today (earlier days keep their old rate), a future date, or <b>Apply to all days</b> to recalculate every day. Then tap <b>Save</b>.", A("c-effect"), 50),
 ("To change a whole group at once, use the group card above the site list and tap <b>Change for all sites</b>. You can leave out sites that have their own rate.", None)]))
s.append(Paragraph("D. Give a role its own pay", h2))
s.append(steps([
 ("Open the site. Under <b>Role rates</b>, type a role (for example Offshore) in <b>Add another role</b> and tap <b>Add role</b>. Give the role its own rate and, if needed, its own hours. Leave it blank to use the site's standard rate.", A("c-roles"), 50),
 ("When you add a job on the calendar, you pick the role under the site.", None)]))
s.append(Paragraph("E. Set the overtime hours", h2))
s.append(steps([
 ("Open the site and scroll to <b>Overtime hours</b>. Pick a <b>template</b>, or type the hours yourself: how many hours of the day are paid at 1x, 1.5x, 2x and 3x, for weekdays, weekends and holidays. Type 1000 for no limit.", A("c-hours"), 50),
 ("For a site that pays one amount a day, use <b>Fixed day rate</b> (see B) instead. Tap <b>Remove site</b> at the very bottom of a site to delete it.", None)]))
s.append(Paragraph("F. The other settings", h2))
s.append(steps([
 ("<b>Public holidays:</b> Settings, <b>Public holidays</b>. Holidays show in red on the calendar and new jobs on them are marked. Divali and Eid change every year, so add them with <b>Add a holiday</b>.", None),
 ("<b>NIS &amp; tax:</b> Settings, <b>NIS &amp; tax</b>. The NIS table, PAYE and health surcharge. A saved change starts on its <b>Take effect from</b> date; older months keep the rules in force on their date.", None),
 ("<b>Payslips:</b> Settings, <b>Payslips</b>. Choose <b>Split</b> (each payslip is taxed on its own) or <b>Combined</b> (everything is taxed once), and the payslip names. The Home screen also has a Split switch.", None),
 ("<b>Timesheet:</b> Settings, <b>Timesheet</b>. Your name, the HHSL time sheet form and which jobs go on it (see Part 6).", None),
 ("<b>Backup &amp; restore:</b> Settings, <b>Backup &amp; restore</b>. Save a backup file, restore one, or import from a spreadsheet (see Part 3).", None)]))

s.append(Paragraph('<a name="p6"/>Part 6. Set it up your way', h1))
s.append(steps([
 ("<b>Colour and lunch for each site:</b> Settings, <b>Site locations &amp; rates</b>, open a site. Pick its calendar colour. For an hourly site, set <b>Job requires lunch check</b> to <b>No</b> if it has no lunch deduction, and the day form hides the lunch options. A fixed day rate site never has a lunch check.", Bs("b-site"), 50),
 ("<b>Which jobs go on your time sheet:</b> Settings, <b>Timesheet</b>. Tick the sites and roles that go on the form. The sentence at the top reads out what is included. Press <b>Save</b>.", Bs("b-tsjobs"), 50)]))

s.append(Paragraph('<a name="p7"/>Part 7. Share the app with someone else', h1))
s.append(Paragraph("To give a colleague the app you send them <b>three things</b> on WhatsApp: <b>1. the app link</b>, <b>2. the starter kit file</b> and <b>3. this guide</b>. All three buttons are in one place in the app, and you do it all from your phone.", ParagraphStyle("kw", parent=body, keepWithNext=1)))
s.append(steps([
 ("Open <b>Settings</b> (the gear) and scroll to <b>Share this app</b>. The three buttons are here.", A("a-share"), 50),
 ("<b>Send the link.</b> Tap <b>Share link</b>, pick <b>WhatsApp</b> and the person.", None),
 ("<b>Send the starter kit.</b> Tap <b>Share starter kit</b>, then <b>Yes, download and share</b>.", Bs("b-share-ask"), 50),
 ("The share menu opens. Pick <b>WhatsApp</b> (or Gmail) and the same person, and send the file.", Bs("b-share-after"), 50),
 ("<b>Send this guide.</b> Tap <b>Share guide (PDF)</b> and pick the same person. The guide is built into the app, so it is always the latest one. It needs a signal to load.", None)]))
s.append(Paragraph(f"This guide is also here, if you ever need to download it again: {lk(LINK + GUIDE_FILE, GUIDE_FILE)}", small))
s.append(Paragraph(f"Back to the top: {go('p1', 'Part 1')} · {go('p2', 'Part 2')} · {go('p3', 'Part 3')} · {go('p4', 'Part 4')} · {go('p5', 'Part 5')} · {go('p6', 'Part 6')} · {go('p7', 'Part 7')}", small))
doc.build(s)
