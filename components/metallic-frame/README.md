# Metallic Frame

A spiky chrome border that sits around any image, drawn live with WebGL. The frame slowly sways on its own, tilts towards your cursor, and the spikes grow a little when you hover over it. Click it and it asks for camera access, then the metal starts reflecting your face in real time, like a real mirror finish.

You can choose a heart, circle or square shape and pick between silver, gold and rose gold.

## Preview

https://github.com/user-attachments/assets/2a5da112-2980-4da1-81b6-a84b63729950


## How to use in Framer
1. Create a new code component in Framer and paste in the code from MetallicFrame.tsx.
2. Drag the component onto your canvas and give it a square size, for example 400 by 400.
3. Add your picture in the Image control and adjust Image Size until it sits nicely inside the frame.

## Controls
- Image: the picture shown inside the frame
- Shape: Heart, Circle or Square
- Metal: Silver, Gold or Rose Gold
- Frame Size: how big the frame is inside the component
- Border: how thick the metal band is
- Spikes: how many spikes go around the frame
- Spike Length: how far the spikes stick out
- Sharpness: how pointed the spikes are
- Twist: bends the spikes so they curl around the frame
- Inner Spikes: adds small spikes on the inside edge too
- Image Size: how big the picture is inside the frame
- Camera: turns the click to reflect feature on or off
- Hint: the small text shown on hover before the camera is on
- Hint Color: the colour of that text
- Background: the colour behind the frame, transparent by default

## Good to know
- The camera only turns on after someone clicks, and the browser asks for permission first. If they say no, the frame keeps its studio lighting and still looks metallic.
- If you use several frames on one page, they all share one camera, so permission is only asked once.
- The camera only works on a published site with https, or in Framer preview.
- If something goes wrong with WebGL, the error is printed in red on the component so you can see what happened.

## Using it outside Framer
This is a React component with no extra libraries. To use it in a Next.js or React project, remove the import from "framer", delete the addPropertyControls block at the bottom, and pass the controls above as normal props. Since it uses the camera and WebGL, add "use client" at the top of the file in Next.js.
