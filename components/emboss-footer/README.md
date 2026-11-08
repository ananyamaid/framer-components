# Emboss Footer

A metal plate for the bottom of your website, with a name pressed into the middle of it. Visitors can draw on the plate with their cursor or finger, and every line they draw gets embossed into the metal like it was stamped. The light follows the cursor, so the raised parts catch the shine as you move around.

Drawings are mirrored by default, so even a quick scribble turns into a symmetrical pattern. Double click to wipe the plate clean.

## Preview

https://github.com/user-attachments/assets/de503d69-e717-43af-ac38-af395967f171


## How to use in Framer
1. Create a new code component in Framer and paste in the code from EmbossFooter.tsx.
2. Drag the component into the footer of your page and set it to fill the width, with a height of around 300 to 400.
3. Type your name or brand in the Name control and pick a font for it.

## Controls
- Name: the text pressed into the middle of the plate. Leave it empty for a plain plate.
- Name Font: the font used for the name
- Name Size: how big the name is
- Emboss: Raised makes drawings stand out of the metal, Engraved presses them in
- Mirror: Off, Both Ways copies drawings left and right, Four Ways also copies them top and bottom
- Shine: Follows Cursor moves the light with the cursor, Still keeps it in one place
- Metal: Silver, Gold or Rose Gold
- Brushed Lines: adds fine brushed metal scratches across the plate
- Brush: how thick the drawn lines are
- Depth: how deep the emboss looks

## Good to know
- Pick a font in Name Font so the name looks the same on every device. Without one it falls back to a script font from the visitor's computer.
- If the name is too wide for a small screen, it shrinks automatically to fit.
- Drawing works with a mouse, trackpad or finger, and the page won't scroll while you draw on the plate.
- The plate pauses when it's scrolled off screen, so it doesn't slow the page down.
- If something goes wrong with WebGL, the error is printed in red on the component so you can see what happened.

## Using it outside Framer
This is a React component with no extra libraries. To use it in a Next.js or React project, remove the import from "framer", delete the addPropertyControls block at the bottom, and pass the controls above as normal props. The Name Font control becomes an object with fontFamily, fontWeight and fontStyle. Add "use client" at the top of the file in Next.js.
