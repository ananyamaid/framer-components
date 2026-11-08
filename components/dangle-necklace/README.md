# Dangle Necklace

A necklace that drops into place when the section scrolls into view and hangs on a real physics chain. You can grab the pendant or the chain and drag it around, and it swings and settles back down when you let go. If you pull it further than the chain reaches, more chain feeds in from the top.

The chain is drawn in code with tiny alternating links, so you only need to add a picture of the pendant.

## Preview

https://github.com/user-attachments/assets/b6e2690c-ba93-4cf6-9603-f56c4a164437


## How to use in Framer
1. Create a new code component in Framer and paste in the code from DangleNecklace.tsx.
2. Drag the component onto your canvas and give it a fixed size, for example 1200 by 800.
3. Add a PNG of your pendant in the Pendant control. It should have a transparent background and no chain, because the chain and hoops are added for you.

## Controls
- Pendant: the picture of your pendant (transparent PNG, no chain)
- Metal: Gold, Silver or Rose Gold, for the chain and hoops
- Hang From: Top Centre for hearts, lockets and charms, or Both Ends for name and bar necklaces
- Size: how big the pendant is compared to the frame
- Hang Height: how far down the frame the pendant rests

## Good to know
- The component reads the transparent edges of your PNG to work out where the chain should attach, so a clean cutout gives the best result.
- It works on phones too. The page only stops scrolling when a finger is touching the necklace.
- If someone has reduced motion turned on, the necklace appears in place without the drop.

## Using it outside Framer
This is a React component with no extra libraries, everything is drawn on a canvas. To use it in a Next.js or React project, remove the import from "framer", delete the addPropertyControls block at the bottom, and replace the RenderTarget check with false. Then pass pendant, metal, hangFrom, size and hangHeight as normal props.
